// === SERVER.JS – Oracle Cloud (IP: 130.162.227.150) ===
// Dwie bazy MySQL: aisql (auth) + homeso_wycena (dane)

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import multer from 'multer';
import passport from 'passport';
import { OpenAI } from 'openai';

import './passport.js';
import { dbAuth, dbData } from './db.js'; // ✅ centralne połączenia
import { parseUploadedSchema } from './parse-schema.js';
import authRoutes from './auth/auth.routes.js';

// === Konfiguracja środowiska ===
dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Middleware globalne ===
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(express.static(path.join(__dirname, 'public')));

// === Trasy autoryzacji ===
app.use('/api/auth', authRoutes);

// === Upload plików ===
const tempUpload = 'tmp_uploads';
if (!existsSync(tempUpload)) mkdirSync(tempUpload);
const upload = multer({ dest: tempUpload });

const uploadsDir = path.join(__dirname, 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir);

// === OpenAI ===
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === Funkcja AI do generowania SQL ===
async function generateSql(question, schema) {
  const schemaText = JSON.stringify(schema, null, 2);
  let knownColumns = [];

  // Obsługa formatu { tables: [{ name, columns }] } i { tabela: [kolumny] }
  if (Array.isArray(schema.tables)) {
    knownColumns = schema.tables.flatMap(t =>
      t.columns.map(c => `${t.name}.${c.name}`)
    );
  } else {
    knownColumns = Object.entries(schema)
      .flatMap(([table, cols]) => cols.map(col => `${table}.${col}`));
  }

  const rules = `
Masz dostęp tylko do poniższej struktury bazy danych:
${schemaText}

Kolumny:
${knownColumns.join(', ')}

Zasady:
- Używaj wyłącznie nazw tabel i kolumn z powyższej struktury.
- Nie twórz nowych tabel ani kolumn.
- Nie dodawaj komentarzy ani wyjaśnień — zwróć wyłącznie jedno poprawne zapytanie SQL zakończone średnikiem.
- Unikaj błędów ambiguous column — zawsze kwalifikuj kolumny pełną nazwą tabeli.
- Nie wymyślaj nieistniejących połączeń między tabelami.
`;

  const messages = [
    { role: 'system', content: rules },
    { role: 'user', content: `Wygeneruj SQL dla pytania: "${question}"` },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages,
    temperature: 0.2,
  });

  return response.choices[0].message.content.trim();
}

// === Pomocnicze funkcje ===
function extractSql(text) {
  const match = text.match(/SELECT[\s\S]*?;/i);
  return match ? match[0].trim() : null;
}

function containsUnknownTables(sql, schema) {
  const knownTables = Array.isArray(schema.tables)
    ? schema.tables.map(t => t.name)
    : Object.keys(schema);
  const matches = [...sql.matchAll(/(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)/g)];
  const usedTables = matches.map(m => m[1]);
  return usedTables.some(table => !knownTables.includes(table));
}

async function testQuery(sql) {
  try {
    await dbData.execute(`EXPLAIN ${sql}`);
    return true;
  } catch (err) {
    console.warn('❌ [EXPLAIN] Odrzucono zapytanie:', err.message);
    return false;
  }
}

