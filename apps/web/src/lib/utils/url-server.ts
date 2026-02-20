import { headers } from 'next/headers'

/**
 * Server-only: resolves app URL from request headers.
 * Only import this from Server Components or API routes.
 */
export async function getAppUrlFromHeaders(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') || h.get('host')
    const proto = h.get('x-forwarded-proto') || 'https'
    if (host) {
      return `${proto}://${host}`
    }
  } catch {
    // Not in a server context — fall through
  }
  return 'http://localhost:3000'
}
