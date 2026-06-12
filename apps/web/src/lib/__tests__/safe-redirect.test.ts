/**
 * safeRelativePath — open-redirect guard tests (CWE-601).
 *
 * Each block-vector below was empirically confirmed to resolve OFF-origin
 * under `new URL(value, 'https://app.example')` (or to execute via a
 * `javascript:` scheme); the guard MUST reject them. Allow-vectors resolve
 * same-origin and MUST pass through unchanged.
 */
import { describe, it, expect } from 'vitest'
import { safeRelativePath } from '../safe-redirect'

describe('safeRelativePath', () => {
  describe('blocks origin-escaping vectors', () => {
    const blocked: Array<[string, string | null | undefined]> = [
      ['protocol-relative //', '//evil.com'],
      ['absolute https URL', 'https://evil.com'],
      ['scheme-relative http:', 'http:evil.com'],
      ['backslash after slash (browser normalizes \\ to /)', '/\\evil.com'],
      ['double backslash', '\\\\evil.com'],
      ['javascript: scheme', 'javascript:alert(1)'],
      ['leading whitespace before //', ' //evil.com'],
      ['embedded TAB (stripped then re-evaluated)', '/\t/evil.com'],
      ['embedded LF (stripped then re-evaluated)', '/\n/evil.com'],
      ['embedded CR', '/\r/evil.com'],
      ['NUL byte', '/foo\x00bar'],
      ['DEL byte (0x7f)', '/foo\x7fbar'],
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
    ]

    it.each(blocked)('blocks %s', (_label, vector) => {
      expect(safeRelativePath(vector)).toBe('/')
    })
  })

  describe('allows safe same-origin relative paths', () => {
    const allowed = ['/onboarding', '/reset-password?x=1', '/a/b/c', '/']

    it.each(allowed)('allows %s', (vector) => {
      expect(safeRelativePath(vector)).toBe(vector)
    })
  })

  describe('fallback behavior', () => {
    it('returns the default fallback "/" when none supplied', () => {
      expect(safeRelativePath('//evil.com')).toBe('/')
    })

    it('returns a custom fallback for a blocked vector', () => {
      expect(safeRelativePath('//evil.com', '/onboarding')).toBe('/onboarding')
    })

    it('returns the custom fallback for null', () => {
      expect(safeRelativePath(null, '/onboarding')).toBe('/onboarding')
    })

    it('returns the allowed path even when a custom fallback is supplied', () => {
      expect(safeRelativePath('/reset-password', '/onboarding')).toBe('/reset-password')
    })

    it('treats the fallback path itself as a passthrough when supplied as raw', () => {
      expect(safeRelativePath('/onboarding', '/onboarding')).toBe('/onboarding')
    })
  })
})
