// === SERVER.JS – Oracle Cloud + Localhost mode ===
// Dwie bazy MySQL: aisql (auth) + homeso_wycena (dane)

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import multer from "multer";
import passport from "passport";
import { OpenAI } from "openai";

import "./passport.js";
import { dbAuth, dbData } from "./db.js";
import { parseUploadedSchema } from "./parse-schema.js";
import authRoutes from "./auth/auth.routes.js";
import { requireAuth } from "./middleware/requireAuth.js";

// === Konfiguracja środowiska ===
dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isLocal = process.env.PUBLIC_IP === undefined || process.env.PUBLIC_IP.includes("localhost");

// === Middleware globalne ===
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(express.static(path.join(__dirname, "public")));

// === Trasy autoryzacji ===
app.use("/api/auth", authRoutes);

// === Upload plików ===
const tempUpload = "tmp_uploads";
if (!existsSync(tempUpload)) mkdirSync(tempUpload);
const upload = multer({ dest: tempUpload });

const uploadsDir = path.join(__dirname, "uploads");
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir);

// === OpenAI ===
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === Funkcja AI do generowania SQL ===
async function generateSql(question, schema) {
  const schemaText = JSON.stringify(schema, null, 2);
  let knownColumns = [];

  if (Array.isArray(schema.tables)) {
    knownColumns = schema.tables.flatMap((t) =>
      t.columns.map((c) => `${t.name}.${c.name}`)
    );
  } else {
    knownColumns = Object.entries(schema).flatMap(([table, cols]) =>
      cols.map((col) => `${table}.${col}`)
    );
  }

  const rules = `
Masz dostęp tylko do poniższej struktury bazy danych:
${schemaText}

Kolumny:
${knownColumns.join(", ")}

Zasady:
- Używaj wyłącznie nazw tabel i kolumn z powyższej struktury.
- Nie twórz nowych tabel ani kolumn.
- Nie dodawaj komentarzy ani wyjaśnień — zwróć wyłącznie jedno poprawne zapytanie SQL zakończone średnikiem.
- Unikaj błędów ambiguous column — zawsze kwalifikuj kolumny pełną nazwą tabeli.
- Nie wymyślaj nieistniejących połączeń między tabelami.
`;

  const messages = [
    { role: "system", content: rules },
    { role: "user", content: `Wygeneruj SQL dla pytania: "${question}"` },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages,
    temperature: 0.2,
  });

  return response.choices[0].message.content.trim();
}

function extractSql(text) {
  const match = text.match(/SELECT[\s\S]*?;/i);
  return match ? match[0].trim() : null;
}

function containsUnknownTables(sql, schema) {
  const knownTables = Array.isArray(schema.tables)
    ? schema.tables.map((t) => t.name)
    : Object.keys(schema);
  const matches = [...sql.matchAll(/(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)/g)];
  const usedTables = matches.map((m) => m[1]);
  return usedTables.some((table) => !knownTables.includes(table));
}

// === Upload schematu (dla zalogowanego użytkownika) ===
app.post("/upload-schema", requireAuth, upload.single("schemaFile"), async (req, res) => {
  const userId = req.user.id;
  const filePath = req.file.path;
  try {
    const simplified = await parseUploadedSchema(filePath);
    const outputFile = `schema_${userId}_${Date.now()}.json`;
    const outputPath = path.join(uploadsDir, outputFile);
    await fs.writeFile(outputPath, JSON.stringify(simplified, null, 2), "utf-8");

    await dbAuth.execute(
      "INSERT INTO user_schemas (user_id, filename, path) VALUES (?, ?, ?)",
      [userId, outputFile, outputPath]
    );

    res.status(200).send(`✅ Schemat zapisany jako: ${outputFile}`);
  } catch (err) {
    console.error("❌ Błąd parsowania schematu:", err.message);
    res.status(400).send("❌ Nie udało się przetworzyć schematu.");
  } finally {
    await fs.unlink(filePath);
  }
});

// === Lista schematów użytkownika ===
app.get("/schemas", requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const [rows] = await dbAuth.execute(
      "SELECT filename, uploaded_at FROM user_schemas WHERE user_id = ? ORDER BY uploaded_at DESC",
      [userId]
    );
    res.json(rows.map((r) => r.filename));
  } catch (err) {
    console.error("❌ Błąd przy pobieraniu listy schematów:", err.message);
    res.status(500).json({ error: "Nie udało się pobrać listy plików." });
  }
});

// === Usuwanie schematu ===
app.delete("/schemas/:filename", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const fileName = req.params.filename;

  try {
    const [rows] = await dbAuth.execute(
      "SELECT path FROM user_schemas WHERE filename = ? AND user_id = ?",
      [fileName, userId]
    );
    if (rows.length === 0) return res.status(404).send("❌ Nie znaleziono pliku.");

    const filePath = rows[0].path;
    if (existsSync(filePath)) await fs.unlink(filePath);

    await dbAuth.execute(
      "DELETE FROM user_schemas WHERE filename = ? AND user_id = ?",
      [fileName, userId]
    );

    res.send(`✅ Usunięto ${fileName}`);
  } catch (err) {
    console.error("❌ Błąd usuwania:", err.message);
    res.status(500).send("❌ Nie udało się usunąć pliku.");
  }
});

// === Generowanie SQL ===
app.post(["/generate-sql", "/api/ask"], async (req, res) => {
  const { prompt, schema: inlineSchema } = req.body;
  const user = req.user || { id: 0 }; // dla trybu demo
  const userId = user.id;

  if (!prompt) return res.status(400).json({ error: "Brak pytania." });

  try {
    let schema;

    if (inlineSchema && typeof inlineSchema === "object") {
      if (inlineSchema.tables && Array.isArray(inlineSchema.tables)) {
        const simplified = {};
        for (const t of inlineSchema.tables) {
          simplified[t.name] = t.columns.map((c) => c.name);
        }
        schema = simplified;
      } else {
        schema = inlineSchema;
      }
      console.log("🧩 Użyto schematu przesłanego inline.");
    }

    if (!schema && userId > 0) {
      const [rows] = await dbAuth.execute(
        "SELECT path FROM user_schemas WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 1",
        [userId]
      );
      if (!rows.length) throw new Error("Brak wgranych schematów dla użytkownika.");
      const latestPath = rows[0].path;
      schema = JSON.parse(await fs.readFile(latestPath, "utf-8"));
    }

    if (!schema) throw new Error("Nie znaleziono schematu.");

    const raw = await generateSql(prompt, schema);
    const sql = extractSql(raw);
    if (!sql) throw new Error("Nie udało się wyodrębnić SQL.");
    if (containsUnknownTables(sql, schema))
      throw new Error("Zapytanie zawiera nieznane tabele.");

    res.json({ sql });
  } catch (err) {
    console.error("❌ Błąd /generate-sql:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// === Diagnostyka ===
app.get("/ping", async (req, res) => {
  try {
    await dbAuth.query("SELECT 1");
    await dbData.query("SELECT 1");
    res.send("✅ Obie bazy działają poprawnie!");
  } catch (err) {
    res.status(500).send("❌ Problem z bazą: " + err.message);
  }
});

// === Start serwera ===
const PORT = process.env.PORT || 8080;
const HOST = isLocal ? "localhost" : "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Serwer działa na ${isLocal ? "localhost" : "Oracle Cloud"}`);
  console.log(`🌍 URL: http://${isLocal ? "localhost" : (process.env.PUBLIC_IP || "130.162.227.150")}:${PORT}`);
});
