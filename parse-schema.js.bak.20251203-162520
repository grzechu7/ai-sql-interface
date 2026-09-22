// parse-schema.js

import fs from 'fs/promises';

/**
 * Parsuje plik JSON – obsługuje:
 * 1. prosty format: { tabela: [kolumny] }
 * 2. Oracle-style: { items: [...] }
 * 3. phpMyAdmin-style: [ { type: "table", name: "COLUMNS", data: [...] } ]
 * 4. Zepsute JSON-y z Oracle – ręczne wyciąganie "items"
 */
export async function parseUploadedSchema(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');

  let parsed;

  // 🧪 najpierw spróbuj pełnego JSON-a
  try {
    parsed = JSON.parse(raw);

    // 1️⃣ Prosty format: { tabela: [kolumny] }
    const isSimple =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
      Object.values(parsed).every(
        val => Array.isArray(val) && val.every(v => typeof v === 'string')
      );
    if (isSimple) return normalizeToTables(parsed);

    // 2️⃣ Oracle-style: { items: [...] }
    if (parsed.items && Array.isArray(parsed.items)) {
      return normalizeToTables(simplifyItems(parsed.items, 'table_name', 'column_name'));
    }

    // 3️⃣ phpMyAdmin export
    if (Array.isArray(parsed)) {
      const columnsEntry = parsed.find(
        entry => entry.type === 'table' && entry.name === 'COLUMNS' && Array.isArray(entry.data)
      );
      if (columnsEntry) {
        return normalizeToTables(simplifyItems(columnsEntry.data, 'TABLE_NAME', 'COLUMN_NAME'));
      }
    }
  } catch (err) {
    // ❌ nie udało się sparsować całego pliku — lecimy dalej
  }

  // 4️⃣ Awaryjnie próbujemy wyciągnąć "items" ręcznie z tekstu
  const itemsMatch = raw.match(/"items"\s*:\s*\[(.*?)\](?=\s*[},\]])/s);
  if (itemsMatch) {
    const itemsJson = `[${itemsMatch[1]}]`.replace(/,\s*$/, '');
    try {
      const itemsArray = JSON.parse(itemsJson);
      return normalizeToTables(simplifyItems(itemsArray, 'table_name', 'column_name'));
    } catch (err) {
      throw new Error(`Znaleziono "items", ale JSON nadal błędny: ${err.message}`);
    }
  }

  throw new Error('Nie rozpoznano struktury pliku JSON.');
}

// 🔁 Przekształca tablicę do { tabela: [kolumny] }
function simplifyItems(items, tableKey, columnKey) {
  const simplified = {};
  const clean = str => str?.toString().trim().replace(/^['"]+|['"]+$/g, '') || '';

  for (const item of items) {
    const table = clean(item[tableKey]);
    const column = clean(item[columnKey]);
    if (!table || !column) continue;

    if (!simplified[table]) simplified[table] = [];
    if (!simplified[table].includes(column)) {
      simplified[table].push(column);
    }
  }

  return simplified;
}

// 📦 Konwertuje { tabela: [kolumny] } do { tables: [{name, columns:[{name,type}]}] }
function normalizeToTables(map) {
  const tables = Object.entries(map).map(([name, cols]) => ({
    name,
    columns: cols.map(c => ({ name: c, type: 'TEXT' }))
  }));
  return { tables };
}
