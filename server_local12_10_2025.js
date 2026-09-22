// server.js — wersja Oracle Cloud (poprawiona)
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { OpenAI } from 'openai';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import multer from 'multer';
import { parseUploadedSchema } from './parse-schema.js';
import passport from 'passport';
import './passport.js';
import authRoutes from './auth/auth.routes.js';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Middleware globalne ===
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(express.static(path.join(__dirname, 'public')));

// === Trasy autoryzacji ===
app.use('/api/auth', authRoutes);

// === Multer (upload plików) ===
const tempUpload = 'tmp_uploads';
const upload = multer({ dest: tempUpload });
if (!existsSync(tempUpload)) mkdirSync(tempUpload);
const uploadsDir = path.join(__dirname, 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir);

// === OpenAI API ===
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// === Połączenie z MySQL ===
const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

console.log('✅ Połączono z bazą danych MySQL');

// === Funkcja generująca SQL z AI ===
async function generateSql(question, schema) {
  const schemaText = JSON.stringify(schema, null, 2);
  const knownColumns = Object.entries(schema)
    .flatMap(([table, cols]) => cols.map(col => `${table}.${col}`));

  const rules = `
Masz dostęp tylko do poniższej struktury bazy danych:
${schemaText}

Kolumny dostępne w formacie tabela.kolumna:
${knownColumns.join(', ')}

Zasady:
- Używaj wyłącznie nazw tabel i kolumn z powyższej struktury.
- Nie twórz nowych tabel ani kolumn.
- Nie twórz aliasów zawierających kolumny, których nie ma w tabeli.
- Jeśli używasz agregatów (SUM, MAX), nie zagnieżdżaj jednego w drugim.
- Jeśli musisz połączyć agregaty, użyj podzapytań.
- Zwróć WYŁĄCZNIE jedno poprawne zapytanie SELECT zakończone średnikiem.
- Jeśli kolumna występuje w wielu tabelach, zawsze kwalifikuj ją nazwą tabeli/aliasem.
- Unikaj ambiguous column — zawsze kwalifikuj kolumny.

Kontekst domenowy:
- Wyceny ogółem końcowe: tabela \`wynik_wycenymoduly\`.
- Wyceny modułów/projektu/rozdzielnicy/programowania: \`wycena_koncnetto\`.
`;

  const messages = [
    { role: 'system', content: rules },
    { role: 'user', content: `Wygeneruj zapytanie SQL dla pytania: "${question}"` }
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages,
    temperature: 0.2
  });

  return response.choices[0].message.content.trim();
}

// === Wyodrębnienie SQL z tekstu AI ===
function extractSql(text) {
  const match = text.match(/SELECT[\s\S]*?;/i);
  return match ? match[0].trim() : null;
}

// === Sprawdzenie, czy zapytanie nie używa nieznanych tabel ===
function containsUnknownTables(sql, schema) {
  const knownTables = Object.keys(schema);
  const matches = [...sql.matchAll(/(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)/g)];
  const usedTables = matches.map(m => m[1]);
  return usedTables.some(table => !knownTables.includes(table));
}

// === Test składni zapytania ===
async function testQuery(sql) {
  try {
    await db.execute(`EXPLAIN ${sql}`);
    return true;
  } catch (err) {
    console.warn('❌ [EXPLAIN] Zapytanie odrzucone:', err.message);

    // Jeśli błąd dotyczy składni SQL
    if (
      err.message.includes('syntax error') ||
      err.message.includes('You have an error in your SQL syntax')
    ) {
      return false;
    }

    // Jeśli to brak tabeli, rzuć wyjątek dalej — nie traktuj jako błędu składni
    if (err.message.includes("doesn't exist")) {
      throw new Error(`Tabela nie istnieje: ${err.message}`);
    }

    // Inne błędy — też rzuć
    throw err;
  }
}

