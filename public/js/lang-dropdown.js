// Proste menu języka oparte na i18n.js
document.addEventListener('DOMContentLoaded', () => {
  const menu = document.getElementById('langMenu');
  if (!menu) return;

  const btn   = menu.querySelector('.lang-current');
  const list  = menu.querySelector('.lang-list');
  const code  = document.getElementById('langCode');
  const flag  = document.getElementById('langFlag');

  function reflect(lang) {
    const L = (lang || 'pl').toLowerCase();
    code.textContent = L.toUpperCase();
    flag.src = L === 'en' ? '/img/flags/gb.svg' : '/img/flags/pl.svg';
    flag.alt = code.textContent;
    document.documentElement.lang = L;
  }

  // startowy stan na podstawie i18n
  try { reflect(window.i18n && i18n.getCurrent ? i18n.getCurrent() : 'pl'); } catch(_) {}

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', menu.classList.contains('open') ? 'true' : 'false');
  });

  list.addEventListener('click', async (e) => {
    const li = e.target.closest('li[data-lang]');
    if (!li) return;
    const lang = li.getAttribute('data-lang');
    try {
      if (window.i18n && i18n.change) {
        await i18n.change(lang);   // przeładuje słownik i podmieni DOM
      }
      reflect(lang);
    } catch (err) {
      console.error('change lang error:', err);
    } finally {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('click', () => {
    if (menu.classList.contains('open')) {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
});
