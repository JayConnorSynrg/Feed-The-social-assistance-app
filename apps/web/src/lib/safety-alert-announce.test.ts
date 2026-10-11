// apps/web/src/lib/safety-alert-announce.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Release 3.1 invariant 7 — the announcement rule of the feed strip: role="alert" only for a NEW or
// ESCALATED alert; a polite status for an update, a resolution and an alert no longer listed;
// nothing for the first read and for a refresh that changes none of those.

import { describe, it, expect } from 'vitest'
import type { SafetyAlert } from './safety-alert-rpc'
import { stripAnnouncement } from './safety-alert-announce'

const NOW = Date.parse('2026-10-11T12:00:00.000Z')
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()
const alert = (over: Partial<SafetyAlert> = {}): SafetyAlert => ({
  id: 'a1',
  alert_type: 'road_closure',
  severity: 2,
  description: null,
  lng: -72.97,
  lat: 43.61,
  status: 'live',
  confirm_count: 0,
  clear_count: 0,
  created_at: iso(-3600_000),
  expires_at: iso(3600_000),
  verified: false,
  is_mine: false,
  version: 1,
  updated_at: null,
  update_count: 0,
  resolved_at: null,
  ...over,
})
const say = (before: SafetyAlert[] | null, after: SafetyAlert[]) => {
  const said = stripAnnouncement(before, after, NOW)
  return { assertive: said.assertive.map((e) => e.kind), polite: said.polite.map((e) => e.kind) }
}

describe('stripAnnouncement', () => {
  it('the first read announces nothing (alerts already on the page are not announced)', () => {
    expect(say(null, [alert(), alert({ id: 'a2', severity: 4 })])).toEqual({ assertive: [], polite: [] })
  })

  it('a refresh that changes nothing announces nothing — votes, the verified mark and time are silent', () => {
    expect(say([alert()], [alert()])).toEqual({ assertive: [], polite: [] })
    expect(say([alert()], [alert({ confirm_count: 3, clear_count: 1, verified: true })])).toEqual({ assertive: [], polite: [] })
  })

  it('a new live alert is an alert', () => {
    const said = stripAnnouncement([alert()], [alert(), alert({ id: 'a2', alert_type: 'weather', severity: 4 })], NOW)
    expect(said.assertive).toEqual([{ kind: 'new', alert_type: 'weather', severity: 4 }])
    expect(said.polite).toEqual([])
  })

  it('a raised severity is an alert; a lowered one is a polite update', () => {
    expect(say([alert()], [alert({ severity: 4, version: 2 })])).toEqual({ assertive: ['raised'], polite: [] })
    expect(say([alert({ severity: 4 })], [alert({ severity: 1, version: 2 })])).toEqual({ assertive: [], polite: ['updated'] })
  })

  it('an update of the text or the type is polite', () => {
    expect(say([alert()], [alert({ description: 'Detour on Elm', version: 2, updated_at: iso(0), update_count: 1 })])).toEqual({ assertive: [], polite: ['updated'] })
  })

  it('a resolution is polite, once (a later read of the same resolved alert is silent)', () => {
    const resolved = alert({ status: 'resolved', resolved_at: iso(0), version: 2 })
    expect(say([alert()], [resolved])).toEqual({ assertive: [], polite: ['resolved'] })
    expect(say([resolved], [resolved])).toEqual({ assertive: [], polite: [] })
  })

  it('a resolved alert never raises an alert, even when it is new to the strip or its severity rose', () => {
    expect(say([], [alert({ status: 'resolved', resolved_at: iso(0) })])).toEqual({ assertive: [], polite: ['resolved'] })
    expect(say([alert()], [alert({ severity: 4, status: 'resolved', resolved_at: iso(0), version: 3 })])).toEqual({ assertive: [], polite: ['resolved'] })
  })

  it('an alert no longer listed is polite', () => {
    expect(say([alert(), alert({ id: 'a2' })], [alert()])).toEqual({ assertive: [], polite: ['ended'] })
  })

  it('several changes in one refresh are all said, each in its region', () => {
    expect(say([alert({ id: 'a1' }), alert({ id: 'a2' }), alert({ id: 'a3' })], [alert({ id: 'a1', severity: 3, version: 2 }), alert({ id: 'a2', version: 2 }), alert({ id: 'a4' })])).toEqual({
      assertive: ['raised', 'new'],
      polite: ['updated', 'ended'],
    })
  })
})
