(() => {
  const supported = [
    "en",
    "zh-CN",
    "zh-TW",
    "ja",
    "ko",
    "es",
    "fr",
    "de",
    "pt-BR",
    "ru",
    "ar",
    "hi",
    "id",
    "th",
    "tr",
    "vi",
  ];

  const langMap = {
    "zh-cn": "zh-CN",
    "zh-sg": "zh-CN",
    "zh-hans": "zh-CN",
    "zh-tw": "zh-TW",
    "zh-hk": "zh-TW",
    "zh-mo": "zh-TW",
    "zh-hant": "zh-TW",
    "pt-br": "pt-BR",
  };

  const storageKey = "natlab-lang";

  function normalizeLang(input) {
    if (!input) return null;
    const lower = input.toLowerCase();
    if (langMap[lower]) return langMap[lower];
    const direct = supported.find((lang) => lang.toLowerCase() === lower);
    if (direct) return direct;
    const short = lower.split("-")[0];
    const byShort = supported.find((lang) => lang.toLowerCase().startsWith(short));
    return byShort || null;
  }

  function detectLang() {
    const url = new URL(window.location.href);
    const param = url.searchParams.get("lang");
    const fromParam = normalizeLang(param);
    if (fromParam) return fromParam;

    try {
      const stored = normalizeLang(localStorage.getItem(storageKey));
      if (stored) return stored;
    } catch (error) {
      console.warn("localStorage unavailable:", error);
    }

    const navigatorLangs = [
      ...(navigator.languages || []),
      navigator.language,
      navigator.userLanguage,
    ].filter(Boolean);

    for (const lang of navigatorLangs) {
      const normalized = normalizeLang(lang);
      if (normalized) return normalized;
    }

    return "en";
  }

  function setLang(lang) {
    const normalized = normalizeLang(lang) || "en";
    try {
      localStorage.setItem(storageKey, normalized);
    } catch (error) {
      console.warn("localStorage unavailable:", error);
    }

    const url = new URL(window.location.href);
    url.searchParams.set("lang", normalized);
    window.location.href = url.toString();
  }

  function applyTranslations(dict) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (dict[key]) {
        el.innerHTML = dict[key];
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (dict[key]) {
        el.setAttribute("placeholder", dict[key]);
      }
    });

    document.querySelectorAll("[data-i18n-content]").forEach((el) => {
      const key = el.getAttribute("data-i18n-content");
      if (dict[key]) {
        el.setAttribute("content", dict[key]);
      }
    });
  }

  function applyLangToLinks(lang) {
    document.querySelectorAll("a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
      if (href.startsWith("http")) return;
      const url = new URL(href, window.location.origin);
      url.searchParams.set("lang", lang);
      link.setAttribute("href", url.pathname + url.search + url.hash);
    });
  }

  const currentLang = detectLang();

  window.NATLAB_I18N = {
    lang: currentLang,
    t: (key, fallback) => fallback || key,
    setLang,
  };

  fetch(`/locales/${currentLang}.json`, { cache: "no-store" })
    .then((res) => res.json())
    .then((dict) => {
      window.NATLAB_I18N = {
        lang: currentLang,
        dict,
        t: (key, fallback) => dict[key] || fallback || key,
        setLang,
      };
      applyTranslations(dict);
      applyLangToLinks(currentLang);
      document.documentElement.setAttribute("lang", currentLang);

      const langSelect = document.getElementById("langSelect");
      if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener("change", (event) => setLang(event.target.value));
      }

      window.dispatchEvent(new CustomEvent("i18n:ready", { detail: { lang: currentLang } }));
    })
    .catch((error) => {
      console.error("Failed to load i18n dictionary", error);
    });
})();
