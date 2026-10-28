import type { Locale } from "./i18n";
const fallbackLocale: Locale = "de-DE";
const shorthands: Record<string, Locale> = {
  de: "de-DE",
  en: "en-GB",
  it: "it-IT",
};
const supportedLocaleCodes = Object.values(shorthands);

function normalizeLocale(locale: unknown): Locale | null {
  if (!locale || typeof locale !== "string") {
    return null;
  }

  const code = locale.trim().toLowerCase();
  const language = code.split("-")[0];

  return language && Object.hasOwn(shorthands, language) ? shorthands[language]! : null;
}

function parseAcceptLanguageHeader(header: unknown): string[] {
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
        q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0,
      };
    })
    .sort((a, b) => b.q - a.q)
    .filter((part) => part.q > 0)
    .map((part) => part.locale ?? "");
}

export default function resolveFullLocaleCode(locale: unknown = null): Locale {
  const candidates =
    typeof locale === "string" && (locale.includes(",") || locale.includes(";"))
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
