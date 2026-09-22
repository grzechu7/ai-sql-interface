// === SERVER.JS — Oracle Cloud / Lokalnie (rozdzielone endpointy, sesje HTTP) ===

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import multer from "multer";
import passport from "passport";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import { OpenAI } from "openai";

import "./passport.js"; // passport-local + serialize/deserialize
import { dbAuth, dbData } from "./db.js";
import { parseUploadedSchema } from "./parse-schema.js";
import authRoutes from "./auth/auth.routes.js";
import { requireAuth } from "./middleware/requireAuth.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Jeśli działa za Nginx/Proxy (np. Oracle Cloud)
app.set("trust proxy", 1);

// === SESJA ===
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore(
  {
    createDatabaseTable: true,
    schema: {
      tableName: "sessions",
      columnNames: { session_id: "session_id", expires: "expires", data: "data" },
    },
  },
  dbAuth.promise?.pool || dbAuth
);

// === CORS ===
// CORS — musi być przed sesją
app.use(
  cors({
    origin: ["https://aisql.pl", "http://localhost:8080"],
    credentials: true,
  })
);

// Middleware JSON
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true }));

// Sesja — po CORS
app.use(
  session({
    name: "aisql.sid",
    secret: process.env.SESSION_SECRET || "super_tajne_haslo_zmien_to",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
  httpOnly: true,
  secure: false,                // ⬅️ ważne: lokalnie NIE HTTPS
  sameSite: "lax",              // ⬅️ Chrome akceptuje z localhosta
  maxAge: 1000 * 60 * 60 * 8,   // 8h
},

  })
);

/*
 cookie: {
  httpOnly: true,
  secure: false,                // ⬅️ ważne: lokalnie NIE HTTPS
  sameSite: "lax",              // ⬅️ Chrome akceptuje z localhosta
  maxAge: 1000 * 60 * 60 * 8,   // 8h
},
*/

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  if (req.session) {
    console.log("🟢 Sesja działa:", req.session.id);
  }
  next();
});


// === AUTH ===
app.use("/api/auth", authRoutes);

// 🔹 Logowanie sesyjne (Passport local)
app.post("/api/auth/session-login", passport.authenticate("local", { session: true }), (req, res) => {
  console.log("✅ Użytkownik zalogowany przez sesję:", req.user?.email);
  res.json({ ok: true, user: { id: req.user.id, email: req.user.email } });
});

// 🔹 Wylogowanie (czyści sesję i cookie)
app.post("/api/auth/logout", (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.clearCookie("aisql.sid");
    res.json({ ok: true });
  });
});

app.get(
  "/api/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login.html",
    successRedirect: "/schema-query.html",
  })
);


// 🔹 Status sesji
app.get("/api/auth/me", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: "Nieautoryzowany" });
  }
});

// === FOLDERY UPLOAD ===
const uploadsDir = path.join(__dirname, "uploads");
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir);
const upload = multer({ dest: path.join(__dirname, "tmp_uploads") });
if (!existsSync("tmp_uploads")) mkdirSync("tmp_uploads");

// === OpenAI ===
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === Helper: AI generacja SQL ===
async function generateSql(prompt, schema) {
  const schemaText = JSON.stringify(schema, null, 2);
  const knownColumns = Array.isArray(schema.tables)
    ? schema.tables.flatMap((t) => t.columns.map((c) => `${t.name}.${c.name}`))
    : Object.entries(schema).flatMap(([t, cols]) => cols.map((c) => `${t}.${c}`));

  const rules = `
Masz dostęp tylko do poniższej struktury bazy danych:
${schemaText}

Kolumny: ${knownColumns.join(", ")}

Zasady:
- Czytaj dokładnie schemat bazy danyc, nie wymyslaj innych tabel ani kolumn.
- Zwróć jedno zapytanie SQL (SELECT ...;).
- Używaj wyłącznie nazw tabel i kolumn z powyższej struktury.
- Nie twórz nowych tabel ani kolumn.
- Nie dodawaj komentarzy ani wyjaśnień — zwróć wyłącznie jedno poprawne zapytanie SQL zakończone średnikiem.
- Unikaj błędów ambiguous column — zawsze kwalifikuj kolumny pełną nazwą tabeli.
- Nie wymyślaj nieistniejących połączeń między tabelami.

`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    temperature: 0.2,
    messages: [
      { role: "system", content: rules },
      { role: "user", content: `Wygeneruj SQL dla pytania: "${prompt}"` },
    ],
  });

  return response.choices[0].message.content.trim();
}

function extractSql(text) {
  const match = text.match(/SELECT[\s\S]*?;/i);
  return match ? match[0].trim() : text.trim();
}

function normalizeSelect(sql) {
  const s = sql.trim().replace(/;+\s*$/g, "");
  if (!/^select\b/i.test(s)) throw new Error("Dozwolone są wyłącznie zapytania SELECT.");
  const hasLimit =
    /\blimit\s+\d+/i.test(s) ||
    /\bfetch\s+first\s+\d+\s+rows\s+only/i.test(s) ||
    /\boffset\s+\d+\s+rows?\b/i.test(s);
  return hasLimit ? s : `${s} LIMIT 100`;
}

