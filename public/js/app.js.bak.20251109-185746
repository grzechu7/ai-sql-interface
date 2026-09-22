/* ============================================================================
 * app.js – logika aplikacji (bez obsługi dropdownu – to aut. robi <details>)
 * Wymaga: i18n.js
 * ==========================================================================*/
(() => {
  const els = {
    q: document.getElementById('q'),
    loading: document.getElementById('loading'),
    sqlBox: document.getElementById('sql'),
    resultBox: document.getElementById('result'),
    sqlSection: document.getElementById('sqlSection'),
    resultSection: document.getElementById('resultSection'),
    rowCount: document.getElementById('rowCount'),
  };

  const i18nApi = window.i18n || {};
  const getLang = () => (typeof i18nApi.getCurrent === 'function' ? i18nApi.getCurrent() : 'pl');

  const RUNTIME = {
    pl: {
      enterQuestion: 'Wpisz pytanie przed wysłaniem.',
      loading: '⏳ Generuję SQL i wykonuję zapytanie...',
      noData: 'Brak danych', rows: 'wierszy',
      copied: 'Skopiowano SQL do schowka.',
      connectError: 'Nie udało się połączyć z serwerem.'
    },
    en: {
      enterQuestion: 'Type a question before sending.',
      loading: '⏳ Generating SQL and executing the query...',
      noData: 'No data', rows: 'rows',
      copied: 'SQL copied to clipboard.',
      connectError: 'Failed to connect to the server.'
    }
  };
  const rt = (k) => (RUNTIME[getLang()]?.[k]) ?? RUNTIME.pl[k] ?? k;

  async function ask() {
    const question = els.q?.value.trim();
    if (!question) return toast(rt('enterQuestion'));

    els.sqlBox.textContent = '';
    els.resultBox.innerHTML = '';
    els.rowCount.textContent = '';
    els.sqlSection.style.display = 'none';
    els.resultSection.style.display = 'none';
    els.loading.textContent = rt('loading');

    try {
      const resp = await fetch(`${window.location.origin}/api/ask-tmp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      const data = await resp.json();
      if (data.error) return toast(data.error);

      if (data.sqlFileId) {
        const sqlResp = await fetch(`${window.location.origin}/api/sql/${encodeURIComponent(data.sqlFileId)}`);
        els.sqlBox.textContent = await sqlResp.text();
        els.sqlSection.style.display = 'block';
      }

      const rows = data.rows || [];
      els.rowCount.textContent = rows.length ? `${rows.length} ${rt('rows')}` : rt('noData');
      els.resultBox.innerHTML = renderTable(rows);
      els.resultSection.style.display = 'block';
      els.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      console.error(e); toast(rt('connectError'));
    } finally {
      els.loading.textContent = '';
    }
  }

  function clearAll() {
    if (els.q) els.q.value = '';
    els.sqlBox.textContent = '';
    els.resultBox.innerHTML = '';
    els.loading.textContent = '';
    els.rowCount.textContent = '';
    els.sqlSection.style.display = 'none';
    els.resultSection.style.display = 'none';
  }

  function renderTable(rows) {
    if (!rows?.length) return `<div class="empty">${escapeHtml(rt('noData'))}</div>`;
    const cols = Object.keys(rows[0]);
    const thead = '<thead><tr>' + cols.map(c => `<th>${escapeHtml(c)}</th>`).join('') + '</tr></thead>';
    const tbody = '<tbody>' + rows.map(r =>
      '<tr>' + cols.map(c => `<td>${escapeHtml(r[c])}</td>`).join('') + '</tr>'
    ).join('') + '</tbody>';
    return `<div class="table-scroll"><table>${thead}${tbody}</table></div>`;
  }

  const escapeHtml = (s) => (s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));

  function copySql() {
    const code = els.sqlBox.textContent || '';
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => toast(rt('copied')));
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); t.remove(); }, 3000);
  }

  window.ask = ask;
  window.clearAll = clearAll;
  window.copySql = copySql;
})();
