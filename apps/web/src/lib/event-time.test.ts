// apps/web/src/lib/event-time.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What a viewer reads on every event surface, and what the form says about a wall-clock time.
// Fixed instants and explicit zones only, so results are identical on any CI host.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { checkLocalTime, formatEventWhen as formatRaw, timeZoneOptions, venueDateKey, COMMON_US_ZONES } from './event-time'

// ICU versions differ in the spaces they print (U+202F before AM/PM, U+2009 around the range
// dash); compare with plain spaces so the assertion is about the words, not the ICU build.
const plain = (s: string | null) => (s === null ? null : s.replace(/[\u202f\u2009\u00a0]/g, ' '))
const formatEventWhen: typeof formatRaw = (...args) => {
  const w = formatRaw(...args)
  return { text: plain(w.text) as string, venue: plain(w.venue) }
}

// 2026-11-10 10:00–11:30 in New York (EST, UTC-5) = 15:00–16:30 UTC.
const START = '2026-11-10T15:00:00Z'
const END = '2026-11-10T16:30:00Z'

describe('formatEventWhen — viewer time plus venue time', () => {
  it('a viewer in the venue zone sees one line with the zone abbreviation', () => {
    const w = formatEventWhen(START, END, 'America/New_York', 'en', { viewerTz: 'America/New_York' })
    expect(w.text).toBe('Tue, Nov 10, 10:00 – 11:30 AM EST')
    expect(w.venue).toBeNull()
  })

  it('a viewer in another zone sees their own time AND the venue time labelled', () => {
    const w = formatEventWhen(START, END, 'America/New_York', 'en', { viewerTz: 'America/Los_Angeles' })
    expect(w.text).toBe('Tue, Nov 10, 7:00 – 8:30 AM PST')
    expect(w.venue).toBe('Venue time: Tue, Nov 10, 10:00 – 11:30 AM EST')
  })

  it('the same instant renders the same venue line for every viewer', () => {
    const a = formatEventWhen(START, END, 'America/New_York', 'en', { viewerTz: 'America/Chicago' })
    const b = formatEventWhen(START, END, 'America/New_York', 'en', { viewerTz: 'Europe/London' })
    expect(a.venue).toBe(b.venue)
    expect(a.text).toBe('Tue, Nov 10, 9:00 – 10:30 AM CST')
  })

  it('a zone with the same offset (Detroit vs New York) needs no second line', () => {
    expect(formatEventWhen(START, END, 'America/New_York', 'en', { viewerTz: 'America/Detroit' }).venue).toBeNull()
  })

  it('DST boundary day: spring-forward Sunday 2026-03-08, 03:30–05:00 EDT', () => {
    // 03:30 EDT (UTC-4) = 07:30Z. Phoenix has no DST (UTC-7) -> 00:30–02:00 MST.
    const w = formatEventWhen('2026-03-08T07:30:00Z', '2026-03-08T09:00:00Z', 'America/New_York', 'en', {
      viewerTz: 'America/Phoenix',
    })
    expect(w.text).toBe('Sun, Mar 8, 12:30 – 2:00 AM MST')
    expect(w.venue).toBe('Venue time: Sun, Mar 8, 3:30 – 5:00 AM EDT')
  })

  it('DST boundary day: an event spanning the fall-back hour keeps both abbreviations', () => {
    // 2026-11-01 00:30 EDT (04:30Z) – 01:30 EST (06:30Z): three real hours.
    const w = formatEventWhen('2026-11-01T04:30:00Z', '2026-11-01T06:30:00Z', 'America/New_York', 'en', {
      viewerTz: 'America/New_York',
    })
    expect(w.text).toBe('Sun, Nov 1, 12:30 AM EDT – 1:30 AM EST')
  })

  it('offsets that agree at the start but not the end still show the venue line', () => {
    // Phoenix (UTC-7 all year) vs Denver on 2026-03-08: Denver is UTC-7 before 02:00 local, UTC-6 after.
    const w = formatEventWhen('2026-03-08T08:00:00Z', '2026-03-08T10:00:00Z', 'America/Denver', 'en', {
      viewerTz: 'America/Phoenix',
    })
    expect(w.venue).not.toBeNull()
  })

  it('overnight across the fall-back night shows both dates and both abbreviations', () => {
    // 2026-10-31 20:00 EDT (2026-11-01T00:00Z) – 2026-11-01 02:00 EST (07:00Z): seven real hours.
    const w = formatEventWhen('2026-11-01T00:00:00Z', '2026-11-01T07:00:00Z', 'America/New_York', 'en', {
      viewerTz: 'America/New_York',
    })
    expect(w.text).toBe('Sat, Oct 31, 8:00 PM EDT – Sun, Nov 1, 2:00 AM EST')
  })

  it('times only (calendar chip)', () => {
    const w = formatEventWhen(START, END, 'America/New_York', 'en', { viewerTz: 'America/New_York', timeOnly: true })
    expect(w.text).toBe('10:00 – 11:30 AM EST')
  })

  it('the venue label follows the viewer locale', () => {
    const w = formatEventWhen(START, END, 'America/New_York', 'es', { viewerTz: 'America/Los_Angeles' })
    expect(w.venue?.startsWith('Hora del lugar: ')).toBe(true)
  })
})

