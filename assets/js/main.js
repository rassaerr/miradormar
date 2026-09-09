// Zorg dat het globale object direct correct bestaat en bewaard blijft
if (!window.translations) {
  window.translations = {};
  console.log("[i18n-DEBUG] Created global window.translations object.");
}

function getLanguage() {
  console.log("[i18n-DEBUG] --- Step 1: Determining current language ---");

  // 1. Prioriteit: Staat er een parameter in de URL? (?lang=en) -> Hoogste wet
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get("lang");
  if (urlLang) {
    console.log("[i18n-DEBUG] Found 'lang' parameter in URL:", urlLang);
    try { localStorage.setItem("portal_lang", urlLang); } catch(e){}
    return urlLang;
  }

  // 2. Prioriteit: Forceer ALTIJD Spaans (es) bij opstarten als er geen URL-parameter is!
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
      const oldHref = href;
      // FIX: Pak expliciet het EERSTE element [0] om de pure bestandsnaam te krijgen (zonder array-rommel)
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
  
  const dict = window.translations[lang] || window.translations["es"] || window.translations["en"];
  if (!dict) {
    console.error("[i18n-DEBUG] CRITICAL ERROR: No translation dictionaries available for: " + lang);
    return;
  }

  const elements = document.querySelectorAll("[data-i18n]");
  let updatedCount = 0;

  elements.forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] !== undefined) {
      // FIX: Gebruik innerHTML zodat <strong> en <a> tags correct worden gerenderd
      el.innerHTML = dict[key];
      updatedCount++;
    }
  });
  console.log("[i18n-DEBUG] Translation finish: " + updatedCount + " elements updated.");
}
function loadLanguageScript(lang, callback) {
  console.log("[i18n-DEBUG] --- Step 2: Loading Language Asset File ---");

  if (window.translations[lang] && Object.keys(window.translations[lang]).length > 0) {
    callback();
    return;
  }

  const scriptPath = "assets/js/lang/" + lang + ".js?v=" + Date.now();
  const script = document.createElement("script");
  script.src = scriptPath;

  script.onload = () => {
    console.log("[i18n-DEBUG] Network load SUCCESS: '" + scriptPath + "'");
    callback();
  };

  script.onerror = () => {
    console.error("[i18n-DEBUG] Network load FAILED for: " + scriptPath);
    if (lang !== "es") { loadLanguageScript("es", callback); }
  };

  document.head.appendChild(script);
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
