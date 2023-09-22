const fallbackLocale = process.env.FALLBACK_LOCALE || 'de';
const shorthands = {
  de: 'de-DE',
  en: 'en-US',
};

export default function resolveFullLocaleCode(locale = null) {
  return shorthands[locale] || fallbackLocale;
}
