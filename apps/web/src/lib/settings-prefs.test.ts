/**
 * Unit tests for src/lib/settings-prefs.ts — the defensive merge used by
 * loadLocalPrefs(). Guards the Wave A regression: a legacy `feed-settings-prefs`
 * blob with NO accessibility key must yield full default accessibility (never
 * undefined), so the functional a11y toggles' `!group[key]` read cannot throw.
 */

import { describe, it, expect } from 'vitest'
import { mergeStoredPrefs } from './settings-prefs'

const DEFAULTS = {
  notifications: { emailUpdates: true, pushNotifications: true },
  privacy: { profileVisible: true, shareLocation: false },
  accessibility: { highContrast: false, largeText: false, reduceMotion: false },
}

describe('mergeStoredPrefs', () => {
  it('fills accessibility from defaults when a legacy blob omits it', () => {
    const parsed = { privacy: { profileVisible: false } } // no accessibility key
    const out = mergeStoredPrefs(parsed, DEFAULTS, true)
    expect(out.accessibility).toEqual(DEFAULTS.accessibility)
    expect(out.accessibility).not.toBeUndefined()
    // Every a11y key is a defined boolean → handleToggle's `!group[key]` is safe.
    expect(typeof out.accessibility.highContrast).toBe('boolean')
    expect(typeof out.accessibility.largeText).toBe('boolean')
    expect(typeof out.accessibility.reduceMotion).toBe('boolean')
  })

  it('does not throw when toggling an a11y key after merging a legacy blob', () => {
    const out = mergeStoredPrefs({ privacy: {} }, DEFAULTS, true)
    expect(() => !out.accessibility.reduceMotion).not.toThrow()
  })

  it('fills notifications from defaults when a legacy blob omits it', () => {
    const parsed = { accessibility: { highContrast: true, largeText: false, reduceMotion: false } }
    const out = mergeStoredPrefs(parsed, DEFAULTS, true)
    expect(out.notifications).toEqual(DEFAULTS.notifications)
  })

  it('preserves stored values while filling only the missing keys', () => {
    const parsed = { accessibility: { highContrast: true } } // largeText/reduceMotion missing
    const out = mergeStoredPrefs(parsed, DEFAULTS, true)
    expect(out.accessibility.highContrast).toBe(true)
    expect(out.accessibility.largeText).toBe(false)
    expect(out.accessibility.reduceMotion).toBe(false)
  })

  it('always overlays the authoritative chatPersonalization value onto privacy', () => {
    const onParsed = { privacy: { chatPersonalization: false } }
    expect(mergeStoredPrefs(onParsed, DEFAULTS, true).privacy.chatPersonalization).toBe(true)
    expect(mergeStoredPrefs({}, DEFAULTS, false).privacy.chatPersonalization).toBe(false)
  })

  it('handles an empty / non-object parsed blob by returning full defaults', () => {
    const out = mergeStoredPrefs({}, DEFAULTS, true)
    expect(out.notifications).toEqual(DEFAULTS.notifications)
    expect(out.accessibility).toEqual(DEFAULTS.accessibility)
    expect(out.privacy.profileVisible).toBe(true)
  })
})
