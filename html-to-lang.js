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

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Strips all HTML tags EXCEPT <a> anchor tags (preserving href, target, etc.)
 */
function preserveOnlyLinks(html) {
  // 1. Temporarily protect <a> tags by replacing them with a unique placeholder, 
  //    or process them carefully. A common approach is matching <a> tags specifically.
  
  // We can match any <a>...</a> tag block
  const linkRegex = /(<a\b[^>]*>[\s\S]*?<\/a>)/gi;
  const links = [];
  
  // Extract and replace links with placeholders like __LINK_0__, __LINK_1__, etc.
  const maskedHtml = html.replace(linkRegex, (match) => {
    links.push(match);
    return `__LINK_${links.length - 1}__`;
  });

  // 2. Strip all other remaining HTML tags (like <strong>, <em>, etc.)
  let cleanText = maskedHtml.replace(/<[^>]*>/g, '');

  // 3. Decode standard entities on the clean text
  cleanText = decodeHtmlEntities(cleanText);

  // 4. Put the original <a> tags back into their places
  links.forEach((link, index) => {
    cleanText = cleanText.replace(`__LINK_${index}__`, link);
  });

  return cleanText.trim();
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
    
    // Behoud ALLEEN links, strip alle andere tags zoals <strong> of <em>
    const processedText = preserveOnlyLinks(innerHtml);
    
    if (key) {
      pageKeys[key] = processedText || key;
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
    } catch (e) {}
  }

  const finalData = {};
  for (const [key, defaultText] of Object.entries(pageKeys)) {
    if (targetLang === 'en') {
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

console.log(`[DEBUG] Klaar! Alleen links zijn behouden; overige HTML-tags zijn gestript voor '${targetLang}'.`);