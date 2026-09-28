// apps/web/src/lib/utils/url.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Unit spec for normalizeUrl — the ONE shared helper used by both the submitBusiness write and
// the /s/business display href. Locking its behavior here keeps the stored value and the rendered
// link identical: a scheme-less domain always becomes an absolute https:// URL (never an
// app-relative path), an explicit scheme is preserved verbatim, and empty input is null.

import { describe, it, expect } from 'vitest'
import { normalizeUrl } from './url'

describe('normalizeUrl', () => {
  it('prefixes a scheme-less bare domain with https:// (INV1/INV2 — never app-relative)', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
    expect(normalizeUrl('sub.example.com/path?q=1')).toBe('https://sub.example.com/path?q=1')
  })

  it('preserves an explicit https:// value unchanged', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com')
  })

  it('preserves an explicit http:// value unchanged — does NOT upgrade to https', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com')
  })

  it('returns null for empty and whitespace-only input (render no link)', () => {
    expect(normalizeUrl('')).toBeNull()
    expect(normalizeUrl('   ')).toBeNull()
    expect(normalizeUrl(null)).toBeNull()
    expect(normalizeUrl(undefined)).toBeNull()
  })

  it('trims surrounding whitespace before normalizing', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com')
    expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com')
  })

  it('leaves mailto: and tel: schemes alone when already present', () => {
    expect(normalizeUrl('mailto:hello@example.com')).toBe('mailto:hello@example.com')
    expect(normalizeUrl('tel:+18025550100')).toBe('tel:+18025550100')
  })

  it('neutralizes dangerous schemes — never preserves javascript:/data:/vbscript: verbatim', () => {
    // Allowlist hardening (defense-in-depth for the anon-facing /s/business CTA): a dangerous
    // scheme must NOT survive as an executable href. It gets https://-prefixed into a harmless
    // broken link, so the rendered href never starts with the dangerous scheme.
    const js = normalizeUrl('javascript:alert(1)')
    expect(js).not.toMatch(/^javascript:/i)
    expect(js).toBe('https://javascript:alert(1)')

    const data = normalizeUrl('data:text/html,x')
    expect(data).not.toMatch(/^data:/i)
    expect(data).toBe('https://data:text/html,x')

    const vb = normalizeUrl('vbscript:x')
    expect(vb).not.toMatch(/^vbscript:/i)
    expect(vb).toBe('https://vbscript:x')
  })

  it('preserves ONLY the allowlisted schemes verbatim (http/https/mailto/tel)', () => {
    expect(normalizeUrl('https://x.com')).toBe('https://x.com')
    expect(normalizeUrl('http://x.com')).toBe('http://x.com')
    expect(normalizeUrl('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(normalizeUrl('tel:+18025550100')).toBe('tel:+18025550100')
  })
})
