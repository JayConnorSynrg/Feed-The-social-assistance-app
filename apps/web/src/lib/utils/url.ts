type ShareType = 'post' | 'resource' | 'donate'

/**
 * Resolves the app's base URL (client-safe).
 * Uses env var -> window.location.origin -> localhost fallback.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://localhost:3000'
}

/**
 * Generates a shareable URL for social sharing.
 */
export function generateShareUrl(type: ShareType, id: string): string {
  const base = getAppUrl()
  return `${base}/s/${type}/${id}`
}

/**
 * Normalize a user-entered external URL to a safe, absolute href — the SINGLE source of truth
 * shared by the submit-time write (business-data.submitBusiness) and the display-time href
 * (the /s/business page CTA), so the stored value and the rendered link can never diverge.
 *
 * Rules:
 *  - empty / whitespace-only -> null (render no link, never a broken href)
 *  - a value that already carries a URI scheme (https:, http:, mailto:, tel:, …) is preserved
 *    verbatim — an explicit http:// is NOT rewritten to https://
 *  - a scheme-less bare domain ("example.com") is prefixed with https:// so the browser resolves
 *    it as an ABSOLUTE external URL, never an app-relative path ("/example.com")
 */
export function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // RFC-3986 scheme: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ) followed by ":". If present,
  // the caller already chose the protocol (https/http/mailto/tel) — preserve it exactly.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed
  // No scheme -> default to https so the href is absolute and points at the business's own site.
  return `https://${trimmed}`
}
