export default function translatedNavigationLabel(item, t, field = "label") {
  const fallback = item?.[field] ?? item?.label ?? item?.name ?? "";
  const slug = item?.page_slug ?? item?.slug;
  const normalizedSlug = slug ? String(slug).replace(/^\/+|\/+$/g, "").replace(/\//g, ".") : "";
  const fieldSuffix = field === "label" || field === "name" ? "" : `.${field}`;
  const allowFallbackKey = field === "label" || field === "name" || field === "title";
  const candidates = [
    item?.translation_key,
    normalizedSlug ? `navigation.${normalizedSlug}${fieldSuffix}` : null,
    allowFallbackKey && fallback === "Karte" ? "navigation.map" : null,
    allowFallbackKey && fallback === "Archiv" ? "navigation.archive" : null,
  ].filter(Boolean);

  for (const key of candidates) {
    const translated = t(key);
    if (translated !== key) return translated;
  }

  return fallback;
}
