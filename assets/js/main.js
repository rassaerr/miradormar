window.translations = window.translations || {};

function getLanguage() {
  console.log("[i18n] Step 1: Determining current language...");

  // 1. Prioriteit: Staat er een specifieke taalparameter in de URL? (?lang=es of ?lang=en)
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get("lang");
  if (urlLang) {
    console.log(`[i18n] Found language in URL parameter: "${urlLang}"`);
    try { localStorage.setItem("portal_lang", urlLang); } catch(e){}
    return urlLang;
  }

  // 2. Prioriteit: Heeft de gebruiker al handmatig een taal gekozen (opgeslagen in localStorage)?
  try {
    const localLang = localStorage.getItem("portal_lang");
    if (localLang) {
      console.log(`[i18n] Found persistent language in localStorage: "${localLang}"`);
      return localLang;
    }
  } catch (e) {
    console.warn("[i18n] localStorage access blocked:", e);
  }

  // 3. Prioriteit: Allereerste bezoek ooit zonder enige voorkeur? Start ALTIJD in het Spaans.
  console.log("[i18n] First startup: Defaulting to 'es'");
  try { localStorage.setItem("portal_lang", "es"); } catch(e){}
  return "es";
}

function updateNavLinks(lang) {
  console.log(`[i18n] Synchronizing all menu links with language: "${lang}"...`);
  let count = 0;
  
  document.querySelectorAll("a[href]").forEach(link => {
    const href = link.getAttribute("href");
    // Alleen interne HTML pagina-links aanpassen, laat PDF's en externe links met rust
    if (href && href.endsWith(".html") || (href && href.includes(".html?"))) {
      const pageBase = href.split("?")[0]; // CORRECTIE: Pak alleen het bestand voor de '?'
      link.setAttribute("href", `${pageBase}?lang=${lang}`);
      count++;
    }
  });
  
  console.log(`[i18n] Successfully updated ${count} links.`);
}

function applyTranslations(lang) {
  console.log(`[i18n] Step 3: Applying text dictionary for: "${lang}"`);
  
  const dict = window.translations[lang] || window.translations["es"] || window.translations["en"];
  if (!dict) {
    console.error(`[i18n] Critical error: No dictionaries available in window.translations!`);
    return;
  }

  const elements = document.querySelectorAll("[data-i18n]");
  let updatedCount = 0;

  elements.forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] !== undefined) {
      el.textContent = dict[key];
      updatedCount++;
    } else {
      console.warn(`[i18n] Missing translate-key "${key}" for language "${lang}"`);
    }
  });

  console.log(`[i18n] Translated ${updatedCount}/${elements.length} elements on this page.`);
}

function loadLanguageScript(lang, callback) {
  console.log(`[i18n] Step 2: Checking script status for language: "${lang}"`);

  if (window.translations[lang]) {
    callback();
    return;
  }

  const scriptPath = `assets/js/lang/${lang}.js`;
  const script = document.createElement("script");
  script.src = scriptPath;

  script.onload = () => {
    console.log(`[i18n] Loaded translation dictionary: "${scriptPath}"`);
    callback();
  };

  script.onerror = () => {
    console.error(`[i18n] Failed to load language file: "${scriptPath}". Trying fallback...`);
    if (lang !== "es") {
      loadLanguageScript("es", callback);
    } else if (lang !== "en") {
      loadLanguageScript("en", callback);
    }
  };

  document.head.appendChild(script);
}

function setLanguage(lang) {
  console.log(`[i18n] Language change requested -> "${lang}"`);

  try {
    localStorage.setItem("portal_lang", lang);
  } catch (e) {
    console.warn("[i18n] Failed to write to localStorage:", e);
  }

  try {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("lang", lang);
    window.history.replaceState({}, "", newUrl);
  } catch (e) {
    console.warn("[i18n] Failed to update URL history:", e);
  }

  loadLanguageScript(lang, () => {
    updateNavLinks(lang);
    applyTranslations(lang);
  });
}

function init() {
  const currentLang = getLanguage();
  const switcher = document.getElementById("languageSwitcher");

  if (switcher) {
    switcher.value = currentLang;
    switcher.onchange = function () {
      setLanguage(this.value);
    };
  }

  // Laad direct de juiste taal bij het opstarten
  loadLanguageScript(currentLang, () => {
    updateNavLinks(currentLang);
    applyTranslations(currentLang);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
