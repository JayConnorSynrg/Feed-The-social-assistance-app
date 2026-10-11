// apps/web/src/lib/safety-alert-announce.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Release 3.1 invariant 7 — the announcement rule of the feed strip: role="alert" only for a NEW or
// ESCALATED alert; a polite status for an update, a resolution and an alert no longer listed;
// nothing for the first read and for a refresh that changes none of those. "New" means newly
// REPORTED, judged on the server's timestamps: an older alert that only moved into a full strip
// because another one left is not announced as new.

import { describe, it, expect } from 'vitest'
import type { SafetyAlert } from './safety-alert-rpc'
import { stripAnnouncement } from './safety-alert-announce'

import { HOUR, alert as fixture, iso } from '@/test/alert-fixtures'

const LIMIT = 5
const alert = (over: Partial<SafetyAlert> = {}): SafetyAlert => fixture({ id: 'a1', description: null, confirm_count: 0, ...over })
const say = (before: SafetyAlert[] | null, after: SafetyAlert[]) => {
  const said = stripAnnouncement(before, after, LIMIT)
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
    const said = stripAnnouncement([alert()], [alert(), alert({ id: 'a2', alert_type: 'weather', severity: 4 })], LIMIT)
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

  describe('a full strip (five entries): only a newly reported alert is "new"', () => {
    // Five alerts, reported 5 to 1 hours ago.
    const five = () => [5, 4, 3, 2, 1].map((h) => alert({ id: `old-${h}`, created_at: iso(-h * HOUR) }))

    it('an older alert that moves into the top five because one left is not announced as new', () => {
      const before = five()
      const sixth = alert({ id: 'sixth', created_at: iso(-6 * HOUR) }) // existed all along, just below the cut
      expect(say(before, [...before.slice(1), sixth])).toEqual({ assertive: [], polite: ['ended'] })
    })

    it('an alert reported after everything the read before returned is announced as new', () => {
      const before = five()
      const fresh = alert({ id: 'fresh', severity: 4, created_at: iso(-60_000) })
      expect(say(before, [fresh, ...before.slice(0, 4)])).toEqual({ assertive: ['new'], polite: ['ended'] })
    })

    it('the judgement uses the server’s timestamps, so a wrong browser clock cannot change it', () => {
      // No clock is passed at all: same answer whatever Date.now() says.
      const before = five()
      const fresh = alert({ id: 'fresh', created_at: iso(-60_000) })
      const real = Date.now
      try {
        for (const skew of [-24 * HOUR, 3 * HOUR]) {
          Date.now = () => real() + skew
          expect(say(before, [fresh, ...before.slice(0, 4)]).assertive).toEqual(['new'])
        }
      } finally {
        Date.now = real
      }
    })
  })

  it('a strip that was not full: every entrant is newly shown, so a live one is new', () => {
    expect(say([alert()], [alert(), alert({ id: 'a2', created_at: iso(-3 * HOUR) })])).toEqual({ assertive: ['new'], polite: [] })
    expect(say([], [alert()])).toEqual({ assertive: ['new'], polite: [] })
  })

  it('several changes in one refresh are all said, each in its region', () => {
    expect(say([alert({ id: 'a1' }), alert({ id: 'a2' }), alert({ id: 'a3' })], [alert({ id: 'a1', severity: 3, version: 2 }), alert({ id: 'a2', version: 2 }), alert({ id: 'a4' })])).toEqual({
      assertive: ['raised', 'new'],
      polite: ['updated', 'ended'],
    })
  })
})
