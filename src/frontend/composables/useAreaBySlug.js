import gql from 'graphql-tag'

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
 * Calls the Nuxt server route /api/area-by-slug which handles GraphQL
 * proxying (so it works in both SSR and CSR contexts).
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
 * Build the breadcrumb chain (contained_by ancestors) for an area using GraphQL.
 * Returns an array ordered from Bundesland to nearest parent (excluding Germany
 * itself — that is rendered as a hardcoded first crumb in the template).
 * Level 3 (Regierungsbezirke) is intentionally skipped.
 */
export async function fetchContainedBy(ars, level, apolloClient) {
  if (!apolloClient || !ars) return []

  const AREA_FIELDS = gql`
    fragment AreaFields on AdministrativeAreaNode {
      ars
      name
      prefix
      level
    }
  `

  // Prefix lengths per administrative level (chars into the 12-char ARS):
  // Level 2 Bundesland:  first 2 chars
  // Level 4 Kreis:       first 5 chars
  // Level 3 (Regierungsbezirk) is deliberately omitted.
  const prefixByLevel = { 2: 2, 4: 5 }
  const parentLevels = Object.keys(prefixByLevel)
    .map(Number)
    .filter(l => l < level)

  const parents = []

  for (const parentLevel of parentLevels) {
    const prefixLen = prefixByLevel[parentLevel]
    const arsPrefix = ars.slice(0, prefixLen)

    try {
      const result = await apolloClient.query({
        query: gql`
          query getParentArea($ars_Icontains: String!, $level_In: [Int!]) {
            allAdministrativeAreas(
              first: 5
              ars_Icontains: $ars_Icontains
              level_In: $level_In
            ) {
              edges {
                node {
                  ars
                  name
                  prefix
                  level
                }
              }
            }
          }
        `,
        variables: {
          ars_Icontains: arsPrefix,
          level_In: [parentLevel],
        },
      })

      const edges = result.data?.allAdministrativeAreas?.edges ?? []
      const match = edges.find(e => e.node.ars.startsWith(arsPrefix))
      if (match) parents.push(match.node)
    } catch (_) {
      // skip this level on error
    }
  }

  return parents
}
