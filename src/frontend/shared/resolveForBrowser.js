/**
 * When the app is accessed from a device other than localhost (e.g. a phone
 * testing at p15v3jmk.local:8080), client-side fetches to "localhost" or
 * Docker-internal service names fail because the remote device cannot resolve
 * them.
 *
 * This function replaces the hostname of a configured URL with the actual
 * browser hostname when ALL of the following are true:
 *   - we are running in a browser (window is defined)
 *   - the browser is NOT at "localhost" (i.e. being accessed from another device)
 *   - the configured URL uses "localhost", "127.0.0.1", or a single-label
 *     hostname (Docker service names like "directus", "web", etc.)
 *
 * In production the configured URL is always a proper FQDN, so no replacement
 * ever happens there.
 */
export default function resolveForBrowser(configuredUrl) {
  if (!configuredUrl || typeof window === 'undefined') return configuredUrl;
  if (window.location.hostname === 'localhost') return configuredUrl;
  try {
    const u = new URL(configuredUrl);
    const h = u.hostname;
    // Replace localhost, 127.0.0.1, or Docker service names (no dots, not an IP)
    if (h === 'localhost' || h === '127.0.0.1' || (!h.includes('.') && !/^\d/.test(h))) {
      u.hostname = window.location.hostname;
      return u.toString();
    }
  } catch {}
  return configuredUrl;
}
