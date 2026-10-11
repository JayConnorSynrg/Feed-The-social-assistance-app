// apps/web/src/lib/safety-alert-announce.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What a refresh of the feed's alert strip says to assistive technology (WCAG 4.1.3), decided from
// the list before and the list after:
//   assertive (role="alert")   a NEWLY REPORTED live alert, or an alert whose severity ROSE;
//   polite (role="status")     any other change: updated, resolved, no longer listed;
//   nothing                    the first read (content already on the page is not announced), an
//                              older alert that only moved into the top five because another one
//                              left, and any refresh that changes none of the above (vote counts,
//                              the verified mark and the passing of time are silent).
// "Newly reported" is decided on the server's own timestamps, never the browser clock: while the
// strip was not full every shown alert was already listed, so an entrant is new; once it is full,
// an entrant is new only when it was created after everything the read before returned.
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

/** `before` is null for the first read of a viewer. `limit` is how many alerts the strip shows. */
export function stripAnnouncement(before: readonly SafetyAlert[] | null, after: readonly SafetyAlert[], limit: number): StripAnnouncement {
  const said: StripAnnouncement = { assertive: [], polite: [] }
  if (before === null) return said
  const event = (kind: StripEvent['kind'], a: SafetyAlert): StripEvent => ({ kind, alert_type: a.alert_type, severity: a.severity })
  const held = new Map(before.map((a) => [a.id, a]))
  const wasFull = before.length >= limit
  const newestBefore = Math.max(...before.map((a) => Date.parse(a.created_at)).filter((t) => !Number.isNaN(t)), Number.NEGATIVE_INFINITY)
  for (const next of after) {
    const prev = held.get(next.id)
    const state = alertShownState(next)
    if (!prev) {
      const reportedSince = !wasFull || Date.parse(next.created_at) > newestBefore
      if (state === 'live' && reportedSince) said.assertive.push(event('new', next))
      else if (state === 'resolved' && reportedSince) said.polite.push(event('resolved', next))
      continue
    }
    if (state === 'live' && next.severity > prev.severity) said.assertive.push(event('raised', next))
    else if (state === 'resolved' && alertShownState(prev) !== 'resolved') said.polite.push(event('resolved', next))
    else if (next.version !== prev.version) said.polite.push(event('updated', next))
  }
  const listed = new Set(after.map((a) => a.id))
  for (const prev of before) if (!listed.has(prev.id)) said.polite.push(event('ended', prev))
  return said
}
