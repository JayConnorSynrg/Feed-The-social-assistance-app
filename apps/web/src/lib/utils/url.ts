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
