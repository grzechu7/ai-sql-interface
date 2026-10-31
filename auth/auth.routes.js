// === auth.routes.js ===
import express from "express";
import rateLimit from "express-rate-limit";
import passport from "passport";
import * as authController from "./auth.controller.js";
import { isAdminUser } from "../admin/admin.routes.js";
import { unauthorizedMsg } from "../middleware/requireAuth.js";

const router = express.Router();

// Limity przeciw masowej rejestracji i zgadywaniu haseł (per IP)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zbyt wiele prób rejestracji. Spróbuj ponownie później." },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut." },
});

// ✅ Rejestracja użytkownika
router.post("/register", registerLimiter, authController.register);

// ✅ Logowanie sesyjne (Passport Local)
router.post("/login", loginLimiter, (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      return res
        .status(401)
        .json({ error: info?.message || "Nieprawidłowe dane logowania" });
    }

    // Logowanie użytkownika (tworzy sesję + cookie aisql.sid)
    req.login(user, (err) => {
      if (err) return next(err);

      // 👇 ważne: wyślij cookie (HTTP-only, ustawione przez express-session)
      res
        .status(200)
        .json({
          ok: true,
          user: { id: user.id, email: user.email },
          message: "Zalogowano pomyślnie",
        });
    });
  })(req, res, next);
});

// ✅ Wylogowanie — niszczy sesję i cookie aisql.sid
router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("❌ Błąd logout:", err);
      return res.status(500).json({ error: "Błąd wylogowania" });
    }

    req.session.destroy(() => {
      res.clearCookie("aisql.sid", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      });
      res.json({ ok: true, message: "Wylogowano pomyślnie" });
    });
  });
});

// ✅ Dane aktualnego użytkownika (sprawdzenie sesji)
router.get("/me", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const { password_hash, ...user } = req.user;
    res.json({ user, isAdmin: isAdminUser(req.user) });
  } else {
    res.status(401).json({ error: unauthorizedMsg(req) });
  }
});

// ✅ Google OAuth (opcjonalne, bez zmian)
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  authController.googleCallback
);

export default router;
