// auth/auth.service.js — wersja ESM z obsługą Passport (sesje MySQL)
import bcrypt from "bcrypt";
import { dbAuth } from "../db.js";
import { generateToken } from "../passport.js";

// ========================================
// REJESTRACJA użytkownika (email + hasło)
// ========================================
export async function register({ full_name, email, password }) {
  console.log("▶️ Rejestracja użytkownika:", { full_name, email });

  if (!email || !password) {
    throw new Error("Adres e-mail i hasło są wymagane.");
  }

  // Sprawdź, czy istnieje użytkownik o tym e-mailu
  const [existing] = await dbAuth.query(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );
  if (existing.length > 0) {
    throw new Error("Użytkownik o tym e-mailu już istnieje.");
  }

  // Haszowanie hasła
  const password_hash = await bcrypt.hash(password, 12);

  // Dodaj użytkownika do tabeli users
  const [userRes] = await dbAuth.query(
    "INSERT INTO users (email, full_name) VALUES (?, ?)",
    [email, full_name || null]
  );

  const userId = userRes.insertId;

  // Dodaj dane autoryzacyjne do auth_providers
  await dbAuth.query(
    `INSERT INTO auth_providers 
     (user_id, provider, email, password_hash) 
     VALUES (?, 'email', ?, ?)`,
    [userId, email, password_hash]
  );

  console.log(`✅ Utworzono użytkownika #${userId} (${email})`);
  return { id: userId, email, full_name };
}

// ========================================
// LOGOWANIE użytkownika (email + hasło)
// ========================================
export async function login({ email, password }) {
  console.log("▶️ Logowanie użytkownika:", email);

  if (!email || !password) {
    throw new Error("Brak e-maila lub hasła.");
  }

  const [rows] = await dbAuth.query(
    `SELECT u.id, u.email, u.full_name, a.password_hash
     FROM users u
     JOIN auth_providers a ON u.id = a.user_id
     WHERE a.provider = 'email' AND u.email = ?`,
    [email]
  );

  if (!rows.length) {
    throw new Error("Nie znaleziono użytkownika o tym e-mailu.");
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    throw new Error("Nieprawidłowe hasło.");
  }

  console.log(`✅ Zalogowano użytkownika: ${email}`);
  // Tu zwracamy obiekt user — Passport zajmuje się sesją
  return { id: user.id, email: user.email, full_name: user.full_name };
}

// ========================================
// POBRANIE użytkownika po ID (dla /me)
// ========================================
export async function getUserById(id) {
  const [rows] = await dbAuth.query(
    "SELECT id, email, full_name FROM users WHERE id = ?",
    [id]
  );

  if (!rows.length) {
    throw new Error("Użytkownik nie istnieje.");
  }

  return rows[0];
}

// ========================================
// GOOGLE OAUTH 2.0 (login lub rejestracja)
// ========================================
export async function findOrCreateGoogleUser(profile) {
  const email = profile.emails?.[0]?.value;
  const googleId = profile.id;
  const full_name = profile.displayName;
  const avatar_url = profile.photos?.[0]?.value || null;

  if (!email) throw new Error("Brak adresu e-mail w profilu Google.");

  console.log("▶️ Logowanie Google:", email);

  // Szukamy użytkownika po Google ID
  const [existing] = await dbAuth.query(
    `SELECT u.* FROM users u
     JOIN auth_providers a ON u.id = a.user_id
     WHERE a.provider = 'google' AND a.provider_user_id = ?`,
    [googleId]
  );

  if (existing.length > 0) {
    console.log(`✅ Zalogowano Google: ${email}`);
    return existing[0];
  }

  // Sprawdź, czy istnieje użytkownik z tym samym e-mailem
  const [byEmail] = await dbAuth.query(
    "SELECT id FROM users WHERE email = ?",
    [email]
  );

  let userId;
  if (byEmail.length > 0) {
    userId = byEmail[0].id;
  } else {
    const [newUser] = await dbAuth.query(
      "INSERT INTO users (email, full_name, avatar_url) VALUES (?, ?, ?)",
      [email, full_name, avatar_url]
    );
    userId = newUser.insertId;
  }

  // Powiąż konto Google z użytkownikiem
  await dbAuth.query(
    `INSERT INTO auth_providers 
     (user_id, provider, provider_user_id, email) 
     VALUES (?, 'google', ?, ?)`,
    [userId, googleId, email]
  );

  console.log(`✅ Utworzono konto Google dla ${email}`);
  const [user] = await dbAuth.query("SELECT * FROM users WHERE id = ?", [userId]);
  return user[0];
}
