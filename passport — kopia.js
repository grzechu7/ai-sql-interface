// passport.js — wersja ESM dla Oracle Cloud z osobną bazą AISQL
import passport from "passport";
import {
  Strategy as LocalStrategy
} from "passport-local";
import {
  Strategy as GoogleStrategy
} from "passport-google-oauth20";
import {
  Strategy as JwtStrategy,
  ExtractJwt
} from "passport-jwt";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// === Połączenie z bazą AISQL ===
let dbAuth;

try {
  dbAuth = await mysql.createConnection({
    host: process.env.MYSQL_AUTH_HOST || process.env.MYSQL_HOST,
    port: process.env.MYSQL_AUTH_PORT || process.env.MYSQL_PORT,
    user: process.env.MYSQL_AUTH_USER || process.env.MYSQL_USER,
    password: process.env.MYSQL_AUTH_PASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_AUTH_DATABASE || process.env.MYSQL_DATABASE,
  });
  console.log(
    `✅ [passport.js] Połączono z bazą autoryzacyjną: ${
      process.env.MYSQL_AUTH_DATABASE || process.env.MYSQL_DATABASE
    }`
  );
} catch (err) {
  console.error("❌ [passport.js] Błąd połączenia z bazą AISQL:", err.message);
}

// === Strategia lokalna (email + hasło) ===
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const [rows] = await dbAuth.execute(
          `SELECT u.id, u.email, a.password_hash
           FROM users u
           JOIN auth_providers a ON u.id = a.user_id
           WHERE a.provider = 'email' AND u.email = ?`,
          [email]
        );

        if (!rows.length) {
          return done(null, false, { message: "Nie znaleziono użytkownika" });
        }

        const user = rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return done(null, false, { message: "Błędne hasło" });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);


// === Strategia Google OAuth 2.0 ===
passport.use(
  new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const [rows] = await dbAuth.execute("SELECT * FROM users WHERE google_id = ?", [
          profile.id,
        ]);
        let user = rows[0];

        if (!user) {
          const [result] = await dbAuth.execute(
            "INSERT INTO users (email, google_id, name) VALUES (?, ?, ?)",
            [profile.emails[0].value, profile.id, profile.displayName]
          );
          user = {
            id: result.insertId,
            email: profile.emails[0].value,
            name: profile.displayName,
          };
        }

        return done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

// === Strategia JWT ===
const jwtOpts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || "Grzechu123$%", // dopasuj do .env
};

passport.use(
  new JwtStrategy(jwtOpts, async (jwt_payload, done) => {
    try {
      const [rows] = await dbAuth.execute("SELECT id, email FROM users WHERE id = ?", [
        jwt_payload.id,
      ]);
      if (!rows.length) return done(null, false);
      return done(null, rows[0]);
    } catch (err) {
      return done(err, false);
    }
  })
);

// === JWT generowanie tokenu ===
export function generateToken(user) {
  return jwt.sign({
    id: user.id,
    email: user.email
  }, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });
}

// === Serializacja sesji (opcjonalna, do Google) ===
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await dbAuth.execute("SELECT * FROM users WHERE id = ?", [id]);
    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});

export default passport;