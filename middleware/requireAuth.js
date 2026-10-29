// === middleware/requireAuth.js ===
// Middleware sprawdzające, czy użytkownik jest zalogowany (sesja Passport)

// Czy żądanie przyszło ze strony angielskiej (/en/...) — po nagłówku Referer
export function isEnRequest(req) {
  try {
    return /^\/en(\/|$)/.test(new URL(req.get("referer") || "").pathname);
  } catch {
    return false;
  }
}

// Komunikat 401 w języku strony, z której przyszło żądanie
export function unauthorizedMsg(req) {
  return isEnRequest(req)
    ? "Unauthorized. Please log in again."
    : "Nieautoryzowany. Zaloguj się ponownie.";
}

export function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: unauthorizedMsg(req) });
}

// (opcjonalnie) — middleware do wymuszania konkretnej roli użytkownika
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.isAuthenticated || !req.user) {
      return res.status(401).json({ error: unauthorizedMsg(req) });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ error: isEnRequest(req) ? "Access denied." : "Brak uprawnień." });
    }

    next();
  };
}
