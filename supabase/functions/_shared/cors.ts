/**
 * Shared CORS helper — single source of truth for all browser-facing edge functions.
 *
 * Implements the reflect-allowed-origin pattern (MDN recommended):
 *   - Origin IN allowlist  → ACAO: <that exact origin> + Vary: Origin
 *   - Origin NOT in allowlist (or null) → OMIT ACAO entirely + Vary: Origin
 *     The browser then denies the cross-origin request cleanly, rather than
 *     receiving a wrong-but-valid origin header (the anti-pattern).
 *
 * Vary: Origin is ALWAYS emitted so CDN/proxy caches never cross-serve
 * an ACAO response to a different origin.
 *
 * Structured log on rejection: cors.origin.rejected (level: warn).
 */

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

const STATIC_ORIGINS: readonly string[] = [
  'https://www.sourcetofeed.com', // canonical www
  'https://sourcetofeed.com',     // apex
  'capacitor://localhost',        // Mobile app (iOS)
  'http://localhost',             // Mobile app (Android webview)
  'ionic://localhost',            // Ionic dev server
  'http://localhost:3000',        // Next.js dev
  'http://localhost:3001',        // Next.js alt port
]

/**
 * The resolved allowlist Set — includes the static list plus APP_URL if set.
 * Exported for test assertions.
 */
export const ALLOWED_ORIGINS: ReadonlySet<string> = (() => {
  const set = new Set<string>(STATIC_ORIGINS)
  const appUrl = Deno.env.get('APP_URL')
  if (appUrl) set.add(appUrl)
  return set
})()

// ---------------------------------------------------------------------------
// Standard header values (shared across all responses)
// ---------------------------------------------------------------------------

const ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-request-id'
const ALLOW_METHODS = 'POST, OPTIONS'

// ---------------------------------------------------------------------------
// Structured log (mirrors the edgeLog pattern used in chat/index.ts)
// ---------------------------------------------------------------------------

function logRejected(origin: string | null, fn: string): void {
  console.log(
    JSON.stringify({
      level: 'warn',
      event: 'cors.origin.rejected',
      timestamp: new Date().toISOString(),
      origin: origin ?? '(null)',
      fn,
      allowedCount: ALLOWED_ORIGINS.size,
    })
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns CORS headers for a given request origin.
 *
 * @param origin - Value of the `Origin` request header (may be null for non-browser callers).
 * @param fn     - Function name used in the rejection log label (e.g. 'chat').
 */
export function getCorsHeaders(
  origin: string | null,
  fn = 'unknown'
): Record<string, string> {
  if (origin !== null && ALLOWED_ORIGINS.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': ALLOW_HEADERS,
      'Access-Control-Allow-Methods': ALLOW_METHODS,
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    }
  }

  // Origin is not in the allowlist (or is null — server-to-server caller).
  // Emit a warn log for browser origins only (null = non-browser, expected for cron/server callers).
  if (origin !== null) {
    logRejected(origin, fn)
  }

  // OMIT Access-Control-Allow-Origin so the browser denies the request.
  return {
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Allow-Methods': ALLOW_METHODS,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}
