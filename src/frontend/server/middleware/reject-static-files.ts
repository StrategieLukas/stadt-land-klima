/**
 * Reject requests for static file extensions (e.g. *.map, *.js, *.css)
 * that don't match any actual asset but would otherwise fall through to the
 * [slug].vue catch-all and generate a noisy [fatal] 404 log entry.
 *
 * Common culprit: React DevTools browser extension fetching installHook.js.map
 */
const STATIC_EXTENSIONS = /\.(map|js|css|wasm|ts|jsx|tsx|mjs|cjs|ico|png|jpg|jpeg|gif|webp|svg|woff|woff2|ttf|eot)$/i

export default defineEventHandler((event) => {
  const url = event.node.req.url ?? ''
  // Strip query string before checking extension
  const path = url.split('?')[0]
  if (STATIC_EXTENSIONS.test(path)) {
    setResponseStatus(event, 404)
    return null
  }
})
