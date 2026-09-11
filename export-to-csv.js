const fs = require('fs');
const path = require('path');
const vm = require('vm');

const langDir = path.join(__dirname, 'assets/js/lang');
const outputCsvPath = path.join(__dirname, 'translations_for_sheets.csv');

function exportToCsv() {
  console.log("[DEBUG] Start exporteren naar Google Sheets vriendelijke CSV...");

  const langs = ['en', 'es', 'nl', 'fr'];
  const translations = { en: {}, es: {}, nl: {}, fr: {} };
  let allKeys = new Set();

  // Zoek alle bestanden die eindigen op .en.js om de unieke sleutels te bepalen
  if (!fs.existsSync(langDir)) {
    console.error(`[CRITICAL ERROR] Map niet gevonden: ${langDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(langDir).filter(f => f.endsWith('.en.js'));
  
  for (const file of files) {
    const baseName = file.replace('.en.js', '');
    
    // Lees alle 4 talen in voor dit bestand (bijv. garage.en.js, garage.es.js, etc.)
    for (const lang of langs) {
      const targetFile = `${baseName}.${lang}.js`;
      const filePath = path.join(langDir, targetFile);

      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const sandbox = { window: { translations: {} } };
          vm.createContext(sandbox);
          vm.runInContext(content, sandbox);

          // Zoek naar de juiste object key in window.translations
          const transObj = sandbox.window.translations;
          if (transObj) {
            // Pak de eerste property of de basenaam die erin zit
            const keyName = Object.keys(transObj)[0];
            if (keyName && transObj[keyName]) {
              if (!translations[lang][baseName]) {
                translations[lang][baseName] = {};
              }
              translations[lang][baseName] = transObj[keyName];

              // Als het om Engels gaat, registreren we alle sleutels als leidraad
              if (lang === 'en') {
                Object.keys(transObj[keyName]).forEach(k => allKeys.add(`${baseName}:${k}`));
              }
            }
          }
        } catch (err) {
          console.error(`[ERROR] Kon ${targetFile} niet inlezen:`, err.message);
        }
      }
    }
  }

  const sortedKeys = Array.from(allKeys).sort();
  console.log(`[DEBUG] Totaal aantal unieke sleutels gevonden voor export: ${sortedKeys.length}`);

  if (sortedKeys.length === 0) {
    console.error("[CRITICAL ERROR] Geen sleutels gevonden! Actie afgebroken.");
    process.exit(1);
  }

  const csvRows = [];
  csvRows.push(['key', ...langs].map(escapeCsvCell).join(','));

  for (const compositeKey of sortedKeys) {
    const [baseName, key] = compositeKey.split(':');
    const row = [compositeKey];

    for (const lang of langs) {
      const text = translations[lang] && 
                   translations[lang][baseName] && 
                   translations[lang][baseName][key] !== undefined 
                   ? translations[lang][baseName][key] 
                   : '';
      row.push(escapeCsvCell(text));
    }
    csvRows.push(row.join(','));
  }

  const csvContent = '\uFEFF' + csvRows.join('\n');
  fs.writeFileSync(outputCsvPath, csvContent, 'utf8');

  console.log(`[DEBUG] CSV succesvol weggeschreven naar: translations_for_sheets.csv`);
}

function escapeCsvCell(text) {
  if (text === null || text === undefined) return '""';
  const escaped = String(text).replace(/"/g, '""');
  return `"${escaped}"`;
}

exportToCsv();
