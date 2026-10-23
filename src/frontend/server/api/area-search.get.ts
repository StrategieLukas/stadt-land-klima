import { queryChoice, queryText } from "~/server/utils/publicQuery";
import { z } from "zod";
import { parseCms } from "~/server/utils/parseCms";
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
  slug: string | null
  score_total: number | null
  percentage_rated: number | null
  measure_catalog_name: string
}

type RestArea = {
  prefix: string
  name: string
  ars: string
  level: number
  population: number | null
  is_reasonable_for_municipal_rating: boolean
  stadtlandklima_data_all: RestAreaData[]
}



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

async function fetchFromRest(params: Record<string, string>) {
  const json = parseCms(z.object({results: z.array(z.object({prefix: z.string(), name: z.string(), ars: z.string(), level: z.number(), population: z.number().nullable(), is_reasonable_for_municipal_rating: z.boolean(), stadtlandklima_data_all: z.array(z.object({slug: z.string().nullable(), score_total: z.number().nullable(), percentage_rated: z.number().nullable(), measure_catalog_name: z.string()})).default([])})).default([])}), await fetchStadtlandzahl('/api/search/areas/', { params }))
  return (json.results ?? []).map(normalise)
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const term = queryText(query.term, 200) ?? ''
  const mode = queryChoice(query.mode, ['normal', 'reasonable', 'all'], 'reasonable')

  if (!term || !term.trim()) return []

  const q = term.trim()

  try {
    if (mode === 'normal') {
      // Two parallel requests: one for all areas (filtered to level ≤ 3 client-side)
      // and one for reasonable municipalities.
      const [allSettled, muniSettled] = await Promise.allSettled([
        fetchFromRest({ q }),
        fetchFromRest({ q, is_reasonable_for_municipal_rating: 'true' }),
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
      return await fetchFromRest({ q, is_reasonable_for_municipal_rating: 'true' })
    } else {
      return await fetchFromRest({ q })
    }
  } catch (err) {
    console.error('[area-search] failed:', err)
    return []
  }
})
