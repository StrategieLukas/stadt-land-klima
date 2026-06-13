const fallbackLocale = "de-DE";
const shorthands = {
  de: "de-DE",
  en: "en-GB",
};
const supportedLocaleCodes = Object.values(shorthands);

function normalizeLocale(locale) {
  if (!locale || typeof locale !== "string") {
    return null;
  }

  const code = locale.trim().toLowerCase();
  const language = code.split("-")[0];

  return shorthands[language] || null;
}

function parseAcceptLanguageHeader(header) {
  if (!header || typeof header !== "string") {
    return [];
  }

  return header
    .split(",")
    .map((part) => {
      const [locale, ...params] = part.trim().split(";");
      const qParam = params.find((param) => param.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;

      return {
        locale,
        q: Number.isFinite(q) ? q : 0,
      };
    })
    .sort((a, b) => b.q - a.q)
    .map((part) => part.locale);
}

export default function resolveFullLocaleCode(locale = null) {
  const candidates = typeof locale === "string" && locale.includes(",")
    ? parseAcceptLanguageHeader(locale)
    : [locale];

  for (const candidate of candidates) {
    const resolvedLocale = normalizeLocale(candidate);
    if (resolvedLocale) {
      return resolvedLocale;
    }
  }

  return fallbackLocale;
}

export { fallbackLocale, supportedLocaleCodes };
