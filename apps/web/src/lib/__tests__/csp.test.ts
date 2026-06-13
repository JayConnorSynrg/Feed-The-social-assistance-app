// apps/web/src/lib/__tests__/csp.test.ts
// Unit tests for the Wave 6b per-request CSP nonce + policy builder.

import { describe, it, expect } from 'vitest'
import { buildCsp, generateNonce } from '../csp'

const NONCE = 'dGVzdC1ub25jZQ==' // "test-nonce" base64

describe('generateNonce', () => {
  it('produces a non-empty base64 string', () => {
    const n = generateNonce()
    expect(typeof n).toBe('string')
    expect(n.length).toBeGreaterThan(0)
    // base64 alphabet only
    expect(n).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('produces a fresh value each call (single-use)', () => {
    expect(generateNonce()).not.toBe(generateNonce())
  })
})

describe('buildCsp — main app profile', () => {
  const csp = buildCsp(NONCE)

  it('uses the nonce + strict-dynamic in script-src', () => {
    expect(csp).toContain(`script-src 'nonce-${NONCE}' 'strict-dynamic'`)
  })

  it("no longer grants inline-script execution via 'unsafe-inline' in script-src", () => {
    // Isolate the script-src directive and assert it carries no 'unsafe-inline'.
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src '))
    expect(scriptSrc).toBeDefined()
    expect(scriptSrc).not.toContain("'unsafe-inline'")
  })

  it("keeps 'unsafe-inline' in style-src (Tailwind runtime utilities, non-script)", () => {
    const styleSrc = csp.split('; ').find((d) => d.startsWith('style-src '))
    expect(styleSrc).toBe("style-src 'self' 'unsafe-inline'")
  })

  it('retains the script host allowlist as CSP2 back-compat fallback', () => {
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src '))!
    expect(scriptSrc).toContain('https://va.vercel-scripts.com')
    expect(scriptSrc).toContain('https://challenges.cloudflare.com')
  })

  it('preserves every non-script directive byte-for-byte', () => {
    const directives = csp.split('; ')
    expect(directives).toContain("default-src 'self'")
    expect(directives).toContain(
      "img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com"
    )
    expect(directives).toContain(
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://*.mapbox.com https://va.vercel-scripts.com https://challenges.cloudflare.com"
    )
    expect(directives).toContain("worker-src 'self' blob:")
    expect(directives).toContain("font-src 'self'")
    expect(directives).toContain('frame-src https://challenges.cloudflare.com')
    expect(directives).toContain("frame-ancestors 'none'")
    expect(directives).toContain("base-uri 'self'")
    expect(directives).toContain("form-action 'self'")
  })
})

describe('buildCsp — embed profile', () => {
  const csp = buildCsp(NONCE, { embed: true })

  it('uses the nonce + strict-dynamic in script-src', () => {
    expect(csp).toContain(`script-src 'nonce-${NONCE}' 'strict-dynamic'`)
  })

  it('script-src has no inline grant and no third-party hosts', () => {
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src '))!
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain('vercel-scripts')
    expect(scriptSrc).not.toContain('cloudflare')
  })

  it('preserves the embed-specific frame/form directives', () => {
    const directives = csp.split('; ')
    expect(directives).toContain('frame-ancestors *')
    expect(directives).toContain("form-action 'none'")
    // main-app-only directives must NOT leak into embed
    expect(directives).not.toContain("frame-ancestors 'none'")
    expect(directives).not.toContain('frame-src https://challenges.cloudflare.com')
    expect(directives).not.toContain("worker-src 'self' blob:")
  })
})
