/**
 * Unit tests for src/lib/privacy-prefs.ts
 *
 * Run with: npx vitest run src/lib/privacy-prefs.test.ts
 *
 * Guards the location-consent gate's default-off invariant (INV-A/INV-B):
 * device GPS is used IF AND ONLY IF readShareLocationPref() === true.
 *   1. default-off when the key is absent
 *   2. false when the stored JSON is malformed
 *   3. true only when privacy.shareLocation === true
 *   4. false for every non-`true` value (false / truthy-string / 1 / null / missing)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PRIVACY_PREFS_KEY, readShareLocationPref } from './privacy-prefs'

// ---------------------------------------------------------------------------
// localStorage mock (mirrors src/lib/i18n.test.ts)
// ---------------------------------------------------------------------------
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// window must be defined (non-SSR) for the reader to consult localStorage.
Object.defineProperty(globalThis, 'window', {
  value: { localStorage: localStorageMock },
  writable: true,
  configurable: true,
})

describe('readShareLocationPref()', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('returns false when the prefs key is absent (default off)', () => {
    expect(readShareLocationPref()).toBe(false)
  })

  it('returns false when the stored JSON is malformed', () => {
    localStorageMock.setItem(PRIVACY_PREFS_KEY, '{ not valid json')
    expect(readShareLocationPref()).toBe(false)
  })

  it('returns true only when privacy.shareLocation === true', () => {
    localStorageMock.setItem(
      PRIVACY_PREFS_KEY,
      JSON.stringify({ privacy: { shareLocation: true } })
    )
    expect(readShareLocationPref()).toBe(true)
  })

  it('returns false when privacy.shareLocation === false', () => {
    localStorageMock.setItem(
      PRIVACY_PREFS_KEY,
      JSON.stringify({ privacy: { shareLocation: false } })
    )
    expect(readShareLocationPref()).toBe(false)
  })

  it('returns false for a truthy non-boolean value (strict equality)', () => {
    localStorageMock.setItem(
      PRIVACY_PREFS_KEY,
      JSON.stringify({ privacy: { shareLocation: 'true' } })
    )
    expect(readShareLocationPref()).toBe(false)
  })

  it('returns false when the privacy object has no shareLocation field', () => {
    localStorageMock.setItem(
      PRIVACY_PREFS_KEY,
      JSON.stringify({ privacy: { profileVisible: true } })
    )
    expect(readShareLocationPref()).toBe(false)
  })

  it('returns false when there is no privacy object at all', () => {
    localStorageMock.setItem(
      PRIVACY_PREFS_KEY,
      JSON.stringify({ notifications: {} })
    )
    expect(readShareLocationPref()).toBe(false)
  })
})
