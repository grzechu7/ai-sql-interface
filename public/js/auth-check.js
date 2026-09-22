document.addEventListener("DOMContentLoaded", () => {

  console.log("🟡 [auth-check] załadowano skrypt auth-check.js");

  // === Sprawdzenie logowania przez sesję Passport ===
  async function isUserLoggedIn() {
    console.log("🟡 [auth-check] sprawdzam sesję użytkownika przez /api/auth/me");
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      console.log("🔍 [auth-check] status odpowiedzi:", res.status);

      if (!res.ok) return false;

      const data = await res.json();
      console.log("✅ [auth-check] dane sesji:", data);
      return !!data?.user;
    } catch (err) {
      console.warn("❌ [auth-check] błąd sprawdzania sesji:", err);
      return false;
    }
  }

  // === Modal logowania ===
  function showAuthModal() {
    if (document.querySelector(".auth-modal")) return;
    const modalHTML = `
      <div class="auth-modal" style="
        position: fixed; inset: 0;
        background: rgba(15,23,42,0.65);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999;">
        <div style="
          background: white; padding: 32px; border-radius: 16px;
          max-width: 420px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
          <h2 style="margin-bottom: 16px; color:#0f172a;">Wymagane logowanie</h2>
          <p style="margin-bottom: 24px; color:#334155;">
            Aby wgrać własny schemat bazy danych, musisz być zalogowany.
          </p>
          <div style="display:flex; gap:12px; justify-content:center;">
            <a href="/login.html" class="btn btn-primary" style="padding:10px 16px; background:#2563eb; color:#fff; border-radius:8px; text-decoration:none;">Zaloguj się</a>
            <a href="/register.html" class="btn btn-secondary" style="padding:10px 16px; background:#e2e8f0; color:#0f172a; border-radius:8px; text-decoration:none;">Utwórz konto</a>
          </div>
          <button id="auth-modal-close" style="margin-top:20px; background:none; border:none; color:#64748b; cursor:pointer;">Anuluj</button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
    document.getElementById("auth-modal-close").addEventListener("click", () => {
      document.querySelector(".auth-modal").remove();
    });
  }

  // === Kliknięcia w link „Załaduj schemat” ===
  document.body.addEventListener("click", async (e) => {
    const link = e.target.closest("a[href='/schema-query.html']");
    if (link) {
      console.log("🟠 [auth-check] kliknięto Załaduj schemat — sprawdzam sesję...");
      const loggedIn = await isUserLoggedIn();
      console.log("🔸 [auth-check] wynik sprawdzenia sesji:", loggedIn);
      if (!loggedIn) {
        e.preventDefault();
        showAuthModal();
      }
    }
  });

  // === Dodatkowe zabezpieczenie przy wejściu bezpośrednim ===
  (async () => {
    if (window.location.pathname.endsWith("/schema-query.html")) {
      console.log("🟣 [auth-check] bezpośrednie wejście na /schema-query.html");
      const loggedIn = await isUserLoggedIn();
      if (!loggedIn) {
        console.log("🚫 [auth-check] brak sesji — przekierowanie na login.html");
        window.location.href = "/login.html";
      } else {
        console.log("✅ [auth-check] sesja aktywna — zostajemy na stronie");
      }
    }
  })();

});
