import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFilePath = path.join(__dirname, 'Oracle_kurs.json');
const outputDir = path.join(__dirname, 'uploads');
const outputFileName = `schema_${Date.now()}.json`;
const outputPath = path.join(outputDir, outputFileName);

function clean(value) {
  return value?.toString().trim().replace(/^['"]+|['"]+$/g, '') || '';
}

// 🧠 Wyciąga i przetwarza tylko tablicę "items"
async function parseSchema() {
  try {
    const raw = await fs.readFile(inputFilePath, 'utf-8');

    const itemsMatch = raw.match(/"items"\s*:\s*\[(.*?)\](?=\s*[},\]])/s);
    if (!itemsMatch) throw new Error('Nie znaleziono poprawnej tablicy "items" w pliku.');

    const itemsJson = `[${itemsMatch[1]}]`;

    let itemsArray;
    try {
      itemsArray = JSON.parse(itemsJson.replace(/,\s*$/, '')); // usuń ewentualny przecinek na końcu
    } catch (err) {
      throw new Error(`Nieprawidłowa tablica "items": ${err.message}`);
    }

    const simplified = {};

    for (const entry of itemsArray) {
      const table = clean(entry.table_name);
      const column = clean(entry.column_name);

      if (!table || !column) continue;

      if (!simplified[table]) simplified[table] = [];
      if (!simplified[table].includes(column)) {
        simplified[table].push(column);
        console.log(`📄 [${table}] + ${column}`);
      }
    }

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(simplified, null, 2), 'utf-8');

    console.log(`\n✅ Schemat zapisany jako:\n→ ${outputPath}\n`);
    console.log('📦 Finalna struktura:\n', JSON.stringify(simplified, null, 2));
  } catch (err) {
    console.error('\n❌ Błąd:', err.message);
  }
}

parseSchema();
