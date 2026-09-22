// === auth.routes.js ===
import express from "express";
import passport from "passport";
import * as authController from "./auth.controller.js";

const router = express.Router();

// ✅ Rejestracja użytkownika
router.post("/register", authController.register);

// ✅ Logowanie sesyjne (Passport Local)
router.post("/login", (req, res, next) => {
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
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: "Nieautoryzowany" });
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
