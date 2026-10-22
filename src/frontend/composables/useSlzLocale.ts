export function useSlzLocale() {
  const { $locale } = useNuxtApp();
  function t(dict: Record<string, string> | undefined | null): string {
    if (!dict) return "";
    const requested = $locale === "en-GB" ? ["en-GB", "en-US"] : [$locale];
    return (
      requested.map((locale) => dict[locale]).find(Boolean) ||
      dict["de-DE"] ||
      dict["en-US"] ||
      Object.values(dict).find(Boolean) ||
      ""
    );
  }

  return { t };
}
