// apps/web/src/lib/deep-link.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The member deep-link hash: `#<panel>?focus=<kind>:<uuid>`. The part before the first `?` is the
// panel key the shell already resolves (a panel or an alias such as `events`); the query part may
// name ONE item for that panel to bring into view. The shell parses the hash with parseHash, hands
// a valid focus to the panel through panelParams.focus, and strips the query from the URL so a
// reload does not focus again. Admin code builds these links only through memberUrl
// (lib/member-url.ts), which calls buildFocusHash.

import { isUuid } from './org-admin-paths'

export type FocusKind = 'event' | 'resource' | 'organization' | 'business' | 'safety_alert'

export interface FocusTarget {
  kind: FocusKind
  id: string
}

const FOCUS_KINDS: readonly FocusKind[] = ['event', 'resource', 'organization', 'business', 'safety_alert']

function isFocusKind(value: string): value is FocusKind {
  return (FOCUS_KINDS as readonly string[]).includes(value)
}

/** `kind:uuid` -> a focus target (id lower-cased, the form Postgres prints), or null. */
function parseFocusValue(value: string): FocusTarget | null {
  const sep = value.indexOf(':')
  if (sep < 0) return null
  const kind = value.slice(0, sep)
  const id = value.slice(sep + 1)
  if (!isFocusKind(kind) || !isUuid(id)) return null
  return { kind, id: id.toLowerCase() }
}

/**
 * Split a location hash into the panel key and an optional focus target.
 *  - `#events`                        -> { panelKey: 'events' }
 *  - `#events?focus=event:<uuid>`     -> { panelKey: 'events', focus: { kind: 'event', id } }
 *  - `#events?focus=<anything else>`  -> { panelKey: 'events', focusInvalid: true }
 *  - `#events?other=1`                -> { panelKey: 'events' } (no focus named; other params ignored)
 * A repeated `focus` parameter is ambiguous and counts as invalid.
 */
export function parseHash(hash: string): { panelKey: string; focus?: FocusTarget; focusInvalid?: boolean } {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const q = raw.indexOf('?')
  const panelKey = q < 0 ? raw : raw.slice(0, q)
  if (q < 0) return { panelKey }

  const values = new URLSearchParams(raw.slice(q + 1)).getAll('focus')
  if (values.length === 0) return { panelKey }
  const focus = values.length === 1 ? parseFocusValue(values[0]) : null
  return focus ? { panelKey, focus } : { panelKey, focusInvalid: true }
}

/** The hash that opens `panelKey` focused on one item, e.g. `#events?focus=event:<uuid>`. */
export function buildFocusHash(panelKey: string, focus: FocusTarget): string {
  return `#${panelKey}?focus=${focus.kind}:${encodeURIComponent(focus.id)}`
}
