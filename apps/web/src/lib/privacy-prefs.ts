// apps/web/src/lib/privacy-prefs.ts
//
// Single source of truth for the location-sharing consent gate.
//
// "Share Location" means: auto-center the map to the user's device area via GPS.
// It is OFF by default and only turns on after an explicit in-UI confirmation
// (see settings-panel PrivacySection). Device GPS is acquired anywhere in the
// app IF AND ONLY IF readShareLocationPref() === true.
//
// Profile / manually-entered location centering does NOT depend on this pref and
// stays on regardless (map-panel Priority 1a/1b).
//
// The localStorage key literal and the read logic live here ONLY. settings-panel
// (writer) and map-panel + feed-panel (readers) import from this module so the
// key is never duplicated.

/** localStorage key holding the JSON prefs blob { notifications, privacy, accessibility }. */
export const PRIVACY_PREFS_KEY = 'feed-settings-prefs'

/**
 * Whether the user has explicitly opted in to device-location sharing.
 *
 * Strict: returns true ONLY when the stored JSON has privacy.shareLocation === true.
 * Every other case — no window (SSR), absent key, malformed JSON, missing field,
 * or any non-`true` value — returns false. This is the safe default (GPS off).
 */
export function readShareLocationPref(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = window.localStorage.getItem(PRIVACY_PREFS_KEY)
    if (!stored) return false
    const parsed = JSON.parse(stored) as { privacy?: { shareLocation?: unknown } }
    return parsed?.privacy?.shareLocation === true
  } catch {
    return false
  }
}
