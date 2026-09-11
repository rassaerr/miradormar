const fs = require('fs');
const path = require('path');
const deepl = require('deepl-node');

const authKey = "abcc2e01-6f44-49ef-b1b2-684f8c0908eb:fx"; 
const translator = new deepl.Translator(authKey);
const langDir = path.join(__dirname, 'assets/js/lang');
const cacheFilePath = path.join(__dirname, '.translation_cache.json');

async function syncFromFiles() {
  console.log("[DEBUG] Start automatische synchronisatie vanuit modulaire .en.js bestanden met cache-detectie...");

  if (!fs.existsSync(langDir)) {
    console.error(`[CRITICAL ERROR] Map niet gevonden: ${langDir}`);
    process.exit(1);
  }

  // 1. Laad de cache (bevat de laatst bekende Engelse brontekst)
  let translationCache = {};
  if (fs.existsSync(cacheFilePath)) {
    try {
      translationCache = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    } catch (err) {
      console.warn("[WARNING] Kon cachebestand niet inlezen, start met schone lei.");
    }
  }

  const langs = ['en', 'es', 'nl', 'fr'];
  const allData = {};
  langs.forEach(l => allData[l] = {});

  // 2. Lees alle bestaande JS bestanden in
  const files = fs.readdirSync(langDir).filter(f => f.endsWith('.en.js'));
  
  for (const file of files) {
    const baseName = file.replace('.en.js', '');
    
    for (const lang of langs) {
      const targetFile = `${baseName}.${lang}.js`;
      const filePath = path.join(langDir, targetFile);

      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const sandbox = { window: { translations: {} } };
          const vm = require('vm');
          vm.createContext(sandbox);
          vm.runInContext(content, sandbox);

          const transObj = sandbox.window.translations;
          if (transObj) {
            const keyName = Object.keys(transObj)[0];
            if (keyName && transObj[keyName]) {
              allData[lang][baseName] = transObj[keyName];
            }
          }
        } catch (err) {
          console.error(`[ERROR] Kon ${targetFile} niet inlezen:`, err.message);
        }
      }
    }
  }

  if (!allData['en'] || Object.keys(allData['en']).length === 0) {
    console.error("[CRITICAL ERROR] Geen Engelse bronbestanden gevonden!");
    return;
  }

  // 3. Vergelijk met cache en vertaal via DeepL indien nodig
  let updatedCount = 0;

  for (const targetLang of langs) {
    if (targetLang === 'en') continue;

    for (const [baseName, keysObj] of Object.entries(allData['en'])) {
      if (!allData[targetLang][baseName]) {
        allData[targetLang][baseName] = {};
      }

      for (const [key, sourceText] of Object.entries(keysObj)) {
        const cacheKey = `${baseName}:${key}`;
        const currentTargetText = allData[targetLang][baseName][key];
        
        // DETECTIE: Is het veld leeg, bevat het een placeholder zoals [NL], of is de Engelse tekst gewijzigd?
        const isPlaceholder = /^\[[A-Z]{2}\]/.test(currentTargetText);
        const isNewOrEmpty = !currentTargetText || currentTargetText.trim() === '' || isPlaceholder;
        const sourceChanged = translationCache[cacheKey] && translationCache[cacheKey] !== sourceText;

        if (isNewOrEmpty || sourceChanged) {
          if (sourceChanged) {
            console.log(`\n[DEEPL CHANGE DETECTED] '${cacheKey}' is gewijzigd.`);
            console.log(`Oud: "${translationCache[cacheKey]}"\nNieuw: "${sourceText}"`);
          } else {
            console.log(`\n[DEEPL NEW KEY] Nieuwe sleutel ontdekt: '${cacheKey}'`);
          }

          let success = false;
          let delay = 2000;
          let attempts = 3;

          for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
              const result = await translator.translateText(
                sourceText,
                'EN',
                targetLang.toUpperCase(),
                { tagHandling: 'html' }
              );
              allData[targetLang][baseName][key] = result.text;
              updatedCount++;

              console.log(`[DEEPL SUCCESS (${targetLang.toUpperCase()})] Vertaling opgeslagen: "${result.text}"`);
              success = true;
              break;
            } catch (err) {
              console.error(`[DEEPL ERROR] Fout bij vertalen naar ${targetLang} (Poging ${attempt}/${attempts}):`, err.message);
              if (attempt < attempts) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
              }
            }
          }
        }
      }
    }
  }

  // 4. Update de cache met de nieuwste Engelse zinnen
  for (const [baseName, keysObj] of Object.entries(allData['en'])) {
    for (const [key, sourceText] of Object.entries(keysObj)) {
      translationCache[`${baseName}:${key}`] = sourceText;
    }
  }
  fs.writeFileSync(cacheFilePath, JSON.stringify(translationCache, null, 2), 'utf8');
  console.log(`\n[DEBUG] Cachebestand bijgewerkt.`);

  // 5. Schrijf alle modulaire JS bestanden weer weg
  for (const lang of langs) {
    const langModules = allData[lang];
    for (const [baseName, keysObj] of Object.entries(langModules)) {
      const fileName = `${baseName}.${lang}.js`;
      const filePath = path.join(langDir, fileName);

      const fileContent = `window.translations = window.translations || {};\nwindow.translations.${baseName} = ${JSON.stringify(keysObj, null, 2)};\n`;
      fs.writeFileSync(filePath, fileContent, 'utf8');
    }
  }

  console.log(`\n[DEBUG] Synchronisatie voltooid! Aantal DeepL API calls: ${updatedCount}`);
}

syncFromFiles();
