/**
 * Server-side area search endpoint.
 *
 * The browser calls this with ?term=...&mode=... and this route proxies the
 * request to the stadtlandzahl REST API (/api/search/areas/). Running the
 * request server-side avoids mobile network restrictions and mixed-content
 * issues on HTTP-only test/staging environments.
 *
 * Response fields are normalised from snake_case to the camelCase shape that
 * the useAreaSearch / useUnifiedSearch composables expect.
 */

type RestAreaData = {
  slug: string
  score_total: number | null
  percentage_rated: number | null
  measure_catalog_name: string
}

type RestArea = {
  prefix: string
  name: string
  ars: string
  level: number
  population: number
  is_reasonable_for_municipal_rating: boolean
  stadtlandklima_data_all: RestAreaData[]
}

type RestSearchResponse = { results?: RestArea[] }

/** Normalise a REST area record to the camelCase shape expected by the composables. */
function normalise(area: RestArea) {
  return {
    prefix: area.prefix,
    name: area.name,
    ars: area.ars,
    level: area.level,
    population: area.population,
    isReasonableForMunicipalRating: area.is_reasonable_for_municipal_rating,
    stadtlandklimaDataAll: (area.stadtlandklima_data_all ?? []).map(d => ({
      slug: d.slug,
      scoreTotal: d.score_total,
      percentageRated: d.percentage_rated,
      measureCatalogName: d.measure_catalog_name,
    })),
  }
}

async function fetchFromRest(baseUrl: string, params: Record<string, string>) {
  const url = new URL(`${baseUrl}/api/search/areas/`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`[area-search] REST ${res.status}: ${url}`)
  const json = await res.json() as RestSearchResponse
  return (json.results ?? []).map(normalise)
}

export default defineEventHandler(async (event) => {
  // event.url is h3 v2 only; at runtime nitropack uses h3 v1 where event.path is the path+query string
  const sp   = new URLSearchParams((event.path ?? '').split('?')[1] ?? '')
  const term = sp.get('term') ?? undefined
  const mode = sp.get('mode') ?? 'reasonable'

  if (!term || !term.trim()) return []

  const config = useRuntimeConfig()
  const baseUrl = (config.stadtlandzahlServerBaseUrl as string) || (config.public.stadtlandzahlBaseUrl as string)
  const q = term.trim()

  try {
    if (mode === 'normal') {
      // Two parallel requests: one for all areas (filtered to level ≤ 3 client-side)
      // and one for reasonable municipalities.
      const [allSettled, muniSettled] = await Promise.allSettled([
        fetchFromRest(baseUrl, { q }),
        fetchFromRest(baseUrl, { q, is_reasonable_for_municipal_rating: 'true' }),
      ])
      const allNodes = allSettled.status === 'fulfilled' ? allSettled.value : []
      const muniNodes = muniSettled.status === 'fulfilled' ? muniSettled.value : []
      const regionNodes = allNodes.filter(n => n.level <= 3)
      const seen = new Set<string>()
      const merged = []
      for (const node of [...regionNodes, ...muniNodes]) {
        if (!seen.has(node.ars)) { seen.add(node.ars); merged.push(node) }
      }
      return merged
    } else if (mode === 'reasonable') {
      return await fetchFromRest(baseUrl, { q, is_reasonable_for_municipal_rating: 'true' })
    } else {
      return await fetchFromRest(baseUrl, { q })
    }
  } catch (err) {
    console.error('[area-search] failed:', err)
    return []
  }
})
