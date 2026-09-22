// /public/js/header.js

(async function autoRedirectByCountry() {
  // sprawdź czy user wybrał ręcznie język — jeśli tak, nie przełączaj
  const manualLang = localStorage.getItem("lang");
  if (manualLang) return;

  try {
    const res = await fetch("https://ipapi.co/country/");
    const country = (await res.text()).trim().toUpperCase();

    // jeśli USER NIE JEST z Polski — przełącz na EN
    if (country !== "PL") {
      // zapisz język, żeby nie wracać do PL
      localStorage.setItem("lang", "en");

      // jeśli nie jesteś na stronie EN → przekieruj
      if (!location.pathname.startsWith("/en/")) {
        const path = location.pathname === "/" ? "/index.html" : location.pathname;
        window.location.href = "/en" + path;
      }
    }
  } catch (err) {
    console.warn("GeoIP fail", err);
  }
})();

(function () {
  const qs = (sel, root = document) => root.querySelector(sel);

  async function hasSession() {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      return r.ok;
    } catch {
      return false;
    }
  }

  function setAuthUI(isAuthed) {
    const login = qs('#loginLink');
    const register = qs('#registerLink');
    const logout = qs('#logoutLink');
    const loadSchema = qs('#loadSchemaBtn');

    if (isAuthed) {
      if (login) login.style.display = 'none';
      if (register) register.style.display = 'none';
      if (logout) logout.style.display = 'inline-block';
      if (loadSchema) loadSchema.style.display = 'inline-block';
    } else {
      if (login) login.style.display = 'inline-block';
      if (register) register.style.display = 'inline-block';
      if (logout) logout.style.display = 'none';
      if (loadSchema) loadSchema.style.display = 'none';
    }
  }

  async function refreshAuthUI() {
    const authed = await hasSession();
    setAuthUI(authed);
  }

  function bindLogout() {
    const logout = qs('#logoutLink');
    if (logout && !logout.dataset.bound) {
      logout.dataset.bound = '1';
      logout.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
          });
        } finally {
          location.href = '/index.html';
        }
      });
    }
  }

  // --- Burger menu ---
  function initBurger() {
    const burger = document.getElementById('navToggle');
    const menu = document.getElementById('mainmenu');
    if (!burger || !menu) return false;

    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      menu.classList.toggle('open');
      const expanded = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!expanded));
    });

    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });

    console.log('✅ Burger menu initialized');
    return true;
  }

  async function init() {
    await refreshAuthUI();
    bindLogout();
    initBurger();
  }

  // Czekamy aż include.js wstawi header, potem inicjujemy
  document.addEventListener('DOMContentLoaded', () => {
    let ran = false;
    const runOnce = () => {
      if (ran) return;
      ran = true;
      init();
    };

    document.addEventListener('include:loaded', runOnce);
    setTimeout(runOnce, 600); // fallback jeśli event nie przyszedł
  });
})();
