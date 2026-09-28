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
 *  - a value carrying an ALLOWLISTED scheme (https:, http:, mailto:, tel:) is preserved verbatim —
 *    an explicit http:// is NOT rewritten to https://
 *  - anything else (a scheme-less bare domain, OR a dangerous scheme like javascript:/data:/
 *    vbscript:) is https://-prefixed. For a bare domain that yields the intended absolute external
 *    URL; for a dangerous scheme it yields a harmless broken link ("https://javascript:alert(1)"),
 *    never an executable href — defense-in-depth for the anon-facing /s/business CTA.
 */
export function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Allowlist: only these schemes are safe to preserve as a rendered href. Every other value
  // (including javascript:/data:/vbscript:) falls through and gets https://-prefixed below.
  if (/^(https?|mailto|tel):/i.test(trimmed)) return trimmed
  // No allowlisted scheme -> default to https so the href is absolute (points at the business's own
  // site) or, for a dangerous scheme, a non-executable broken link.
  return `https://${trimmed}`
}
