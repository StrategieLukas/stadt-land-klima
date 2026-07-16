export const DONATION_PAGE_PATH = "/spenden";

export const BETTERPLACE_PROJECT_ID = 157241;
export const BETTERPLACE_PROJECT_SLUG = "stadt-land-klima-bringe-kommunalen-klimaschutz-voran";

export const BETTERPLACE_PROJECT_URL =
  `https://www.betterplace.org/de/projects/${BETTERPLACE_PROJECT_ID}-${BETTERPLACE_PROJECT_SLUG}`;

export function getBetterplaceWidgetLanguage(locale?: string | null): "de" | "en" {
  return locale?.toLowerCase().startsWith("de") ? "de" : "en";
}

export function getBetterplaceWidgetUrl(locale?: string | null): string {
  const language = getBetterplaceWidgetLanguage(locale);
  return `https://www.betterplace-widget.org/projects/${BETTERPLACE_PROJECT_ID}?l=${language}`;
}
