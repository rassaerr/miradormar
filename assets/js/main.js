if (!window.translations) {
  window.translations = {};
  console.log("[i18n-DEBUG] Created global window.translations object.");
}

const MODULES = [
  'about', 'contacts', 'documents', 'electricity', 
  'emergency', 'garage', 'index', 'insurance', 
  'internet', 'keys', 'maintenance', 'water', 'elevator'
];

function getLanguage() {
  console.log("[i18n-DEBUG] --- Step 1: Determining current language ---");

  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get("lang");
  if (urlLang) {
    console.log("[i18n-DEBUG] Found 'lang' parameter in URL:", urlLang);
    try { localStorage.setItem("portal_lang", urlLang); } catch(e){}
    return urlLang;
  }

  console.log("[i18n-DEBUG] No parameter in URL. Forcing default startup to 'es' (Spanish).");
  try { localStorage.setItem("portal_lang", "es"); } catch(e){}
  return "es";
}

function updateNavLinks(lang) {
  console.log("[i18n-DEBUG] --- Updating Navigation Menu Links ---");
  let count = 0;
  
  document.querySelectorAll("a[href]").forEach(link => {
    const href = link.getAttribute("href");
    
    if (href && (href.endsWith(".html") || href.includes(".html?"))) {
      const pageBase = href.split("?")[0]; 
      const newHref = pageBase + "?lang=" + lang;
      
      link.setAttribute("href", newHref);
      count++;
    }
  });
  console.log("[i18n-DEBUG] Successfully synchronized " + count + " navigation menu links.");
}

function applyTranslations(lang) {
  console.log("[i18n-DEBUG] --- Step 3: Applying DOM Translations ---");

  const elements = document.querySelectorAll("[data-i18n]");
  let updatedCount = 0;

  elements.forEach(el => {
    const dataKey = el.getAttribute("data-i18n");
    let text = undefined;

    if (dataKey.includes(':')) {
      const parts = dataKey.split(':');
      const baseName = parts[0];
      const key = parts.slice(1).join(':');
      
      if (window.translations[baseName] && window.translations[baseName][key] !== undefined) {
        text = window.translations[baseName][key];
      }
    } else {
      for (const mod of MODULES) {
        if (window.translations[mod] && window.translations[mod][dataKey] !== undefined) {
          text = window.translations[mod][dataKey];
          break;
        }
      }
    }

    if (text !== undefined) {
      el.innerHTML = text;
      updatedCount++;
    }
  });

  console.log("[i18n-DEBUG] Translation finish: " + updatedCount + " elements updated.");
}

function loadLanguageScript(lang, callback) {
  console.log("[i18n-DEBUG] --- Step 2: Loading Modular Language Asset Files for: " + lang + " ---");

  let loadedCount = 0;
  const totalModules = MODULES.length;
  const timestamp = Date.now();

  MODULES.forEach(mod => {
    const scriptPath = `assets/js/lang/${mod}.${lang}.js?v=${timestamp}`;
    const script = document.createElement("script");
    script.src = scriptPath;

    script.onload = () => {
      loadedCount++;
      if (loadedCount === totalModules) {
        console.log("[i18n-DEBUG] All modular files loaded successfully for: " + lang);
        callback();
      }
    };

    script.onerror = () => {
      console.warn("[i18n-DEBUG] Warning: Could not load module file: " + scriptPath);
      loadedCount++;
      if (loadedCount === totalModules) {
        callback();
      }
    };

    document.head.appendChild(script);
  });
}

function setLanguage(lang) {
  console.log("[i18n-DEBUG] MANUAL TAALSWITCH TRIGGERED -> Target: " + lang);

  try { localStorage.setItem("portal_lang", lang); } catch (e) {}

  try {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("lang", lang);
    window.history.replaceState({}, "", newUrl.pathname + newUrl.search);
  } catch (e) {}

  loadLanguageScript(lang, () => {
    updateNavLinks(lang);
    applyTranslations(lang);
  });
}

function init() {
  console.log("[i18n-DEBUG] RUNNING LANGUAGE PORTAL INITIALIZATION...");
  
  const currentLang = getLanguage();
  const switcher = document.getElementById("languageSwitcher");

  if (switcher) {
    switcher.value = currentLang;
    switcher.onchange = function () {
      setLanguage(this.value);
    };
  }

  loadLanguageScript(currentLang, () => {
    updateNavLinks(currentLang);
    applyTranslations(currentLang);
    console.log("[i18n-DEBUG] --- Initialization Cycle Completed Successfully ---");
  });
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}