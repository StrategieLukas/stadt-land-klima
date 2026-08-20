/**
 * Singleton loader for the pre-built municipalities-by-state manifest.
 * Fetched once per session, shared across all Bundesland drill-downs.
 * Falls back to null if the endpoint isn't deployed yet.
 */

let _promise = null;
let _cached = null;
let _retryAfter = 0;

const RETRY_DELAY_MS = 5_000;

export async function fetchMunicipalitiesManifest(baseUrl) {
  if (_cached) return _cached;
  if (!_promise && Date.now() < _retryAfter) return null;
  if (!_promise) {
    _promise = $fetch(`${baseUrl}/api/manifests/municipalities-by-state`)
      .then((d) => {
        _cached = d;
        _retryAfter = 0;
        return d;
      })
      .catch(() => {
        // Do not leave a rejected first request cached for the whole browser
        // session. A short cooldown prevents rapid retries while allowing the
        // next state selection to recover from a transient proxy failure.
        _promise = null;
        _retryAfter = Date.now() + RETRY_DELAY_MS;
        return null;
      });
  }
  return _promise;
}

export function clearMunicipalitiesManifestCache() {
  _promise = null;
  _cached = null;
  _retryAfter = 0;
}
