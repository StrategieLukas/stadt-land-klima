import type { Request, Response, Router } from 'express';
import type { EndpointConfig } from '@directus/extensions-sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UnsplashPhoto {
  id: string;
  description: string;
  urls: {
    thumb: string;
    small: string;
    regular: string;
  };
  user: {
    name: string;
    link: string;
  };
  download_location: string;
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  page: number;
  per_page: number;
  results: UnsplashPhoto[];
}

/** Shape returned directly by the Unsplash REST API */
interface UnsplashApiPhoto {
  id: string;
  alt_description: string | null;
  description: string | null;
  urls: { thumb: string; small: string; regular: string };
  user: { name: string; links: { html: string } };
  links: { download_location: string };
}

interface UnsplashApiSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashApiPhoto[];
}

interface SearchQuery {
  q?: string;
  page?: string;
  per_page?: string;
}

interface TriggerDownloadBody {
  download_location?: string;
}

/** Generic error shape returned by this extension */
interface ApiError {
  error: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UPSTREAM_BASE = 'https://api.unsplash.com';
/** Abort upstream requests after this many milliseconds */
const FETCH_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a fetch AbortSignal that fires after `ms` milliseconds.
 * Falls back gracefully on older Node versions that lack AbortSignal.timeout().
 */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/**
 * Returns true when the caller has a valid Directus session or token.
 * Relies on the `accountability` property that Directus injects into every
 * request object via its authentication middleware.
 */
function isAuthenticated(req: Request): boolean {
  const accountability = (req as Request & { accountability?: { user?: string | null } }).accountability;
  return accountability?.user != null;
}

/**
 * Parse a positive integer query-string parameter, clamped to [min, max].
 * Falls back to `defaultValue` when the input is absent or not a valid number.
 */
function parseIntParam(raw: string | undefined, defaultValue: number, min: number, max: number): number {
  if (raw == null) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, parsed));
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default {
  id: 'unsplash',
  handler: (
    router: Router,
    { env, logger }: { env: Record<string, string>; logger: { info(...a: unknown[]): void; error(...a: unknown[]): void; warn(...a: unknown[]): void } },
  ): void => {
    // ------------------------------------------------------------------
    // Configuration guard
    // ------------------------------------------------------------------
    const ACCESS_KEY: string | undefined = env['UNSPLASH_ACCESS_KEY'];

    if (!ACCESS_KEY) {
      logger.error('[unsplash] UNSPLASH_ACCESS_KEY is not set – all requests will be rejected');
      router.use((_req: Request, res: Response<ApiError>) => {
        res.status(503).json({ error: 'Unsplash integration is not configured' });
      });
      return;
    }

    /** Shared headers for every upstream Unsplash request */
    const unsplashHeaders: HeadersInit = {
      Authorization: `Client-ID ${ACCESS_KEY}`,
      'Accept-Version': 'v1',
    };

    // ------------------------------------------------------------------
    // GET /unsplash/search?q=QUERY&page=N&per_page=N
    // ------------------------------------------------------------------
    router.get(
      '/search',
      async (
        req: Request<Record<string, never>, UnsplashSearchResponse | ApiError, never, SearchQuery>,
        res: Response<UnsplashSearchResponse | ApiError>,
      ) => {
        if (!isAuthenticated(req)) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const q = (req.query.q ?? '').trim();
        if (!q) {
          return res.status(400).json({ error: 'Missing required query parameter "q"' });
        }

        const page = parseIntParam(req.query.page, 1, 1, 10_000);
        const perPage = parseIntParam(req.query.per_page, 24, 1, 30);

        const url = new URL(`${UPSTREAM_BASE}/search/photos`);
        url.searchParams.set('query', q);
        url.searchParams.set('page', String(page));
        url.searchParams.set('per_page', String(perPage));
        url.searchParams.set('orientation', 'landscape');

        try {
          const response = await fetch(url.toString(), {
            headers: unsplashHeaders,
            signal: timeoutSignal(FETCH_TIMEOUT_MS),
          });

          if (!response.ok) {
            const text = await response.text();
            logger.warn(`[unsplash] upstream search returned ${response.status}: ${text}`);
            return res.status(response.status).json({ error: 'Upstream error from Unsplash' });
          }

          const data = (await response.json()) as UnsplashApiSearchResponse;

          const photos: UnsplashPhoto[] = (data.results ?? []).map((p) => ({
            id: p.id,
            description: p.alt_description ?? p.description ?? '',
            urls: {
              thumb: p.urls.thumb,
              small: p.urls.small,
              regular: p.urls.regular,
            },
            user: {
              name: p.user.name,
              link: p.user.links.html,
            },
            download_location: p.links.download_location,
          }));

          return res.json({
            total: data.total,
            total_pages: data.total_pages,
            page,
            per_page: perPage,
            results: photos,
          });
        } catch (err: unknown) {
          const isTimeout = err instanceof Error && err.name === 'TimeoutError';
          logger.error('[unsplash] search error:', err);
          return res
            .status(isTimeout ? 504 : 500)
            .json({ error: isTimeout ? 'Upstream request timed out' : 'Upstream request failed' });
        }
      },
    );

    // ------------------------------------------------------------------
    // POST /unsplash/trigger-download
    // Body: { download_location: string }
    // Required by Unsplash API guidelines when a photo is downloaded/used.
    // ------------------------------------------------------------------
    router.post(
      '/trigger-download',
      async (
        req: Request<Record<string, never>, { ok: boolean } | ApiError, TriggerDownloadBody>,
        res: Response<{ ok: boolean } | ApiError>,
      ) => {
        if (!isAuthenticated(req)) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const { download_location } = req.body ?? {};

        if (!download_location || typeof download_location !== 'string') {
          return res.status(400).json({ error: 'Missing or invalid "download_location" in request body' });
        }

        // Validate using URL constructor to avoid SSRF via URL encoding tricks
        let parsed: URL;
        try {
          parsed = new URL(download_location);
        } catch {
          return res.status(400).json({ error: 'Malformed download_location URL' });
        }

        if (parsed.hostname !== 'api.unsplash.com') {
          return res.status(400).json({ error: 'download_location must point to api.unsplash.com' });
        }

        try {
          await fetch(download_location, {
            headers: unsplashHeaders,
            signal: timeoutSignal(FETCH_TIMEOUT_MS),
          });
          return res.json({ ok: true });
        } catch (err: unknown) {
          // Non-fatal – attribution ping failed but we must not block the user
          logger.warn('[unsplash] trigger-download failed (non-fatal):', err);
          return res.json({ ok: false });
        }
      },
    );
  },
} satisfies EndpointConfig;
