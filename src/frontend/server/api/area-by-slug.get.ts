/**
 * Resolves a URL slug like "stadtkreis-karlsruhe" to a full area object
 * (including geoCenter + geoArea) by progressively searching via GraphQL.
 */

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function areaToSlug(prefix: string, name: string): string {
  return slugify(prefix + '-' + name)
}

const AREA_FIELDS_GQL = `
  query searchAreasByName($name_Icontains: String!) {
    allAdministrativeAreas(
      first: 8
      orderBy: "-population"
      name_Icontains: $name_Icontains
    ) {
      edges {
        node {
          prefix
          name
          ars
          level
          population
          isReasonableForMunicipalRating
          geoCenter
          geoArea
          stadtlandklimaDataAll {
            slug
            scoreTotal
            percentageRated
            measureCatalogName
          }
        }
      }
    }
  }
`

async function searchNodes(apiUrl: string, nameTerm: string) {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: AREA_FIELDS_GQL,
      variables: { name_Icontains: nameTerm },
    }),
  })
  const json = await res.json() as {
    data?: { allAdministrativeAreas?: { edges?: { node: Record<string, unknown> }[] } }
  }
  return json.data?.allAdministrativeAreas?.edges?.map(e => e.node) ?? []
}

/** Expand slug segment back to possible umlaut forms for searching. */
function deSlugTerms(term: string): string[] {
  const terms = new Set([term])
  // Try restoring common German umlaut encodings
  const umlaut = term.replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü').replace(/ss/g, 'ß')
  if (umlaut !== term) terms.add(umlaut)
  return [...terms]
}

export default defineEventHandler(async (event) => {
  const { slug } = getQuery(event) as { slug?: string }
  if (!slug || !slug.trim()) return null

  const config = useRuntimeConfig()
  const apiUrl = config.public.stadtlandzahlUrl || 'http://localhost:8000/graphql/'

  const parts = slug.split('-')
  // Try progressively longer trailing word groups as the name search term
  for (let i = parts.length - 1; i >= Math.max(0, parts.length - 5); i--) {
    const baseTerms = deSlugTerms(parts.slice(i).join(' '))
    for (const term of baseTerms) {
      try {
        const nodes = await searchNodes(apiUrl, term)
        const match = nodes.find(
          (n) => areaToSlug(String(n.prefix ?? ''), String(n.name ?? '')) === slug
        )
        if (match) return match
      } catch (_) {
        // continue
      }
    }
  }

  return null
})
