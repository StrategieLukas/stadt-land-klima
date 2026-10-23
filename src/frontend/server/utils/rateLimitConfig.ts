/**
 * Central configuration for API rate limiting.
 *
 * Each key corresponds to a rate-limited endpoint. Values define the maximum
 * number of requests allowed per IP within the sliding window (in seconds).
 *
 * All entries below are enforced in code via `rateLimit(event, 'key')`.
 * Adjust these values without modifying endpoint code.
 */

export interface RateLimitPreset {
  /** Maximum number of requests allowed in the window. */
  max: number;
  /** Sliding window size in seconds. */
  windowSeconds: number;
}

export const RATE_LIMIT_CONFIG: Record<string, RateLimitPreset> = {
  "editor-login": { max: 10, windowSeconds: 60 },
  "editor-session": { max: 120, windowSeconds: 60 },
  "editor-logout": { max: 30, windowSeconds: 60 },
  "editor-upload": { max: 10, windowSeconds: 60 },
  "editor-cms": { max: 600, windowSeconds: 60 },

  // ========================================================================
  // WRITE ENDPOINTS (POST/PUT/PATCH/DELETE)
  // All data mutations — strict limits to prevent abuse.
  // ========================================================================

  /** Newsletter subscription */
  newsletter: { max: 10, windowSeconds: 60 },
  /** Feedback form submission */
  feedback: { max: 30, windowSeconds: 60 },
  "feedback-delivery": { max: 10, windowSeconds: 3600 },
  /** Generic form response submission */
  "form-response": { max: 10, windowSeconds: 60 },
  /** Municipality registration */
  register: { max: 10, windowSeconds: 60 },
  /** Article submission */
  article: { max: 10, windowSeconds: 60 },
  /** Candidate answer submission */
  "candidate-answers": { max: 120, windowSeconds: 60 },
  /** Wahlcheck completion tracking */
  wahlcheck: { max: 60, windowSeconds: 60 },

  // ========================================================================
  // PDF ENDPOINTS (expensive server-side rendering)
  // These trigger Puppeteer/Playwright PDF generation — high CPU/memory cost.
  // ========================================================================

  /** Election PDF generation */
  "election-pdf": { max: 5, windowSeconds: 60 },
  /** Municipality PDF generation */
  "municipality-pdf": { max: 5, windowSeconds: 60 },

  // ========================================================================
  // EXPENSIVE READ ENDPOINTS
  // These trigger DB queries, external API calls, or token validation.
  // ========================================================================

  /** Content search via Meilisearch */
  "content-search": { max: 120, windowSeconds: 60 },
  /** Stadt-Land-Zahl proxy (upstream API call) */
  stadtlandzahl: { max: 300, windowSeconds: 60 },
  /** ALTCHA CAPTCHA challenge generation */
  "math-challenge": { max: 60, windowSeconds: 60 },
  "csp-report": { max: 60, windowSeconds: 60 },
  altcha: { max: 60, windowSeconds: 60 },
  /** Municipality preview (token validation + full data load) */
  "municipality-preview": { max: 60, windowSeconds: 60 },
  /** Candidate info lookup (token validation) */
  "candidate-info": { max: 60, windowSeconds: 60 },
  /** Registration status check */
  "register-check": { max: 60, windowSeconds: 60 },
  /** Tour media file serving */
  "tour-media": { max: 600, windowSeconds: 60 },
  /** Event ICS calendar export */
  "event-ics": { max: 120, windowSeconds: 60 },
  /** Carto basemap tile proxy */
  "carto-basemap": { max: 1200, windowSeconds: 60 },
  /** AI agent registration endpoint */
  "ai-register": { max: 30, windowSeconds: 60 },
};

/**
 * When adding a new API endpoint, add a rate limit entry here and enforce it
 * in code by calling `rateLimit(event, 'your-key')` at the start of the handler.
 *
 * - Write endpoints (POST/PUT/PATCH/DELETE): max: 5, windowSeconds: 60
 * - PDF endpoints: max: 5, windowSeconds: 60 (expensive server-side rendering)
 * - Expensive reads (DB queries, external APIs, token validation): max: 10, windowSeconds: 60
 *
 * Cheap cached reads (Directus queries with response caching) do not need
 * application-level rate limiting — they're protected by nginx rate limits.
 */

/**
 * Get the rate limit preset for a given key.
 * Returns a default of 10 requests per minute if the key is not found.
 */
export function getRateLimitPreset(key: string): RateLimitPreset {
  return RATE_LIMIT_CONFIG[key] ?? { max: 10, windowSeconds: 60 };
}
