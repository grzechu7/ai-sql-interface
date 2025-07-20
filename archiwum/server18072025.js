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

// 📁 Ścieżki
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🌍 Serwowanie frontendu
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: 'http://192.168.5.109:8080' }));
app.use(express.json());

// 🔌 OpenAI klient
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🗄️ Połączenie z MySQL
const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

// 🧠 Generowanie SQL z restrykcyjnym kontekstem
async function generateSql(question, schema) {
  const schemaText = JSON.stringify(schema, null, 2);
  const messages = [
    {
      role: 'system',
      content: `Oto jedyna dostępna struktura bazy danych:\n${schemaText}\nNie wolno używać innych tabel ani kolumn.`
    },
    {
      role: 'user',
      content: `Na podstawie tej struktury wygeneruj jedno poprawne zapytanie SQL odpowiadające na pytanie: "${question}". Tylko czysty SQL.`
    }
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages,
    temperature: 0.2
  });

  return completion.choices[0].message.content.trim();
}

// 🧼 Wyodrębnienie czystego SQL
function extractSql(text) {
  const match = text.match(/SELECT[\s\S]*?;/i);
  return match ? match[0].trim() : null;
}

// 🚫 Walidacja używanych tabel
function containsUnknownTables(sql, schema) {
  const knownTables = Object.keys(schema);
  const matches = [...sql.matchAll(/(?:FROM|JOIN)\\s+([a-zA-Z0-9_]+)/g)];
  const usedTables = matches.map(m => m[1]);
  return usedTables.some(t => !knownTables.includes(t));
}

// 📨 Główna trasa API
app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Brak pytania.' });

  try {
    const schema = JSON.parse(await fs.readFile('./schema.json', 'utf-8'));

    const raw = await generateSql(question, schema);
    const sql = extractSql(raw);

    if (!sql) throw new Error('Nie udało się wyodrębnić zapytania SQL.');
    if (containsUnknownTables(sql, schema)) throw new Error('Zapytanie zawiera nieznane tabele.');

    const [rows] = await db.execute(sql);
    res.json({ sql, rows });
  } catch (err) {
    console.error('❌ Błąd:', err);
    res.status(500).json({ error: err.message || 'Błąd zapytania SQL.' });
  }
});

// 🚀 Start serwera
const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API ready → http://192.168.5.109:${PORT}`);
});
