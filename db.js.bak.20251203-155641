// === db.js — stabilne połączenia z bazami danych (MySQL2 Pool + dotenv) ===
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Pomocnicze logi
function logOk(label, value) {
  console.log(`✅ ${label}: ${value}`);
}
function logError(label, err) {
  console.error(`❌ ${label}: ${err.message || err}`);
}

// --- KONFIGURACJE ---
const dataConfig = {
  host: process.env.MYSQL_DATA_HOST || "localhost",
  user: process.env.MYSQL_DATA_USER || "root",
  password: process.env.MYSQL_DATA_PASSWORD || "",
  database: process.env.MYSQL_DATA_DATABASE || "",
  port: process.env.MYSQL_DATA_PORT ? parseInt(process.env.MYSQL_DATA_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
};

const authConfig = {
  host: process.env.MYSQL_AUTH_HOST || "localhost",
  user: process.env.MYSQL_AUTH_USER || "root",
  password: process.env.MYSQL_AUTH_PASSWORD || "",
  database: process.env.MYSQL_AUTH_DATABASE || "",
  port: process.env.MYSQL_AUTH_PORT ? parseInt(process.env.MYSQL_AUTH_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  enableKeepAlive: true,
};

// --- TWORZENIE POOLI ---
const dbData = mysql.createPool(dataConfig);
const dbAuth = mysql.createPool(authConfig);

// --- ASYNCHRONICZNY TEST POŁĄCZENIA ---
(async () => {
  try {
    await dbData.query("SELECT 1");
    logOk("Połączono z bazą danych", process.env.MYSQL_DATA_DATABASE);
  } catch (err) {
    logError("Błąd połączenia z główną bazą danych", err);
  }

  try {
    await dbAuth.query("SELECT 1");
    logOk("Połączono z bazą autoryzacyjną", process.env.MYSQL_AUTH_DATABASE);
  } catch (err) {
    logError("Błąd połączenia z bazą autoryzacyjną", err);
  }
})();

// --- ZAMYKANIE POŁĄCZEŃ ---
process.on("SIGINT", async () => {
  try {
    await dbData.end();
    await dbAuth.end();
    console.log("🛑 Zamknięto połączenia z bazami danych.");
  } catch (err) {
    console.error("❌ Błąd przy zamykaniu połączeń:", err.message);
  } finally {
    process.exit(0);
  }
});

export { dbData, dbAuth };
