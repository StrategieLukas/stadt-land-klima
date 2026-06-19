/**
 * Singleton loader for the pre-built municipalities-by-state manifest.
 * Fetched once per session, shared across all Bundesland drill-downs.
 * Falls back to null if the endpoint isn't deployed yet.
 */

let _promise = null
let _cached  = null

export async function fetchMunicipalitiesManifest(baseUrl) {
  if (_cached) return _cached
  if (!_promise) {
    _promise = $fetch(`${baseUrl}/api/manifests/municipalities-by-state`)
      .then(d => { _cached = d; return d })
      .catch(() => null)
  }
  return _promise
}

export function clearMunicipalitiesManifestCache() {
  _promise = null
  _cached  = null
}
