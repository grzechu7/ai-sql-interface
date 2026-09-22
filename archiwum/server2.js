// server.js  –  pełna wersja “plug & play” (ESM)

import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import OpenAI from "openai";


// 1. Zmienne środowiskowe
dotenv.config();

// 2. Konfiguracja Express
const app = express();

// --- CORS: tylko frontend na http://localhost:8080 ---
/*app.use(
  cors({
    origin: "http://localhost:8080",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  })
);
*/
app.use(cors());

// Obsługa JSON
app.use(express.json());

// 3. Połączenie z bazą (pula)
console.log("⏳ Łączenie z MariaDB…");
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    connectionLimit: 5
});

app.get("/api/ping", (req, res) => {
    res.json({
        message: "✅ CORS działa!"
    });
});

// szybki test połączenia
try {
    const conn = await pool.getConnection();
    console.log("✅ Połączono z bazą danych!");
    conn.release();
} catch (err) {
    console.error("❌ Błąd połączenia z bazą:", err.message);
    process.exit(1);
}

// 4. Wczytanie schematu bazy z pliku JSON
let schemaJson = {};
try {
    schemaJson = JSON.parse(fs.readFileSync("schema.json", "utf-8"));
    console.log("✅ Wczytano schema.json");
} catch (err) {
    console.error("❌ Nie można wczytać schema.json:", err.message);
    process.exit(1);
}

// 5. Klient OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// 6. Endpoint API
app.post("/api/ask", async (req, res) => {
    const {
        question
    } = req.body;
    if (!question) return res.status(400).json({
        error: "question required"
    });

    console.log("📥 Pytanie:", question);

    try {
        // Prompt dla OpenAI
        const prompt = `Masz poniższy schemat bazy danych (JSON):\n\n${JSON.stringify(
      schemaJson,
      null,
      2
    )}\n\nZwróć TYLKO poprawne, bezpieczne zapytanie SQL (bez backticków ani objaśnień) odpowiadające na pytanie: "${question}".`;

        const chat = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
                    role: "system",
                    content: "Jesteś pomocnym asystentem SQL."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0
        });

        const sql = chat.choices ?. [0] ?.message ?.content ?.trim();
        if (!sql) return res.status(500).json({
            error: "no SQL generated"
        });

        console.log("➡️  Wygenerowane SQL:\n", sql);

        // Wykonaj zapytanie
        const [rows] = await pool.query(sql);

        res.json({
            sql,
            rows
        });
    } catch (err) {
        console.error("❌ Błąd w /api/ask:", err.message);
        res.status(500).json({
            error: err.message || "server error"
        });
    }
});

// 7. Start serwera
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`🚀 API ready → http://localhost:${PORT}`)
);