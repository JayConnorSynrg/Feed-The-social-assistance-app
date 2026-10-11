// apps/web/src/lib/safety-alert-announce.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What a refresh of the feed's alert strip says to assistive technology (WCAG 4.1.3), decided from
// the list before and the list after:
//   assertive (role="alert")   a NEW live alert on the strip, or an alert whose severity ROSE;
//   polite (role="status")     any other change: updated, resolved, no longer listed;
//   nothing                    the first read (content already on the page is not announced) and any
//                              refresh that changes none of the above (vote counts, the verified
//                              mark and the passing of time are silent).
// The result is data (kind + type + severity); components/feed/safety-strip.tsx turns it into a
// sentence in the viewer's language.

import { alertShownState } from './safety-alert-live'
import type { AlertType, SafetyAlert } from './safety-alert-rpc'

export interface StripEvent {
  kind: 'new' | 'raised' | 'updated' | 'resolved' | 'ended'
  alert_type: AlertType
  severity: number
}

export interface StripAnnouncement {
  assertive: StripEvent[]
  polite: StripEvent[]
}

/** `before` is null for the first read of a viewer. */
export function stripAnnouncement(before: readonly SafetyAlert[] | null, after: readonly SafetyAlert[], now: number): StripAnnouncement {
  const said: StripAnnouncement = { assertive: [], polite: [] }
  if (before === null) return said
  const event = (kind: StripEvent['kind'], a: SafetyAlert): StripEvent => ({ kind, alert_type: a.alert_type, severity: a.severity })
  const held = new Map(before.map((a) => [a.id, a]))
  for (const next of after) {
    const prev = held.get(next.id)
    const state = alertShownState(next, now)
    if (!prev) {
      if (state === 'live') said.assertive.push(event('new', next))
      else if (state === 'resolved') said.polite.push(event('resolved', next))
      continue
    }
    if (state === 'live' && next.severity > prev.severity) said.assertive.push(event('raised', next))
    else if (state === 'resolved' && alertShownState(prev, now) !== 'resolved') said.polite.push(event('resolved', next))
    else if (next.version !== prev.version) said.polite.push(event('updated', next))
  }
  const listed = new Set(after.map((a) => a.id))
  for (const prev of before) if (!listed.has(prev.id)) said.polite.push(event('ended', prev))
  return said
}
