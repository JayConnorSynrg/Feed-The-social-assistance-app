// apps/web/src/lib/accessibility-prefs.ts
//
// Single source of truth for the per-device accessibility overrides
// (High Contrast / Large Text / Reduce Motion) that Settings → Accessibility
// exposes. These are per-device render preferences applied to
// document.documentElement as data-* attributes; globals.css turns each
// attribute into a visible change, and honors the matching OS media query as
// the baseline when the user has expressed no explicit preference.
//
// Storage: the accessibility block of the shared `feed-settings-prefs` blob
// (PRIVACY_PREFS_KEY) — the SAME single store the rest of the panel uses. No
// server mirror in Wave A (a per-device, pre-paint render preference).
//
// Resolution cascade (per key): a PRESENT override (the toggle is ON) applies
// its data-* attribute and OVERRIDES the OS media query; an ABSENT override
// (the toggle is OFF, or never set) removes the attribute and FOLLOWS the OS.
//
//   - highContrast → data-contrast="more"  | (absent → OS: prefers-contrast)
//   - largeText    → data-text-size="large" | (absent)  [no OS baseline]
//   - reduceMotion → data-motion="reduce"  | (absent → OS: prefers-reduced-motion)
//
// Because OFF maps to ABSENT, the existing framework-level reduced-motion
// behavior is preserved for every key the user has not turned ON — the OS
// media query in globals.css still governs (INV-A11Y-MOTION-NOREG).

import { PRIVACY_PREFS_KEY } from './privacy-prefs'

/** The three per-device accessibility preferences. */
export interface A11yPrefs {
  highContrast: boolean
  largeText: boolean
  reduceMotion: boolean
}

/**
 * User overrides. A key is present ONLY when the user has that preference ON;
 * an absent key means "follow the OS" (the toggle is OFF or never set).
 */
export type A11yUserPrefs = Partial<A11yPrefs>

/** OS-level baseline, read from media queries. */
export interface OsA11y {
  prefersContrastMore: boolean
  prefersReducedMotion: boolean
}

/**
 * Resolve the effective preference set from user overrides and the OS baseline.
 * Cascade per key: present user override > OS baseline > default(false).
 * largeText has no OS baseline, so it is user-or-default only.
 */
export function resolveA11y(user: A11yUserPrefs, os: OsA11y): A11yPrefs {
  return {
    highContrast: user.highContrast ?? os.prefersContrastMore,
    largeText: user.largeText ?? false,
    reduceMotion: user.reduceMotion ?? os.prefersReducedMotion,
  }
}

/**
 * Read the current OS accessibility baseline via media queries.
 * SSR-safe: returns all-false when window/matchMedia is unavailable.
 */
export function readOsA11y(): OsA11y {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { prefersContrastMore: false, prefersReducedMotion: false }
  }
  try {
    return {
      prefersContrastMore: window.matchMedia('(prefers-contrast: more)').matches,
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }
  } catch {
    return { prefersContrastMore: false, prefersReducedMotion: false }
  }
}

/**
 * Normalize a full accessibility boolean object into user overrides: only
 * keys that are ON (=== true) are treated as explicit overrides. An OFF value
 * is dropped so the OS baseline governs that key (INV-A11Y "OFF reverts").
 */
export function toUserPrefs(accessibility: Partial<Record<keyof A11yPrefs, unknown>> | null | undefined): A11yUserPrefs {
  const out: A11yUserPrefs = {}
  if (!accessibility || typeof accessibility !== 'object') return out
  if (accessibility.highContrast === true) out.highContrast = true
  if (accessibility.largeText === true) out.largeText = true
  if (accessibility.reduceMotion === true) out.reduceMotion = true
  return out
}

/**
 * Read the user's ON accessibility overrides from the shared prefs blob.
 * Malformed / missing / SSR → {} so the OS baseline governs.
 */
export function readA11yUserPrefs(): A11yUserPrefs {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(PRIVACY_PREFS_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored) as { accessibility?: Partial<Record<keyof A11yPrefs, unknown>> }
    return toUserPrefs(parsed?.accessibility)
  } catch {
    return {}
  }
}

/**
 * Apply the user's ON overrides to a root element as data-* attributes.
 * - ON (present)  → the "on" value (more / large / reduce)
 * - OFF / absent  → the attribute is removed, letting the OS media query govern
 */
export function applyA11yAttributes(user: A11yUserPrefs, root?: HTMLElement | null): void {
  const el = root ?? (typeof document !== 'undefined' ? document.documentElement : null)
  if (!el) return

  if (user.highContrast === true) el.setAttribute('data-contrast', 'more')
  else el.removeAttribute('data-contrast')

  if (user.largeText === true) el.setAttribute('data-text-size', 'large')
  else el.removeAttribute('data-text-size')

  if (user.reduceMotion === true) el.setAttribute('data-motion', 'reduce')
  else el.removeAttribute('data-motion')
}

/**
 * Read the stored overrides and apply them to the document. Call on toggle and
 * on mount. Safe to call on the server (no-op).
 */
export function syncA11yFromStorage(): void {
  applyA11yAttributes(readA11yUserPrefs())
}

/**
 * Pre-paint inline script (no imports allowed — it runs before hydration).
 * Kept byte-for-byte consistent with applyA11yAttributes so there is no flash
 * and no divergence between first paint and the reactive path. Injected in
 * layout.tsx with the per-request CSP nonce.
 */
export const A11Y_PREPAINT_SCRIPT = `(function(){try{var k=${JSON.stringify(PRIVACY_PREFS_KEY)};var r=document.documentElement;var s=localStorage.getItem(k);var a=s?(JSON.parse(s)||{}).accessibility:null;a=a&&typeof a==='object'?a:{};if(a.highContrast===true)r.setAttribute('data-contrast','more');else r.removeAttribute('data-contrast');if(a.largeText===true)r.setAttribute('data-text-size','large');else r.removeAttribute('data-text-size');if(a.reduceMotion===true)r.setAttribute('data-motion','reduce');else r.removeAttribute('data-motion');}catch(e){}})();`
