// apps/web/src/lib/settings-prefs.ts
//
// Pure, dependency-free merge for the local settings blob (feed-settings-prefs).
// Extracted from settings-panel so the defensive-merge logic is unit-testable
// without importing the client component (which builds a Supabase client at
// module load). settings-panel keeps DEFAULT_SETTINGS as the single source and
// passes it in.
//
// A legacy blob written before Wave A can lack the `accessibility` key (and may
// lack `notifications`). The toggle handlers read `!group[key]`, which throws a
// TypeError on an undefined group — so every group is merged over its defaults,
// guaranteeing all keys are defined.

/** The three local-pref groups (profile is server-backed, not stored here). */
export interface LocalPrefGroups<N, P, A> {
  notifications: N
  privacy: P
  accessibility: A
}

/**
 * Merge a parsed stored blob over the defaults, group by group, and overlay the
 * authoritative chatPersonalization value onto privacy.
 *
 * - Each group falls back to its defaults for any missing key (no undefined).
 * - Unknown/extra fields in the parsed blob are preserved via the spread, but
 *   the three known groups are always fully-formed.
 */
export function mergeStoredPrefs<
  N extends Record<string, unknown>,
  P extends Record<string, unknown>,
  A extends Record<string, unknown>,
>(
  parsed: Partial<LocalPrefGroups<N, P, A>> & Record<string, unknown>,
  defaults: LocalPrefGroups<N, P, A>,
  chatPersonalization: boolean,
): LocalPrefGroups<N, P, A> {
  const p = (parsed && typeof parsed === 'object' ? parsed : {}) as typeof parsed
  return {
    ...p,
    notifications: { ...defaults.notifications, ...(p.notifications ?? {}) },
    privacy: { ...defaults.privacy, ...(p.privacy ?? {}), chatPersonalization },
    accessibility: { ...defaults.accessibility, ...(p.accessibility ?? {}) },
  }
}
