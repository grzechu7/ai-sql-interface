const mysql = import("mysql2/promise");

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'mariadb11.iq.pl', // ← IP lub domena serwera MySQL
      port: 3306,
      user: 'homeso_wycena',
      password: 'Grzechu123',
      database: 'homeso_wycena'
    });

    console.log("✅ Połączono!");
    const [rows] = await conn.query("SELECT NOW()");
    console.log("🕒 Czas serwera:", rows[0]);
    await conn.end();
  } catch (err) {
    console.error("❌ Błąd:", err.message);
  }
})();