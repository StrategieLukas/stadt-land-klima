import type { DynamicTranslator } from "./i18n";
interface NavigationItem {
  label?: string | null | undefined;
  name?: string | null | undefined;
  page_slug?: string | null | undefined;
  slug?: string | null | undefined;
  translation_key?: string | null | undefined;
  title?: string | null | undefined;
  description?: string | null | undefined;
}
export default function translatedNavigationLabel(
  item: NavigationItem | null | undefined,
  translate: DynamicTranslator,
  field: "label" | "name" | "title" | "description" = "label",
): string {
  const fallback = item?.[field] ?? item?.label ?? item?.name ?? "";
  const slug = item?.page_slug ?? item?.slug;
  const normalized = slug?.replace(/^\/+|\/+$/g, "").replace(/\//g, ".") ?? "";
  const suffix = field === "label" || field === "name" ? "" : `.${field}`;
  const fallbackKey = field !== "description";
  const candidates = [
    item?.translation_key,
    normalized ? `navigation.${normalized}${suffix}` : null,
    fallbackKey && fallback === "Karte" ? "navigation.map" : null,
    fallbackKey && fallback === "Archiv" ? "navigation.archive" : null,
  ];
  for (const key of candidates) {
    if (!key) continue;
    const translated = translate(key);
    if (translated !== key) return translated;
  }
  return fallback;
}
