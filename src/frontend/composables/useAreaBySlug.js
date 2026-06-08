/**
 * Convert a prefix + name pair to a URL-safe slug.
 * e.g. "Stadtkreis" + "Karlsruhe"  → "stadtkreis-karlsruhe"
 *      "Gemeinde"   + "Bühl"        → "gemeinde-buehl"
 */
export function areaToSlug(prefix, name) {
  return (prefix + '-' + name)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Resolve a slug like "stadtkreis-karlsruhe" to a full area object.
 * Calls the Nuxt server route /api/area-by-slug which proxies to the REST
 * areas endpoint (works in both SSR and CSR contexts).
 */
export async function resolveSlugToArea(slug) {
  if (!slug) return null
  try {
    return await $fetch('/api/area-by-slug', { params: { slug } })
  } catch (_) {
    return null
  }
}

/**
 * Build the breadcrumb chain (ancestor areas) for a given area.
 * Calls the internal Nuxt server route /api/area-ancestors, which proxies to
 * the stadtlandzahl backend using the correct Docker-internal URL.
 *
 * Returns an array ordered from Bundesland to nearest parent (excluding Germany
 * itself — rendered as a hardcoded first crumb in the template).
 * Level 3 (Regierungsbezirke) is excluded by the backend.
 */
export async function fetchContainedBy(ars, level) {
  if (!ars || level <= 2) return []
  try {
    const res = await $fetch('/api/area-ancestors', { params: { ars } })
    return res?.ancestors ?? []
  } catch (_) {
    return []
  }
}