describe('checkLocalTime — the form names a DST gap or repeat before submit', () => {
  it('a normal time maps to its instant', () => {
    const r = checkLocalTime('2026-11-10', '10:00', 'America/New_York')
    expect(r).toEqual({ kind: 'ok', instant: new Date('2026-11-10T15:00:00Z') })
  })
  it('spring-forward gap: 02:30 on 2026-03-08 does not exist in New York', () => {
    expect(checkLocalTime('2026-03-08', '02:30', 'America/New_York').kind).toBe('gap')
  })
  it('fall-back repeat: 01:30 on 2026-11-01 happens twice in New York', () => {
    expect(checkLocalTime('2026-11-01', '01:30', 'America/New_York').kind).toBe('repeat')
  })
  it('the minutes either side of the gap are fine', () => {
    expect(checkLocalTime('2026-03-08', '01:59', 'America/New_York')).toEqual({ kind: 'ok', instant: new Date('2026-03-08T06:59:00Z') })
    expect(checkLocalTime('2026-03-08', '03:00', 'America/New_York')).toEqual({ kind: 'ok', instant: new Date('2026-03-08T07:00:00Z') })
  })
  it('a 30-minute DST shift (Lord Howe) is detected too', () => {
    // Lord Howe: +11 -> +10:30 at 02:00 local on 2026-04-05 (01:30–02:00 repeats).
    expect(checkLocalTime('2026-04-05', '01:45', 'Australia/Lord_Howe').kind).toBe('repeat')
    // +10:30 -> +11 at 02:00 local on 2026-10-04 (02:00–02:30 skipped).
    expect(checkLocalTime('2026-10-04', '02:15', 'Australia/Lord_Howe').kind).toBe('gap')
  })
  it('a zone with no DST never reports a gap', () => {
    expect(checkLocalTime('2026-03-08', '02:30', 'America/Phoenix').kind).toBe('ok')
  })
  it('an unknown zone or malformed time is invalid', () => {
    expect(checkLocalTime('2026-03-08', '02:30', 'Mars/Olympus').kind).toBe('invalid')
    expect(checkLocalTime('2026-3-8', '2:30', 'America/New_York').kind).toBe('invalid')
  })
})

describe('venueDateKey / timeZoneOptions', () => {
  it('files a date under the venue’s local day', () => {
    // 2026-11-11 03:00Z is still Nov 10 in Los Angeles and already Nov 11 in London.
    expect(venueDateKey('2026-11-11T03:00:00Z', 'America/Los_Angeles')).toBe('2026-11-10')
    expect(venueDateKey('2026-11-11T03:00:00Z', 'Europe/London')).toBe('2026-11-11')
  })
  it('lists the common US zones first and every other IANA Area/Location zone after', () => {
    const o = timeZoneOptions('en', 'America/New_York', new Date('2026-11-10T15:00:00Z'))
    expect(o.common.map((z) => z.value)).toEqual([...COMMON_US_ZONES])
    expect(o.common[0].label).toBe('Eastern Standard Time (America/New_York)')
    expect(o.all.some((z) => z.value === 'Europe/London')).toBe(true)
    expect(o.all.some((z) => z.value === 'UTC' || z.value === 'America/New_York')).toBe(false)
  })
})
