// Minimalny baner cookie z localStorage; pokazuje się raz na 365 dni
(function () {
  const KEY = 'ai_sql_cookie_ok';
  const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

  // Wykrywanie języka na podstawie URL
  const path = window.location.pathname.toLowerCase();
  let lang = 'pl';
  if (path === '/en' || path === '/en/' || path.startsWith('/en/')) {
    lang = 'en';
  }

  // Teksty w PL i EN
  const texts = {
    pl: {
      msg: `Używamy plików cookie do podstawowych funkcji serwisu i analityki zanonimizowanej.
            Szczegóły w <a href="/privacy.html" style="color:#93c5fd;text-decoration:underline">Polityce prywatności</a>.`,
      accept: "Akceptuję",
      settings: "Ustawienia",
      privacyLink: "/privacy.html"
    },
    en: {
      msg: `We use cookies for essential site functions and anonymized analytics.
            Details in the <a href="/en/privacy.html" style="color:#93c5fd;text-decoration:underline">Privacy Policy</a>.`,
      accept: "Accept",
      settings: "Settings",
      privacyLink: "/en/privacy.html"
    }
  };

  const t = texts[lang] || texts.pl;

  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (stored && stored.until && Date.now() < stored.until) return;
  } catch (_) { /* ignore */ }

  const bar = document.createElement('div');
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-live', 'polite');
  bar.style.position = 'fixed';
  bar.style.left = '16px';
  bar.style.right = '16px';
  bar.style.bottom = '16px';
  bar.style.zIndex = '1400';
  bar.style.background = '#111827';
  bar.style.color = '#fff';
  bar.style.borderRadius = '12px';
  bar.style.padding = '14px';
  bar.style.boxShadow = '0 10px 28px rgba(0,0,0,.25)';
  bar.style.display = 'flex';
  bar.style.flexWrap = 'wrap';
  bar.style.alignItems = 'center';
  bar.style.gap = '10px';

  bar.innerHTML = `
    <div style="flex:1;min-width:220px;font-size:14px;line-height:1.6">
      ${t.msg}
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <button id="cc-accept" class="btn btn-primary" style="white-space:nowrap">${t.accept}</button>
      <a class="btn btn-secondary" href="${t.privacyLink}" style="white-space:nowrap">${t.settings}</a>
    </div>
  `;

  document.body.appendChild(bar);

  document.getElementById('cc-accept').addEventListener('click', () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ until: Date.now() + ONE_YEAR }));
    } catch (_) { /* ignore */ }
    bar.remove();
  });
})();