function toRowObjects(dbResult) {
  if (Array.isArray(dbResult?.rows) && dbResult.rows.length && !Array.isArray(dbResult.rows[0])) {
    return dbResult.rows;
  }
  if (Array.isArray(dbResult?.recordset)) return dbResult.recordset;

  if (Array.isArray(dbResult?.rows) && dbResult.rows.length && Array.isArray(dbResult.rows[0])) {
    const names =
      (dbResult.fields && dbResult.fields.map((f) => f.name)) ||
      (dbResult.metaData && dbResult.metaData.map((m) => m.name)) ||
      null;
    return dbResult.rows.map((arr) => {
      const obj = {};
      arr.forEach((v, i) => (obj[names?.[i] || `col${i + 1}`] = v));
      return obj;
    });
  }

  if (Array.isArray(dbResult) && dbResult.length === 2) {
    const rows = dbResult[0];
    const fields = dbResult[1];
    if (Array.isArray(rows) && rows.length) {
      if (!Array.isArray(rows[0])) return rows;
      const names = Array.isArray(fields)
        ? fields.map((f) => f.name || f.orgName || f.columnName || f.orgColumnName)
        : null;
      return rows.map((arr) => {
        const obj = {};
        arr.forEach((v, i) => (obj[names?.[i] || `col${i + 1}`] = v));
        return obj;
      });
    }
  }

  if (Array.isArray(dbResult) && dbResult.length && Array.isArray(dbResult[0])) {
    return dbResult.map((arr) => {
      const obj = {};
      arr.forEach((v, i) => (obj[`col${i + 1}`] = v));
      return obj;
    });
  }

  return [];
}

// === /api/ask — generowanie SQL i wykonanie na bazie dbData ===
app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Brak pytania w treści żądania." });
    }

    let schema;

// 🔹 1️⃣ Jeśli frontend przesłał schemat w body (np. schema-paste.html)
if (req.body.schema) {
  schema = req.body.schema;
  console.log("📄 Używam schematu przesłanego z frontendu (schema-paste.html)");
} else {
  // 🔹 2️⃣ W przeciwnym razie: domyślnie lub z konta użytkownika
  let schemaPath = path.join(__dirname, "schema.json");

  // 🔹 Jeśli żądanie pochodzi z sql-query.html → wymuś lokalny schemat
  if (req.headers["x-fixed-schema"] === "true") {
    schemaPath = path.join(__dirname, "schema.json");
    console.log("📘 Używam lokalnego schematu: ", schemaPath);
  } else if (req.isAuthenticated && req.isAuthenticated()) {
    const userId = req.user?.id;
    if (userId) {
      const [rows] = await dbAuth.query(
        "SELECT path FROM aisql.user_schemas WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 1",
        [userId]
      );
      if (rows.length && rows[0].path && existsSync(rows[0].path)) {
        schemaPath = rows[0].path;
        console.log(`📂 Używam schematu użytkownika: ${schemaPath}`);
      } else {
        console.log("⚠️ Brak schematu użytkownika — używam domyślnego.");
      }
    }
  }

  schema = JSON.parse(await fs.readFile(schemaPath, "utf-8"));
}


    const raw = await generateSql(question, schema);
    const sqlOnly = extractSql(raw);
    const safeSql = normalizeSelect(sqlOnly);

// 🔹 Jeśli front przesłał flagę dryRun — nie łączymy się z bazą
if (req.body.dryRun) {
  console.log("🧠 Tryb DEMO — generuję tylko SQL, bez połączenia z bazą");
  return res.json({ ok: true, sql: safeSql, dryRun: true });
}

// 🔹 Normalny tryb — wykonaj zapytanie w bazie
let rows = [];
try {
  const result = await dbData.query(safeSql);
  rows = toRowObjects(result);
} catch (e) {
  console.error("⚠️ Błąd podczas wykonywania SQL:", e);
  return res.status(200).json({ sql: safeSql, rows: [], dbError: e?.message || String(e) });
}

return res.json({ ok: true, sql: safeSql, rowCount: rows.length, rows });

  } catch (err) {
    console.error("❌ /api/ask — krytyczny błąd:", err);
    res.status(500).json({ error: err?.message || "Błąd serwera." });
  }
});


// ✅ Alias dla starszego frontu (POST /ask -> /api/ask)
app.post("/ask", (req, res, next) => {
  console.log("➡️ Odebrano POST /ask — przekierowuję do /api/ask");
  req.url = "/api/ask";
  app._router.handle(req, res, next);
});

