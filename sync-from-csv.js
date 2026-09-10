const fs = require('fs');
const path = require('path');
const deepl = require('deepl-node');

const authKey = "abcc2e01-6f44-49ef-b1b2-684f8c0908eb:fx"; 
const translator = new deepl.Translator(authKey);
const langDir = path.join(__dirname, 'assets/js/lang');
const csvFilePath = path.join(__dirname, 'translations-master.csv');
const rootDir = __dirname;

function getKeysFromHtmlFiles() {
  const usedKeys = new Set();
  
  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (file !== 'assets' && file !== 'node_modules' && file !== '.git') {
          scanDir(fullPath);
        }
      } else if (file.endsWith('.html')) {
        const htmlContent = fs.readFileSync(fullPath, 'utf8');
        const matches = htmlContent.matchAll(/data-i18n=["']([^"']+)["']/g);
        for (const match of matches) {
          usedKeys.add(match[1]);
        }
      }
    }
  }

  scanDir(rootDir);
  return usedKeys;
}

async function syncFromCsv() {
  console.log("[DEBUG] Start synchronisatiescript met robuuste CSV-parser en debug...");

  if (!fs.existsSync(csvFilePath)) {
    console.error("[DEBUG] FOUT: Geen CSV-bestand gevonden op:", csvFilePath);
    return;
  }

  const activeHtmlKeys = getKeysFromHtmlFiles();
  console.log(`[DEBUG] Aantal unieke sleutels gevonden in HTML-bestanden: ${activeHtmlKeys.size}`);

  const csvContent = fs.readFileSync(csvFilePath, 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    console.error("[DEBUG] FOUT: CSV-bestand is leeg!");
    return;
  }

  const headers = parseCsvRow(lines[0]);
  const langs = headers.slice(1); 
  const sourceLang = langs[0]; 

  console.log(`[DEBUG] Gedetecteerde talen in CSV: ${langs.join(', ')} (Brontaal: ${sourceLang})`);

  const csvData = {};
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    const key = row[0];
    if (!key) continue;

    csvData[key] = {};
    for (let j = 0; j < langs.length; j++) {
      csvData[key][langs[j]] = row[j + 1] !== undefined ? row[j + 1] : '';
    }
    
    if (key === 'water_announcements') {
      console.log(`[CSV CHECK] water_announcements -> EN: "${csvData[key]['en']}" | ES: "${csvData[key]['es']}" | NL: "${csvData[key]['nl']}" | FR: "${csvData[key]['fr']}"`);
    }
  }

  const dataPerLang = {};
  langs.forEach(lang => dataPerLang[lang] = {});

  for (const key of activeHtmlKeys) {
    if (csvData[key]) {
      for (const lang of langs) {
        dataPerLang[lang][key] = csvData[key][lang];
      }
    } else {
      console.warn(`[WARNING] Sleutel '${key}' komt wel voor in HTML, maar ontbreekt in de CSV!`);
    }
  }

  // Vertaal ontbrekende velden via DeepL
  for (const targetLang of langs) {
    if (targetLang === sourceLang) continue;

    let missingCount = 0;

    for (const [key, sourceText] of Object.entries(dataPerLang[sourceLang])) {
      const targetText = dataPerLang[targetLang][key];
      
      if (sourceText && (!targetText || targetText.trim() === '')) {
        missingCount++;
        console.log(`\n--------------------------------------------------`);
        console.log(`[DEEPL REQUEST] Sleutel: '${key}'`);
        console.log(`[DEEPL REQUEST] Van (${sourceLang.toUpperCase()}) naar (${targetLang.toUpperCase()})`);
        console.log(`[DEEPL REQUEST] Brontekst: "${sourceText}"`);
        console.log(`--------------------------------------------------`);
        
        let success = false;
        let delay = 2000;
        let attempts = 3;

        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            const result = await translator.translateText(
              sourceText,
              sourceLang.toUpperCase(),
              targetLang.toUpperCase(),
              { tagHandling: 'html' }
            );
            dataPerLang[targetLang][key] = result.text;
            
            console.log(`[DEEPL RESPONSE] Ontvangen vertaling: "${result.text}"`);
            console.log(`--------------------------------------------------\n`);
            success = true;
            break;
          } catch (err) {
            console.error(`[DEEPL ERROR] Fout bij vertalen van '${key}' naar ${targetLang} (Poging ${attempt}/${attempts}):`, err.message);
            if (attempt < attempts) {
              console.log(`[RETRY] Wachten gedurende ${delay / 1000} seconden...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2; // 2s, 4s, etc.
            }
          }
        }

        if (!success) {
          console.error(`[DEEPL ERROR] Alle pogingen mislukt voor sleutel '${key}' naar ${targetLang}.`);
        }
      }
    }
    console.log(`[DEBUG] Totaal aantal velden verstuurd naar DeepL voor ${targetLang}: ${missingCount}`);
  }

  if (!fs.existsSync(langDir)) {
    fs.mkdirSync(langDir, { recursive: true });
  }

  for (const lang of langs) {
    const filePath = path.join(langDir, `${lang}.js`);
    const fileContent = `window.translations = window.translations || {};\nwindow.translations.${lang} = ${JSON.stringify(dataPerLang[lang], null, 2)};\n`;
    fs.writeFileSync(filePath, fileContent, 'utf8');
    console.log(`[DEBUG] Weggeschreven: assets/js/lang/${lang}.js (${Object.keys(dataPerLang[lang]).length} actieve sleutels)`);
  }

  console.log("\n[DEBUG] Synchronisatie succesvol afgerond!");
}

function parseCsvRow(text) {
  let result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    if (char === '"' && text[i+1] === '"') { current += '"'; i++; }
    else if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += char; }
  }
  result.push(current);
  return result.map(val => val.replace(/^"|"$/g, '').trim());
}

syncFromCsv();
