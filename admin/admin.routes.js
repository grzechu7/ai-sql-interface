// === admin.routes.js ===
// Panel administratora: raport zarejestrowanych użytkowników.
// Admini = adresy e-mail z ADMIN_EMAILS (rozdzielone przecinkami) w .env.
import express from "express";
import fs from "fs/promises";
import { dbAuth } from "../db.js";
import { requireAuth, isEnRequest } from "../middleware/requireAuth.js";

const router = express.Router();

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user) {
  return adminEmails().includes(String(user?.email || "").toLowerCase());
}

export function requireAdmin(req, res, next) {
  if (!isAdminUser(req.user)) {
    return res
      .status(403)
      .json({ error: isEnRequest(req) ? "Access denied." : "Brak uprawnień." });
  }
  next();
}

router.use(requireAuth, requireAdmin);

// Kim jestem (strona admina sprawdza dostęp tym endpointem)
router.get("/me", (req, res) => {
  res.json({ ok: true, email: req.user.email });
});

// Raport zarejestrowanych użytkowników wraz z ich schematami
router.get("/users", async (req, res) => {
  try {
    const [users] = await dbAuth.query(
      `SELECT id, full_name, email, provider, is_active, created_at
         FROM users ORDER BY created_at DESC`
    );
    const [schemas] = await dbAuth.query(
      `SELECT user_id, filename FROM user_schemas ORDER BY uploaded_at DESC`
    );
    const byUser = new Map();
    for (const s of schemas) {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id).push(s.filename);
    }
    res.json(
      users.map((u) => ({
        id: u.id,
        fullName: u.full_name,
        email: u.email,
        provider: u.provider || "password",
        isActive: !!u.is_active,
        createdAt: u.created_at,
        schemas: byUser.get(u.id) || [],
      }))
    );
  } catch (err) {
    console.error("❌ /api/admin/users:", err);
    res.status(500).json({ error: "Błąd pobierania użytkowników" });
  }
});

// Usunięcie użytkownika razem z jego schematami (pliki + wpisy)
router.delete("/users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Zły identyfikator" });
    if (id === Number(req.user.id)) {
      return res.status(400).json({ error: "Nie można usunąć własnego konta" });
    }
    const [files] = await dbAuth.query("SELECT path FROM user_schemas WHERE user_id = ?", [id]);
    for (const f of files) await fs.unlink(f.path).catch(() => {});
    await dbAuth.query("DELETE FROM user_schemas WHERE user_id = ?", [id]);
    const [r] = await dbAuth.query("DELETE FROM users WHERE id = ?", [id]);
    if (!r.affectedRows) return res.status(404).json({ error: "Nie znaleziono użytkownika" });
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ DELETE /api/admin/users:", err);
    res.status(500).json({ error: "Błąd usuwania użytkownika" });
  }
});

export default router;