// === 3️⃣ schema-query.html — user-specific files in aisql.user_schemas ===
app.post("/api/schema/upload", requireAuth, upload.single("schemaFile"), async (req, res) => {
  try {
    const simplified = await parseUploadedSchema(req.file.path);
    const fileName = `schema_${Date.now()}.json`;
    const savePath = path.join(uploadsDir, fileName);
    await fs.writeFile(savePath, JSON.stringify(simplified, null, 2));

    const userId = req.user?.id;
    if (userId) {
      await dbAuth.query(
        "INSERT INTO aisql.user_schemas (user_id, filename, path, uploaded_at) VALUES (?, ?, ?, NOW())",
        [userId, fileName, savePath]
      );
    }

    res.send(`✅ Schemat zapisany jako: ${fileName}`);
  } catch (err) {
    console.error("❌ /api/schema/upload:", err);
    res.status(400).send("Błąd przetwarzania schematu");
  } finally {
    if (req.file?.path && existsSync(req.file.path)) await fs.unlink(req.file.path);
  }
});

// Lista schematów użytkownika
app.get("/api/schema/list", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const [rows] = await dbAuth.query(
      "SELECT filename FROM aisql.user_schemas WHERE user_id = ? ORDER BY uploaded_at DESC",
      [userId]
    );
    res.json(rows.map((r) => r.filename));
  } catch (err) {
    console.error("❌ /api/schema/list:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Usuwanie schematu użytkownika
app.delete("/api/schema/delete/:name", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const [rows] = await dbAuth.query(
      "SELECT path FROM aisql.user_schemas WHERE user_id = ? AND filename = ?",
      [userId, req.params.name]
    );
    if (!rows.length) return res.status(404).send("Nie znaleziono pliku lub brak dostępu");

    const file = rows[0].path;
    if (existsSync(file)) await fs.unlink(file);
    await dbAuth.query(
      "DELETE FROM aisql.user_schemas WHERE user_id = ? AND filename = ?",
      [userId, req.params.name]
    );
    res.send(`✅ Usunięto ${req.params.name}`);
  } catch (err) {
    console.error("❌ /api/schema/delete:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// === /api/optimize — optymalizacja kodu na podstawie schematu ===
// === /api/optimize — optymalizacja kodu na podstawie schematu ===
app.post("/api/optimize", async (req, res) => {
  try {
    const { schema, code } = req.body;

    if (!schema) {
      return res.status(400).json({ error: "Brak schematu w żądaniu." });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({ error: "Brak kodu do optymalizacji." });
    }

    console.log("🧠 Odbieram żądanie optymalizacji kodu...");

    const rules = `
Jesteś ekspertem od optymalizacji kodu.
Zwracasz odpowiedź TYLKO w dwóch sekcjach:

OPTIMIZED:
(tutaj wyłącznie zoptymalizowany kod)

EXPLANATION:
(tutaj wyjaśnienia zmian)

Nie mieszaj sekcji.
Nie dodawaj żadnego dodatkowego tekstu.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: rules },
        { role: "user", content: code }
      ],
    });

    const raw = response.choices?.[0]?.message?.content || "";

    // --- Rozdzielanie sekcji ---
    const optimizedMatch = raw.match(/OPTIMIZED:\s*([\s\S]*?)(?=EXPLANATION:|$)/i);
    const explanationMatch = raw.match(/EXPLANATION:\s*([\s\S]*)/i);

    const optimized = optimizedMatch ? optimizedMatch[1].trim() : raw.trim();
    const explanation = explanationMatch ? explanationMatch[1].trim() : "Brak wyjaśnienia.";

    res.json({
      optimized,
      explanation
    });

  } catch (err) {
    console.error("❌ /api/optimize — błąd:", err);
    res.status(500).json({ error: err.message || "Błąd serwera." });
  }
});



// ✅ Alias dla starszego frontu — /optimize → /api/optimize

app.post("/optimize", (req, res, next) => {
  console.log("➡️ Odebrano POST /optimize — przekierowuję do /api/optimize");
  req.url = "/api/optimize";
  app._router.handle(req, res, next);
});


// === Diagnostyka DB ===
app.get("/ping-db", async (req, res) => {
  try {
    await dbAuth.query("SELECT 1");
    await dbData.query("SELECT 1");
    res.send("✅ Obie bazy działają");
  } catch (err) {
    res.status(500).send("❌ Błąd DB: " + err.message);
  }
});

// === Serwowanie plików statycznych ===
app.use(express.static(path.join(__dirname, "public")));

// ✅ SPA fallback — ale NIE dla API!
app.get(/^\/(?!api)(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Keep-alive DB ===
setInterval(async () => {
  try {
    await dbAuth.query("SELECT 1");
    await dbData.query("SELECT 1");
    console.log("✅ Keep-alive: połączenia z bazą aktywne");
  } catch (err) {
    console.error("⚠️ Keep-alive error:", err.message);
  }
}, 300000);

// === Start serwera ===
const PORT = process.env.PORT || 8080;
app.listen(PORT, "127.0.0.1", () =>
  console.log(`🚀 Serwer działa na http://localhost:${PORT} [${process.env.NODE_ENV || "dev"}]`)
);
