/**
 * Server-side area search endpoint.
 *
 * The browser calls this with ?term=...&mode=... instead of fetching
 * data.stadt-land-klima.de directly. This ensures the GraphQL request
 * always goes through the server (server → data.stadt-land-klima.de),
 * which avoids mobile network restrictions and mixed-content issues on
 * HTTP-only test/staging environments.
 */

const AREA_SEARCH_GQL = `
  query searchAreas($name_Icontains: String!, $isReasonableForMunicipalRating: Boolean, $level_In: [Int]) {
    allAdministrativeAreas(
      first: 8
      orderBy: "-population"
      name_Icontains: $name_Icontains
      isReasonableForMunicipalRating: $isReasonableForMunicipalRating
      level_In: $level_In
    ) {
      edges {
        node {
          prefix
          name
          ars
          level
          population
          stadtlandklimaDataAll {
            slug
            scoreTotal
            percentageRated
            measureCatalogName
          }
          isReasonableForMunicipalRating
        }
      }
    }
  }
`

async function fetchNodes(apiUrl: string, variables: Record<string, unknown>) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: AREA_SEARCH_GQL, variables }),
  })
  const json = await res.json() as { data?: { allAdministrativeAreas?: { edges?: { node: unknown }[] } } }
  return json.data?.allAdministrativeAreas?.edges?.map(e => e.node) ?? []
}

export default defineEventHandler(async (event) => {
  const searchParams = getRequestSearchParams(event)
  const term = searchParams.get('term') ?? ''
  const mode = searchParams.get('mode') ?? 'reasonable'

  if (!term || !term.trim()) {
    return []
  }

  const config = useRuntimeConfig()
  const apiUrl = config.public.stadtlandzahlUrl || 'http://localhost:8000/graphql/'

  try {
    if (mode === 'normal') {
      const [areaSettled, muniSettled] = await Promise.allSettled([
        fetchNodes(apiUrl, { name_Icontains: term.trim(), level_In: [1, 2, 3] }),
        fetchNodes(apiUrl, { name_Icontains: term.trim(), isReasonableForMunicipalRating: true }),
      ])
      const areaNodes = areaSettled.status === 'fulfilled' ? areaSettled.value : []
      const muniNodes = muniSettled.status === 'fulfilled' ? muniSettled.value : []
      const seen = new Set<unknown>()
      const merged: unknown[] = []
      for (const node of [...areaNodes, ...muniNodes]) {
        const n = node as { ars?: string }
        if (!seen.has(n.ars)) { seen.add(n.ars); merged.push(node) }
      }
      return merged
    } else if (mode === 'reasonable') {
      return await fetchNodes(apiUrl, { name_Icontains: term.trim(), isReasonableForMunicipalRating: true })
    } else {
      return await fetchNodes(apiUrl, { name_Icontains: term.trim() })
    }
  } catch (err) {
    console.error('[area-search] failed:', err)
    return []
  }
})
