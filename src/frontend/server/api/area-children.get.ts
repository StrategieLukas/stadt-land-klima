/**
 * GET /api/area-children
 *
 * Returns direct child administrative areas for a given parent area.
 *
 * Query params:
 *   level        - required, numeric administrative level of the children (2 = Bundesland, 4 = Kreis)
 *   arsPrefix    - optional, leading chars of ARS to filter (e.g. "08" for BW Kreise)
 *   includeGeo   - optional "true" to include geoArea polygon (large!)
 *   first        - optional, max results (default 200, max 500)
 */

export default defineEventHandler(async (event) => {
  const query = getQuery(event) as {
    level?: string
    arsPrefix?: string
    includeGeo?: string
    first?: string
  }

  const { level, arsPrefix, includeGeo, first = '200' } = query

  if (!level) return []

  const config = useRuntimeConfig()
  const apiUrl = (config.public.stadtlandzahlUrl as string) || 'http://localhost:8000/graphql/'

  const numLevel = parseInt(level, 10)
  if (isNaN(numLevel)) return []

  const numFirst = Math.min(parseInt(String(first), 10) || 200, 500)
  const withGeo  = includeGeo === 'true'

  // Sanitise arsPrefix — only allow digits
  const safePrefix = arsPrefix ? String(arsPrefix).replace(/\D/g, '') : null

  const arsFilter = safePrefix ? `, ars_Icontains: "${safePrefix}"` : ''
  const geoFields = withGeo ? 'geoArea' : ''

  const gqlQuery = `{
    allAdministrativeAreas(
      first: ${numFirst}
      orderBy: "name"
      level_In: [${numLevel}]
      ${arsFilter}
    ) {
      edges {
        node {
          ars
          name
          prefix
          level
          population
          geoCenter
          ${geoFields}
        }
      }
    }
  }`

  try {
    const res = await $fetch<{ data?: { allAdministrativeAreas?: { edges?: { node: Record<string, unknown> }[] } } }>(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gqlQuery }),
    })

    let areas = res.data?.allAdministrativeAreas?.edges?.map(e => e.node) ?? []

    // ars_Icontains can match non-prefix substrings — filter to genuine prefixes client-side
    if (safePrefix) {
      areas = areas.filter(a => (a.ars as string).startsWith(safePrefix))
    }

    return areas
  } catch {
    return []
  }
})
