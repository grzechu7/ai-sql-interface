// passport.js
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

// 🟢 używamy tego samego poola co server.js  
import { dbAuth } from "./db.js";

// =======================================
// 🔹 Strategia lokalna (email + hasło)
// =======================================
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const [rows] = await dbAuth.query(
          `SELECT id, email, password_hash FROM users WHERE email = ?`,
          [email]
        );

        if (!rows.length) {
          return done(null, false, { message: "Nie znaleziono użytkownika" });
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash || "");

        if (!isMatch) {
          return done(null, false, { message: "Błędne hasło" });
        }

        return done(null, user);
      } catch (err) {
        console.error("❌ Błąd LocalStrategy:", err);
        return done(err);
      }
    }
  )
  
);

// =======================================
// 🔹 Strategia Google OAuth (OSOBNO!)
// =======================================
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      console.log("🔵 Google profile:", JSON.stringify(profile, null, 2));
        console.log("--- ODEBRANY PROFIL Z GOOGLE ---");
      console.log(profile);
      console.log("accessToken:", accessToken);
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(null, false, { message: "Google nie zwróciło emaila" });
        }

        const [rows] = await dbAuth.query(
          "SELECT * FROM users WHERE email = ?",
          [email]
        );

        let user;

        if (rows.length) {
          user = rows[0]; // istnieje
        } else {
          const fullName = profile.displayName || null;

          const [result] = await dbAuth.query(
            `INSERT INTO users (email, full_name, provider)
             VALUES (?, ?, 'google')`,
            [email, fullName]
          );

          user = {
            id: result.insertId,
            email,
            full_name: fullName,
            provider: "google",
          };
        }

        return done(null, user);
      } catch (err) {
        console.error("❌ Błąd GoogleStrategy:", err);
        return done(err);
      }
    }
  )
);

// =======================================
// 🔹 Sesja Passport (pool = OK)
// =======================================
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await dbAuth.query("SELECT * FROM users WHERE id = ?", [id]);
    if (!rows.length) return done(null, false);
    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});

export default passport;
