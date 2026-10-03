const LEGACY_ELECTION_PATHS = new Set(['/wahl', '/wahlcheck', '/wahlen'])

export default defineEventHandler((event) => {
  const requestTarget = event.node.req.url ?? '/'
  const queryIndex = requestTarget.indexOf('?')
  const requestPath = (queryIndex === -1 ? requestTarget : requestTarget.slice(0, queryIndex)).replace(/\/+$/, '') || '/'
  const search = queryIndex === -1 ? '' : requestTarget.slice(queryIndex)

  if (!LEGACY_ELECTION_PATHS.has(requestPath)) {
    return
  }

  const location = `/elections/wahlcheck${search}`
  event.node.res.statusCode = 301
  event.node.res.setHeader('Location', location)
  event.node.res.end()
})
