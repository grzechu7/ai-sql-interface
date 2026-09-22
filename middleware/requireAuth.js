// === middleware/requireAuth.js ===
// Middleware sprawdzające, czy użytkownik jest zalogowany (sesja Passport)

export function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Nieautoryzowany. Zaloguj się ponownie." });
}

// (opcjonalnie) — middleware do wymuszania konkretnej roli użytkownika
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.isAuthenticated || !req.user) {
      return res.status(401).json({ error: "Nieautoryzowany." });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ error: "Brak uprawnień." });
    }

    next();
  };
}
