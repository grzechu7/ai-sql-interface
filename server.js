// server.js

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { OpenAI } from 'openai';
import fs from 'fs/promises';

dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: 'http://192.168.5.109:8080' }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

// 🔍 generowanie SQL z kontekstem i ograniczeniami
async function generateSql(question, schema) {
  const schemaText = JSON.stringify(schema, null, 2);

  // 🔐 Tworzymy pełną listę kolumn jako tabela.kolumna
  const knownColumns = Object.entries(schema)
    .map(([table, cols]) => cols.map(col => `${table}.${col}`))
    .flat();

  const rules = `
Masz dostęp tylko do poniższej struktury bazy danych:
${schemaText}

Kolumny dostępne w formacie tabela.kolumna:
${knownColumns.join(', ')}

Zasady:
- Używaj wyłącznie nazw tabel i kolumn z powyższej struktury.
- Nie twórz nowych tabel ani kolumn.
- Nie twórz aliasów zawierających kolumny, których nie ma w tabeli (np. w.cenaBrutto, jeśli cenaBrutto nie istnieje w tabeli w).
- Jeśli używasz agregatów (SUM, MAX), nie zagnieżdżaj jednego w drugim.
- Jeśli musisz połączyć agregaty, zastosuj podzapytania — np. SELECT ... FROM (SELECT ... GROUP BY ...) AS pod.
- Nie dodawaj komentarzy ani wyjaśnień — zwróć wyłącznie jedno poprawne zapytanie SQL zakończone średnikiem.
- wyceny ogółem końcowe znajduja się w tabeli wynik_wycenymoduly.
- wyceny modółów, programowania, rozdzielnicy, projektu znajdują sie w tabeli wycena_koncnetto.
- Jeśli kolumna występuje w więcej niż jednej tabeli (np. cenaBrutto), zawsze używaj w zapytaniu pełnej nazwy (np. wynik_wycenyModuly.cenaBrutto lub ceny_modulow.cenaBrutto). Nie pomijaj prefiksu tabeli ani aliasu.
- Nigdy nie zostawiaj kolumny niekwalifikowanej, jeśli istnieje w więcej niż jednej tabeli w zapytaniu. To prowadzi do błędu ambiguous column.

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


// 🧼 wyciąganie SQL-a
function extractSql(text) {
  const match = text.match(/SELECT[\s\S]*?;/i);
  return match ? match[0].trim() : null;
}

// 🚫 sprawdzanie czy zapytanie zawiera nieznane tabele
function containsUnknownTables(sql, schema) {
  const knownTables = Object.keys(schema);
  const matches = [...sql.matchAll(/(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)/g)];
  const usedTables = matches.map(m => m[1]);
  return usedTables.some(table => !knownTables.includes(table));
}

// 🔍 testowanie EXPLAIN
async function testQuery(sql) {
  try {
    await db.execute(`EXPLAIN ${sql}`);
    return true;
  } catch (err) {
    console.warn('❌ [EXPLAIN] Zapytanie zablokowane przez EXPLAIN:');
    console.warn(sql);
    console.warn('🛑 Błąd EXPLAIN:', err.message);
    return false;
  }
}


app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Brak pytania.' });

  try {
    const schema = JSON.parse(await fs.readFile('./schema.json', 'utf-8'));
    const raw = await generateSql(question, schema);
    const sql = extractSql(raw);

    if (!sql) throw new Error('Nie udało się wyodrębnić zapytania SQL.');
    if (containsUnknownTables(sql, schema)) throw new Error('Zapytanie zawiera nieznane tabele.');

    const isSafe = await testQuery(sql);
    if (!isSafe) throw new Error('Zapytanie SQL ma błędną składnię lub strukturę (EXPLAIN nie powiódł się).');

    const [rows] = await db.execute(sql);
    res.json({ sql, rows });
  } catch (err) {
    console.error('❌ Błąd:', err);
    res.status(500).json({ error: err.message || 'Błąd zapytania SQL.' });
  }
});

const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API ready → http://192.168.5.109:${PORT}`);
});
