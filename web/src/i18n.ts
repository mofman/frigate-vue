/** i18next setup reusing the existing public/locales translation files. */
import i18next from "i18next";
import HttpBackend from "i18next-http-backend";
import { shallowRef } from "vue";
import { baseUrl } from "@/api/baseUrl";

const LANGUAGE_KEY = "frigate-language";

// locale folders that differ from BCP47 tags reported by browsers
const LANGUAGE_ALIASES: Record<string, string> = {
  "zh-TW": "zh-Hant",
  "zh-HK": "zh-Hant",
  "pt-PT": "pt",
  nb: "nb-NO",
  no: "nb-NO",
};

function detectLanguage(): string {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LANGUAGE_KEY);
  } catch {
    // storage blocked
  }
  const raw = stored ?? navigator.language ?? "en";
  return LANGUAGE_ALIASES[raw] ?? raw;
}

/** bumps whenever translations or the language change, so t() re-renders */
export const i18nVersion = shallowRef(0);

export async function setupI18n() {
  i18next.on("languageChanged", () => i18nVersion.value++);
  i18next.on("loaded", () => i18nVersion.value++);

  await i18next.use(HttpBackend).init({
    lng: detectLanguage(),
    fallbackLng: (code) => {
      const base = code.split("-")[0];
      return base && base !== code ? [base, "en"] : ["en"];
    },
    load: "currentOnly",
    ns: ["common", "objects", "views/app"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    backend: { loadPath: `${baseUrl}locales/{{lng}}/{{ns}}.json` },
    returnNull: false,
  });

  document.documentElement.lang = i18next.language;
}

export function setLanguage(language: string) {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // storage blocked
  }
  void i18next.changeLanguage(language);
}

export { i18next };
