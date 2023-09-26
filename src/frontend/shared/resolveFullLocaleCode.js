const fallbackLocale = process.env.FALLBACK_LOCALE || 'de-DE';
const shorthands = {
  de: 'de-DE',
  en: 'en-US',
};

export default function resolveFullLocaleCode(locale = null) {
  if (!locale) {
    locale = fallbackLocale;
  }

  return shorthands[locale] ? shorthands[locale] : fallbackLocale;
}
