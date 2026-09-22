/*!
 * i18n.js – auto-detekcja języka + szybka inicjalizacja
 * - Źródło tłumaczeń: /i18n/{lang}.json
 * - Wybór języka: ?lang= → localStorage → <html data-lang-boot> → navigator.languages
 * - Zapamiętanie w localStorage('lang')
 * - Aktualizacja dropdownu: .lang-current .code + .flag-img (pl.svg/gb.svg)
 */
(function () {
  const STORAGE_KEY = 'lang';
  const FALLBACK = 'pl';
  let dict = {};

  const norm = (lang) => {
    lang = (lang || '').toLowerCase();
    if (lang.startsWith('pl')) return 'pl';
    if (lang.startsWith('en')) return 'en';
    return FALLBACK;
  };

  async function load(lang) {
    const res = await fetch(`/i18n/${lang}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`i18n: cannot load ${lang}`);
    dict = await res.json();
  }

  function t(key) {
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
  }

  function current() {
    return document.documentElement.getAttribute('lang') || FALLBACK;
  }

  function detect() {
    const q = new URLSearchParams(location.search).get('lang');
    const saved = localStorage.getItem(STORAGE_KEY);
    const boot = document.documentElement.dataset.langBoot;
    const navs = (navigator.languages && navigator.languages.length)
      ? navigator.languages[0]
      : (navigator.language || 'en');
    return norm(q || saved || boot || navs);
  }

  function applyToDom() {
    // atrybut <html lang="">
    document.documentElement.setAttribute('lang', current());

    // podmiana treści/atrybutów
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (!val) return;
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) el.setAttribute(attr, val);
      else if (key.endsWith('.body')) el.innerHTML = val;
      else el.textContent = val;
    });

    // aktualizacja przycisku języka (kod + flaga)
    const codeEl = document.querySelector('.lang-current .code');
    const imgEl  = document.querySelector('.lang-current .flag-img');
    const lang = current();
    if (codeEl) codeEl.textContent = lang.toUpperCase();
    if (imgEl) {
      imgEl.src = lang === 'pl' ? '/img/flags/pl.svg' : '/img/flags/gb.svg';
      imgEl.alt = lang.toUpperCase();
    }

    // odsłoń treści jeśli były ukryte (anti-flash)
    document.body.classList.remove('i18n-wait');
  }

  async function setLang(lang, opts = {}) {
    const safe = norm(lang);
    document.documentElement.setAttribute('lang', safe);
    if (!opts.noPersist) localStorage.setItem(STORAGE_KEY, safe);
    await load(safe);
    applyToDom();
    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: safe } }));
  }

  async function init() {
    try {
      const initial = detect();
      // Jeśli nic nie było w localStorage – pierwszy raz: zapisz
      const had = !!localStorage.getItem(STORAGE_KEY);
      await setLang(initial, { noPersist: false });
      // nasłuch kliknięć w elementy z data-lang (np. lista w dropdownie)
      document.querySelectorAll('[data-lang]').forEach((el) => {
        el.addEventListener('click', () => setLang(el.getAttribute('data-lang')));
      });
    } catch (e) {
      console.error('i18n init error:', e);
      // awaryjnie ładujemy fallback
      try {
        await setLang(FALLBACK, { noPersist: true });
      } catch {}
    }
  }

  // API
  window.i18n = {
    init,
    setLang,
    t,
    getCurrent: current,
    apply: applyToDom,
  };

  // auto-start natychmiast, bez czekania na kliknięcie
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
