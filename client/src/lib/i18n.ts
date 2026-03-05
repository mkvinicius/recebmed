import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ptBR from "../locales/pt-BR.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": { translation: ptBR },
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
    },
    fallbackLng: "en",
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "recebmed_language",
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

export function getLocale(): string {
  const lang = i18n.language;
  if (lang.startsWith("pt")) return "pt-BR";
  if (lang.startsWith("es")) return "es-ES";
  if (lang.startsWith("fr")) return "fr-FR";
  return "en-US";
}

export function getCurrencyCode(): string {
  const lang = i18n.language;
  if (lang.startsWith("pt")) return "BRL";
  if (lang.startsWith("es")) return "EUR";
  if (lang.startsWith("fr")) return "EUR";
  return "USD";
}
