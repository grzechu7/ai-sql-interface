// === auth/auth.controller.js — wersja końcowa z sesją Passport ===
import passport from "passport";
import bcrypt from "bcrypt";
import { dbAuth } from "../db.js";

// ========================================
// 🔹 Rejestracja użytkownika (tabela `users`)
// ========================================
export async function register(req, res) {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email i hasło są wymagane." });
    }

    // Sprawdź, czy użytkownik już istnieje
    const [existing] = await dbAuth.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) {
      return res.status(400).json({ error: "Użytkownik o tym adresie email już istnieje." });
    }

    // Hash hasła
    const password_hash = await bcrypt.hash(password, 10);

    // Zapis do tabeli `users`
    const [result] = await dbAuth.query(
      `INSERT INTO users (email, password_hash, full_name, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 1, NOW(), NOW())`,
      [email, password_hash, full_name || null]
    );

    console.log(`🆕 Zarejestrowano użytkownika: ${email} (id=${result.insertId})`);

    // Zwróć potwierdzenie
    res.status(201).json({
      message: "✅ Użytkownik zarejestrowany pomyślnie",
      user: { id: result.insertId, email },
    });
  } catch (err) {
    console.error("❌ Błąd podczas rejestracji:", err);
    res.status(500).json({ error: "Błąd serwera podczas rejestracji użytkownika." });
  }
}

// ========================================
// 🔹 Logowanie użytkownika (Passport + sesja cookie aisql.sid)
// ========================================
export function login(req, res, next) {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user)
      return res
        .status(401)
        .json({ error: info?.message || "❌ Nieprawidłowe dane logowania." });

    req.login(user, (err) => {
      if (err) return next(err);

      console.log(`🔐 Użytkownik zalogowany: ${user.email} (id=${user.id})`);

      // Sesja Passporta utworzona — cookie aisql.sid ustawione automatycznie
      return res.json({
        ok: true,
        message: "✅ Zalogowano pomyślnie",
        user: { id: user.id, email: user.email },
      });
    });
  })(req, res, next);
}

// ========================================
// 🔹 Wylogowanie (usuwa sesję i cookie aisql.sid)
// ========================================
export function logout(req, res) {
  req.logout((err) => {
    if (err) {
      console.error("❌ Błąd wylogowania:", err);
      return res.status(500).json({ error: "Błąd podczas wylogowywania" });
    }

    req.session.destroy(() => {
      res.clearCookie("aisql.sid");
      res.json({ message: "✅ Wylogowano pomyślnie" });
    });
  });
}

// ========================================
// 🔹 Dane zalogowanego użytkownika (req.user z Passporta)
// ========================================
export async function getProfile(req, res) {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: "❌ Nieautoryzowany — zaloguj się ponownie." });
    }

    const user = req.user;
    res.json({ user });
  } catch (err) {
    console.error("❌ Błąd pobierania profilu:", err);
    res.status(400).json({ error: err.message });
  }
}

// ========================================
// 🔹 Callback Google OAuth
// ========================================
export async function googleCallback(req, res) {
  try {
    const user = req.user;
    console.log(`🔑 Zalogowano przez Google: ${user?.email}`);
    res.redirect("/schema-query.html");
  } catch (err) {
    console.error("❌ Błąd logowania przez Google:", err);
    res.redirect("/login.html?error=google");
  }
}
