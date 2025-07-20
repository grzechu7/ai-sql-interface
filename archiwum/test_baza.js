//import mysql from 'mysql2/promise';

const config = {
  host: 'mariadb11.iq.pl', // ← IP lub domena serwera MySQL
  port: 3306,
  user: 'homeso_wycena',
  password: 'Grzechu123',
  database: 'homeso_wycena'
};

(async () => {
  try {
    console.log("🔌 Próba połączenia...");
    const conn = await mysql.createConnection(connectionConfig);
    console.log("✅ Połączono z bazą!");

    const [rows] = await conn.query("SELECT NOW() AS czas");
    console.log("🕒 Serwer zwraca czas:", rows[0].czas);

    await conn.end();
    console.log("🔒 Połączenie zakończone.");
  } catch (err) {
    console.error("❌ Błąd połączenia:", err.message);
  }
})();