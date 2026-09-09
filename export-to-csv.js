const fs = require('fs');
const path = require('path');

const langDir = path.join(__dirname, 'assets/js/lang');
const outputCsvPath = path.join(__dirname, 'translations_for_sheets.csv');

function exportToCsv() {
  console.log("[DEBUG] Start exporteren naar Google Sheets vriendelijke CSV...");

  const langs = ['en', 'es', 'nl', 'fr'];
  const translations = {};
  let allKeys = new Set();

  // 1. Lees alle bestaande taalbestanden in
  for (const lang of langs) {
    const filePath = path.join(langDir, `${lang}.js`);
    if (fs.existsSync(filePath)) {
      try {
        // Simuleer een globale window omgeving om het bestand veilig in te lezen
        const window = {};
        sandboxEval(filePath, window);
        if (window.translations && window.translations[lang]) {
          translations[lang] = window.translations[lang];
          Object.keys(window.translations[lang]).forEach(k => allKeys.add(k));
        }
      } catch (err) {
        console.error(`[ERROR] Kon ${lang}.js niet inlezen:`, err.message);
      }
    }
  }

  const sortedKeys = Array.from(allKeys).sort();
  console.log(`[DEBUG] Totaal aantal unieke sleutels gevonden voor export: ${sortedKeys.length}`);

  // 2. Bouw de CSV rijen op
  // Header: key, en, es, nl, fr
  const csvRows = [];
  csvRows.push(['key', ...langs].map(escapeCsvCell).join(','));

  for (const key of sortedKeys) {
    const row = [key];
    for (const lang of langs) {
      const text = translations[lang] && translations[lang][key] ? translations[lang][key] : '';
      row.push(escapeCsvCell(text));
    }
    csvRows.push(row.join(','));
  }

  // 3. Schrijf weg met UTF-8 BOM zodat Excel en Google Sheets speciale tekens direct juist herkennen
  const csvContent = '\uFEFF' + csvRows.join('\n');
  fs.writeFileSync(outputCsvPath, csvContent, 'utf8');

  console.log(`[DEBUG] CSV succesvol weggeschreven naar: translations_for_sheets.csv`);
}

function sandboxEval(filePath, window) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Voer de code uit in een geïsoleerde context waar 'window' beschikbaar is
  const fn = new Function('window', content);
  fn(window);
}

function escapeCsvCell(text) {
  if (text === null || text === undefined) return '""';
  // Vervang eventuele bestaande dubbele aanhalingstekens door dubbele escape quotes
  const escaped = String(text).replace(/"/g, '""');
  return `"${escaped}"`;
}

exportToCsv();