// === Główne API /api/ask ===
app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Brak pytania.' });

  try {
    const schema = JSON.parse(await fs.readFile('./schema.json', 'utf-8'));
    const raw = await generateSql(question, schema);
    const sql = extractSql(raw);
    if (!sql) throw new Error('Nie udało się wyodrębnić zapytania SQL.');
    if (containsUnknownTables(sql, schema)) {
      throw new Error('Zapytanie zawiera nieznane tabele względem schematu.');
    }

    const isSafe = await testQuery(sql);
    if (!isSafe) throw new Error('Zapytanie SQL ma błędną składnię.');

    const [rows] = await db.execute(sql);
    res.json({ sql, rows });
  } catch (err) {
    console.error('❌ Błąd:', err.message);
    res.status(500).json({ error: err.message || 'Błąd zapytania SQL.' });
  }
});

// === Upload i przetwarzanie schematu ===
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
    res.status(400).send('❌ Nie udało się przetworzyć schematu: ' + err.message);
  } finally {
    await fs.unlink(filePath);
  }
});

// === Pobranie najnowszego schematu ===
async function getLatestUploadedSchema() {
  const files = await fs.readdir(uploadsDir);
  const schemaFiles = files.filter(f => f.startsWith('schema_') && f.endsWith('.json'));
  if (!schemaFiles.length) throw new Error('Brak wgranego schematu.');

  const resolved = await Promise.all(schemaFiles.map(async f => ({
    name: f,
    time: (await fs.stat(path.join(uploadsDir, f))).mtimeMs
  })));

  resolved.sort((a, b) => b.time - a.time);
  const latest = resolved[0].name;
  const raw = await fs.readFile(path.join(uploadsDir, latest), 'utf-8');
  return JSON.parse(raw);
}

// === /generate-sql ===
app.post('/generate-sql', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Brak prompta.' });

  try {
    const schema = await getLatestUploadedSchema();
    const raw = await generateSql(prompt, schema);
    const sql = extractSql(raw);
    if (!sql) throw new Error('AI nie zwróciło poprawnego zapytania SQL.');
    res.json({ sql });
  } catch (err) {
    console.error('❌ Błąd generowania SQL:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// === /api/generate-sql-inline ===
app.post('/api/generate-sql-inline', async (req, res) => {
  const { prompt, schema } = req.body;
  if (!prompt || !schema) {
    return res.status(400).json({ error: 'Brak prompta lub schematu.' });
  }

  try {
    const raw = await generateSql(prompt, schema);
    const sql = extractSql(raw);
    if (!sql) throw new Error('AI nie zwróciło poprawnego zapytania SQL.');
    res.json({ sql });
  } catch (err) {
    console.error('❌ Błąd /api/generate-sql-inline:', err.message);
    res.status(500).json({ error: err.message || 'Błąd generowania SQL.' });
  }
});

// === Lista i usuwanie schematów ===
app.get('/schemas', async (req, res) => {
  try {
    const files = await fs.readdir(uploadsDir);
    const schemaFiles = files.filter(f => f.startsWith('schema_') && f.endsWith('.json'));
    res.json(schemaFiles);
  } catch (err) {
    console.error('❌ Błąd pobierania plików:', err.message);
    res.status(500).json({ error: 'Nie udało się pobrać listy plików.' });
  }
});

app.delete('/schemas/:filename', async (req, res) => {
  const { filename } = req.params;
  if (!filename || !filename.startsWith('schema_') || !filename.endsWith('.json')) {
    return res.status(400).send('❌ Niedozwolona nazwa pliku.');
  }

  const filePath = path.join(uploadsDir, filename);
  try {
    await fs.unlink(filePath);
    res.send(`✅ Plik "${filename}" został usunięty.`);
  } catch (err) {
    console.error('❌ Błąd usuwania pliku:', err.message);
    res.status(500).send('❌ Nie udało się usunąć pliku.');
  }
});

// === Endpoint testowy ===
app.get('/ping', (req, res) => {
  res.send('✅ Działa na Oracle Cloud!');
});

// === Start serwera ===
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serwer Oracle Cloud działa → http://localhost:${PORT}`);
});