// === API: /api/ask ===
app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Brak pytania.' });

  try {
    const schema = JSON.parse(await fs.readFile('./schema.json', 'utf-8'));
    const raw = await generateSql(question, schema);
    const sql = extractSql(raw);
    if (!sql) throw new Error('Nie udało się wyodrębnić SQL.');

    if (containsUnknownTables(sql, schema)) {
      throw new Error('Zapytanie zawiera nieznane tabele.');
    }

    const ok = await testQuery(sql);
    if (!ok) throw new Error('Błędna składnia SQL.');

    const [rows] = await dbData.execute(sql);
    res.json({ sql, rows });
  } catch (err) {
    console.error('❌ Błąd /api/ask:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Upload schematu ===
app.post('/upload-schema', upload.single('schemaFile'), async (req, res) => {
  const filePath = req.file.path;
  try {
    const simplified = await parseUploadedSchema(filePath);
    const outputFile = `schema_${Date.now()}.json`;
    const outputPath = path.join(uploadsDir, outputFile);
    await fs.writeFile(outputPath, JSON.stringify(simplified, null, 2), 'utf-8');
    res.status(200).send(`✅ Schemat zapisany jako: ${outputFile}`);
  } catch (err) {
    console.error('❌ Błąd parsowania schematu:', err.message);
    res.status(400).send('❌ Nie udało się przetworzyć schematu.');
  } finally {
    await fs.unlink(filePath);
  }
});

// === Lista schematów ===
app.get('/schemas', async (req, res) => {
  try {
    const files = await fs.readdir(uploadsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    res.json(jsonFiles);
  } catch (err) {
    console.error('❌ Błąd przy pobieraniu listy schematów:', err.message);
    res.status(500).json({ error: 'Nie udało się pobrać listy plików.' });
  }
});

// === Usuwanie schematu ===
app.delete('/schemas/:filename', async (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(uploadsDir, fileName);
  try {
    if (!existsSync(filePath)) return res.status(404).send('Plik nie istnieje.');
    await fs.unlink(filePath);
    res.send(`✅ Usunięto ${fileName}`);
  } catch (err) {
    console.error('❌ Błąd usuwania:', err.message);
    res.status(500).send('❌ Nie udało się usunąć pliku.');
  }
});

// === Generowanie SQL (dla schema-paste.html i schema-query.html) ===
app.post('/generate-sql', async (req, res) => {
  const { prompt, schema: inlineSchema } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Brak pytania.' });

  try {
    let schema;

    // 1️⃣ Jeśli schemat przesłano inline (schema-paste.html)
    if (inlineSchema && typeof inlineSchema === 'object') {
      if (inlineSchema.tables && Array.isArray(inlineSchema.tables)) {
        const simplified = {};
        for (const t of inlineSchema.tables) {
          simplified[t.name] = t.columns.map(c => c.name);
        }
        schema = simplified;
      } else {
        schema = inlineSchema;
      }
      console.log('🧩 Użyto schematu przesłanego inline.');
    }

    // 2️⃣ Jeśli brak schematu w body → wczytaj najnowszy z katalogu uploads
    if (!schema) {
      const files = await fs.readdir(uploadsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json')).sort();
      if (jsonFiles.length === 0) throw new Error('Brak wgranych schematów.');
      const latestFile = jsonFiles[jsonFiles.length - 1];
      schema = JSON.parse(await fs.readFile(path.join(uploadsDir, latestFile), 'utf-8'));
      console.log('📂 Użyto schematu z pliku:', latestFile);
    }

    // 3️⃣ Generowanie SQL
    const raw = await generateSql(prompt, schema);
    const sql = extractSql(raw);
    if (!sql) throw new Error('Nie udało się wyodrębnić SQL.');

    if (containsUnknownTables(sql, schema)) {
      throw new Error('Zapytanie zawiera nieznane tabele.');
    }

    res.json({ sql });
  } catch (err) {
    console.error('❌ Błąd /generate-sql:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Diagnostyka połączeń ===
app.get('/ping', async (req, res) => {
  try {
    await dbAuth.query('SELECT 1');
    await dbData.query('SELECT 1');
    res.send('✅ Obie bazy działają poprawnie!');
  } catch (err) {
    res.status(500).send('❌ Problem z bazą: ' + err.message);
  }
});

// === Start serwera ===
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // konieczne dla Oracle Cloud

app.listen(PORT, HOST, () => {
  console.log('🚀 Serwer działa na Oracle Cloud');
  console.log(`🌍 URL: http://${process.env.PUBLIC_IP || '130.162.227.150'}:${PORT}`);
});
