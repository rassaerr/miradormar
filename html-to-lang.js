// html-to-lang.js
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const langDir = path.join(rootDir, 'assets/js/lang');
const targetLang = process.argv[2] || 'en';

if (!fs.existsSync(langDir)) {
  fs.mkdirSync(langDir, { recursive: true });
}

const htmlFiles = fs.readdirSync(rootDir).filter(file => file.endsWith('.html'));

// Functie om HTML-entiteiten netjes te decoderen naar leesbare teksten (&amp; -> &, &quot; -> ", etc.)
function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

for (const htmlFile of htmlFiles) {
  const baseName = path.basename(htmlFile, '.html');
  const fullPath = path.join(rootDir, htmlFile);
  
  let htmlContent;
  try {
    htmlContent = fs.readFileSync(fullPath, 'utf8');
  } catch (err) {
    console.error(`[ERROR] Kan bestand ${htmlFile} niet lezen:`, err.message);
    continue;
  }

  const pageKeys = {};

  const tagRegex = /<([a-zA-Z0-9-]+)(?:\s+[^>]*)*?\s+data-i18n=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = tagRegex.exec(htmlContent)) !== null) {
    const key = match[2];
    const innerHtml = match[4];
    // Strip HTML tags en decodeer entiteiten voor professionele output
    const cleanText = decodeHtmlEntities(innerHtml.replace(/<[^>]*>/g, '').trim());
    if (key) {
      pageKeys[key] = cleanText || key;
    }
  }

  const simpleMatches = htmlContent.matchAll(/data-i18n=["']([^"']+)["']/g);
  for (const sm of simpleMatches) {
    const key = sm[1];
    if (!pageKeys[key]) {
      pageKeys[key] = key;
    }
  }

  const langFilePath = path.join(langDir, `${baseName}.${targetLang}.js`);
  let existingData = {};

  if (fs.existsSync(langFilePath)) {
    try {
      const content = fs.readFileSync(langFilePath, 'utf8');
      const jsonMatch = content.match(/window\.translations\.[a-zA-Z0-9_]+\s*=\s*(\{[\s\S]*\});/);
      if (jsonMatch) {
        existingData = JSON.parse(jsonMatch[1]);
      }
    } catch (e) {
      // Stilzwijgen bij parse fout
    }
  }

  const finalData = {};
  for (const [key, defaultText] of Object.entries(pageKeys)) {
    if (targetLang === 'en') {
      // De HTML is heilig voor Engels. Overschrijf ALTIJD met de actuele HTML tekst.
      finalData[key] = defaultText !== '' ? defaultText : key;
    } else {
      if (existingData[key] !== undefined && existingData[key] !== '' && !/^\[[A-Z]{2}\]/.test(existingData[key])) {
        finalData[key] = existingData[key];
      } else {
        finalData[key] = `[${targetLang.toUpperCase()}] ${key}`;
      }
    }
  }

  const fileContent = `window.translations = window.translations || {};\nwindow.translations.${baseName} = ${JSON.stringify(finalData, null, 2)};\n`;
  
  // ALLES-IN-ÉÉN FIX: Schrijf het bestand alleen weg als het echt anders is dan wat er al stond!
  let existingFileContent = '';
  if (fs.existsSync(langFilePath)) {
    existingFileContent = fs.readFileSync(langFilePath, 'utf8');
  }

  if (existingFileContent !== fileContent) {
    try {
      fs.writeFileSync(langFilePath, fileContent, 'utf8');
      console.log(`[DEBUG] Gewijzigd en weggeschreven: assets/js/lang/${baseName}.${targetLang}.js (${Object.keys(finalData).length} sleutels)`);
    } catch (err) {
      console.error(`[ERROR] Kan bestand ${langFilePath} niet weggeschrijven:`, err.message);
    }
  } else {
      console.log(`[DEBUG] Geen wijzigingen in ${baseName}.${targetLang}.js, overslaan.`);
  }
}

console.log(`[DEBUG] Klaar! Alle HTML-entiteiten in '${targetLang}' zijn schoongemaakt.`);
