// apps/web/src/lib/deep-link.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// E1 — one focus link, one place it opens. parseHash splits `#<panel>?focus=<kind>:<uuid>` into the
// panel key and a focus target; a malformed focus is flagged, never mistaken for a panel; the shell's
// resolveHashLocation then opens the right panel (aliases and prototype keys included) and hands a
// focus only to a panel that shows that kind.

import { describe, it, expect } from 'vitest'
import { buildFocusHash, parseHash } from './deep-link'
import { resolveHashLocation } from '@/components/layout/feed-shell'

const ID = '8f285b5a-4e4f-4bbc-b661-23fcaf84353a'

describe('parseHash — valid focus', () => {
  it('splits the panel key from a focus target', () => {
    expect(parseHash(`#events?focus=event:${ID}`)).toEqual({ panelKey: 'events', focus: { kind: 'event', id: ID } })
  })
  it('accepts every known kind and a hash without the leading #', () => {
    for (const kind of ['event', 'resource', 'organization', 'business', 'safety_alert'] as const) {
      expect(parseHash(`map?focus=${kind}:${ID}`)).toEqual({ panelKey: 'map', focus: { kind, id: ID } })
    }
  })
  it('lower-cases an upper-case uuid (the form Postgres prints and data-event-id carries)', () => {
    expect(parseHash(`#events?focus=event:${ID.toUpperCase()}`).focus?.id).toBe(ID)
  })
  it('ignores other params beside a valid focus', () => {
    expect(parseHash(`#events?utm=x&focus=event:${ID}&y=2`)).toEqual({ panelKey: 'events', focus: { kind: 'event', id: ID } })
  })
})

describe('parseHash — no focus named', () => {
  it('a plain hash is just the panel key', () => {
    expect(parseHash('#feed')).toEqual({ panelKey: 'feed' })
    expect(parseHash('')).toEqual({ panelKey: '' })
  })
  it('a `?` without focus keeps the panel key (it used to send the user to Chat)', () => {
    expect(parseHash('#events?')).toEqual({ panelKey: 'events' })
    expect(parseHash('#events?utm_source=mail')).toEqual({ panelKey: 'events' })
  })
})

describe('parseHash — invalid focus is flagged, the panel key survives', () => {
  for (const [label, value] of [
    ['empty', ''],
    ['no separator', `event${ID}`],
    ['unknown kind', `post:${ID}`],
    ['prototype kind', `constructor:${ID}`],
    ['kind case', `Event:${ID}`],
    ['not a uuid', 'event:123'],
    ['uuid with trailing junk', `event:${ID}x`],
    ['uuid with a path', `event:${ID}/../x`],
    ['empty id', 'event:'],
  ] as const) {
    it(label, () => {
      expect(parseHash(`#events?focus=${encodeURIComponent(value)}`)).toEqual({ panelKey: 'events', focusInvalid: true })
    })
  }
  it('a repeated focus is ambiguous', () => {
    expect(parseHash(`#events?focus=event:${ID}&focus=event:${ID}`)).toEqual({ panelKey: 'events', focusInvalid: true })
  })
})

describe('buildFocusHash round-trips through parseHash', () => {
  it('event', () => {
    const hash = buildFocusHash('events', { kind: 'event', id: ID })
    expect(hash).toBe(`#events?focus=event:${ID}`)
    expect(parseHash(hash)).toEqual({ panelKey: 'events', focus: { kind: 'event', id: ID } })
  })
  it('an id is encoded, so it cannot add a param', () => {
    expect(buildFocusHash('map', { kind: 'resource', id: 'a&focus=b' })).toBe('#map?focus=resource:a%26focus%3Db')
  })
})

describe('resolveHashLocation — the shell opens the named panel and hands focus once', () => {
  it('#events?focus=event:<id> opens feed/events with the focus and asks to strip the query', () => {
    expect(resolveHashLocation(`#events?focus=event:${ID}`)).toEqual({
      panel: 'feed',
      subtab: 'events',
      panelKey: 'events',
      focus: { kind: 'event', id: ID },
      hadFocusParam: true,
    })
  })
  it('an invalid focus still opens the panel, carries no focus, and is logged as unknown', () => {
    const loc = resolveHashLocation('#events?focus=event:nope')
    expect(loc).toMatchObject({ panel: 'feed', subtab: 'events', hadFocusParam: true, invalid: { kind: 'unknown' } })
    expect(loc.focus).toBeUndefined()
  })
  it('a known kind on a panel that does not show it is ignored (logged with its kind)', () => {
    const loc = resolveHashLocation(`#feed?focus=event:${ID}`)
    expect(loc).toMatchObject({ panel: 'feed', hadFocusParam: true, invalid: { kind: 'event' } })
    expect(loc.focus).toBeUndefined()
    expect(resolveHashLocation(`#events?focus=resource:${ID}`).focus).toBeUndefined()
  })
  it('a ? without focus opens the panel and leaves the URL alone', () => {
    expect(resolveHashLocation('#events?utm=1')).toEqual({ panel: 'feed', subtab: 'events', panelKey: 'events', hadFocusParam: false })
  })
  it('aliases and plain panels resolve as before (E5)', () => {
    expect(resolveHashLocation('#feed')).toEqual({ panel: 'feed', panelKey: 'feed', hadFocusParam: false })
    expect(resolveHashLocation('#forms')).toMatchObject({ panel: 'documents', subtab: 'applications' })
    expect(resolveHashLocation('#messages')).toMatchObject({ panel: 'feed', subtab: 'messages' })
    expect(resolveHashLocation('#add-business')).toMatchObject({ panel: 'feed', subtab: 'businesses', params: { businessSubmit: true } })
    expect(resolveHashLocation('#map')).toMatchObject({ panel: 'map' })
    expect(resolveHashLocation('#nope')).toMatchObject({ panel: 'chat' })
  })
  it('prototype keys are not aliases (#toString used to resolve to a function)', () => {
    for (const key of ['toString', '__proto__', 'constructor', 'hasOwnProperty']) {
      const loc = resolveHashLocation(`#${key}`)
      expect(loc.panel, key).toBe('chat')
      expect(loc.subtab, key).toBeUndefined()
    }
  })
})
