// auth.middleware.js
import passport from "passport";

// ✅ Middleware autoryzacji JWT
export function authenticate(req, res, next) {
  passport.authenticate("jwt", { session: false }, (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: "Nieautoryzowany." });
    }

    req.user = user; // ✅ user zawiera także "role" z bazy
    next();
  })(req, res, next);
}

// ✅ Middleware uprawnień — np. admin tylko dla wybranych endpointów
export function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== requiredRole) {
      return res.status(403).json({ error: "Brak uprawnień" });
    }
    next();
  };
}
