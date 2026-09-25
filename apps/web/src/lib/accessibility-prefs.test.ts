/**
 * Unit tests for src/lib/accessibility-prefs.ts
 *
 * Run with: npx vitest run src/lib/accessibility-prefs.test.ts
 *
 * Covers:
 *   1. resolveA11y cascade — present user override > OS > default(false)
 *   2. applyA11yAttributes — ON sets the right attribute; OFF/absent clears it
 *   3. readA11yUserPrefs — valid blob, OFF-dropped, malformed → defaults ({})
 *   4. toUserPrefs — only ON keys survive
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  resolveA11y,
  applyA11yAttributes,
  readA11yUserPrefs,
  toUserPrefs,
  type A11yUserPrefs,
} from './accessibility-prefs'
import { PRIVACY_PREFS_KEY } from './privacy-prefs'

// ---------------------------------------------------------------------------
// localStorage mock (mirrors i18n.test.ts harness)
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

// Ensure window exists (node env) so the SSR guards take the browser path.
Object.defineProperty(globalThis, 'window', {
  value: globalThis,
  writable: true,
  configurable: true,
})

// ---------------------------------------------------------------------------
// Minimal fake root element with an attribute map (no DOM in node env)
// ---------------------------------------------------------------------------
function makeRoot() {
  const attrs = new Map<string, string>()
  return {
    setAttribute: (k: string, v: string) => { attrs.set(k, v) },
    removeAttribute: (k: string) => { attrs.delete(k) },
    getAttribute: (k: string) => (attrs.has(k) ? attrs.get(k)! : null),
  } as unknown as HTMLElement
}

// ---------------------------------------------------------------------------
// resolveA11y — the cascade
// ---------------------------------------------------------------------------
describe('resolveA11y', () => {
  const osOff = { prefersContrastMore: false, prefersReducedMotion: false }
  const osOn = { prefersContrastMore: true, prefersReducedMotion: true }

  it('defaults to false when neither user nor OS express a preference', () => {
    expect(resolveA11y({}, osOff)).toEqual({
      highContrast: false,
      largeText: false,
      reduceMotion: false,
    })
  })

  it('follows the OS when the user has set nothing', () => {
    expect(resolveA11y({}, osOn)).toEqual({
      highContrast: true,
      largeText: false, // no OS baseline for text size
      reduceMotion: true,
    })
  })

  it('a present user override wins over the OS baseline', () => {
    // User turned contrast ON while OS is off; user set nothing for motion
    // while OS reduces motion → OS still governs motion.
    expect(resolveA11y({ highContrast: true }, { prefersContrastMore: false, prefersReducedMotion: true }))
      .toEqual({ highContrast: true, largeText: false, reduceMotion: true })
  })
})

// ---------------------------------------------------------------------------
// applyA11yAttributes — both directions
// ---------------------------------------------------------------------------
describe('applyA11yAttributes', () => {
  it('sets the on-value attributes when prefs are ON', () => {
    const root = makeRoot()
    applyA11yAttributes({ highContrast: true, largeText: true, reduceMotion: true }, root)
    expect(root.getAttribute('data-contrast')).toBe('more')
    expect(root.getAttribute('data-text-size')).toBe('large')
    expect(root.getAttribute('data-motion')).toBe('reduce')
  })

  it('removes attributes when prefs are absent (OFF reverts to OS baseline)', () => {
    const root = makeRoot()
    // Pre-seed as if a previous ON state was applied.
    applyA11yAttributes({ highContrast: true, largeText: true, reduceMotion: true }, root)
    applyA11yAttributes({}, root)
    expect(root.getAttribute('data-contrast')).toBeNull()
    expect(root.getAttribute('data-text-size')).toBeNull()
    expect(root.getAttribute('data-motion')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// toUserPrefs — only ON keys survive
// ---------------------------------------------------------------------------
describe('toUserPrefs', () => {
  it('keeps only keys set to true', () => {
    expect(toUserPrefs({ highContrast: true, largeText: false, reduceMotion: true }))
      .toEqual({ highContrast: true, reduceMotion: true })
  })

  it('returns {} for null / non-object', () => {
    expect(toUserPrefs(null)).toEqual({})
    expect(toUserPrefs(undefined)).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// readA11yUserPrefs — storage integration
// ---------------------------------------------------------------------------
describe('readA11yUserPrefs', () => {
  beforeEach(() => localStorageMock.clear())

  it('returns {} when the prefs blob is absent', () => {
    expect(readA11yUserPrefs()).toEqual({})
  })

  it('reads ON keys from the shared prefs blob and drops OFF keys', () => {
    localStorageMock.setItem(PRIVACY_PREFS_KEY, JSON.stringify({
      accessibility: { highContrast: true, largeText: false, reduceMotion: true },
    }))
    const prefs: A11yUserPrefs = readA11yUserPrefs()
    expect(prefs).toEqual({ highContrast: true, reduceMotion: true })
  })

  it('returns {} when localStorage holds malformed JSON', () => {
    localStorageMock.setItem(PRIVACY_PREFS_KEY, '{not valid json')
    expect(readA11yUserPrefs()).toEqual({})
  })

  it('returns {} when the blob has no accessibility object', () => {
    localStorageMock.setItem(PRIVACY_PREFS_KEY, JSON.stringify({ privacy: { profileVisible: true } }))
    expect(readA11yUserPrefs()).toEqual({})
  })
})
