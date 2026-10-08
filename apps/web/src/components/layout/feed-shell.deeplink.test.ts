// feed-shell.deeplink.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// E1/E4 — what the shell does with a focus hash once it has read it: the query is stripped in place
// (a reload opens the panel without focusing again; a re-click of the same link then differs from
// the URL and fires a hashchange), and an ignored focus writes exactly one nav.deeplink.resolve row.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const logEvent = vi.fn()
vi.mock('@/lib/logger', () => ({ logEvent: (...a: unknown[]) => logEvent(...a), logger: { info: vi.fn() } }))

import {
  paramsOnAliasSwitch,
  paramsOnBaseSwitch,
  paramsOnHashChange,
  paramsOnInit,
  resolveHashLocation,
  settleFocusHash,
} from './feed-shell'

const ID = '8f285b5a-4e4f-4bbc-b661-23fcaf84353a'
const replaceState = vi.fn()

beforeEach(() => {
  logEvent.mockReset()
  replaceState.mockReset()
  vi.stubGlobal('window', { history: { state: { __NA: true }, replaceState } })
})
afterEach(() => vi.unstubAllGlobals())

describe('settleFocusHash', () => {
  it('a valid focus: the URL becomes #<panelKey> (history state kept), nothing is logged here', () => {
    settleFocusHash(resolveHashLocation(`#events?focus=event:${ID}`))
    expect(replaceState).toHaveBeenCalledTimes(1)
    expect(replaceState).toHaveBeenCalledWith({ __NA: true }, '', '#events')
    expect(logEvent).not.toHaveBeenCalled()
  })
  it('an invalid focus: stripped, and exactly one invalid row with closed labels (no id, no raw hash)', () => {
    settleFocusHash(resolveHashLocation('#events?focus=event:<script>'))
    expect(replaceState).toHaveBeenCalledWith({ __NA: true }, '', '#events')
    expect(logEvent).toHaveBeenCalledTimes(1)
    expect(logEvent).toHaveBeenCalledWith('nav.deeplink.resolve', { kind: 'unknown', outcome: 'invalid', panel: 'events' })
  })
  it('a known kind on the wrong panel: one invalid row carrying its kind', () => {
    settleFocusHash(resolveHashLocation(`#map?focus=event:${ID}`))
    expect(logEvent).toHaveBeenCalledTimes(1)
    expect(logEvent).toHaveBeenCalledWith('nav.deeplink.resolve', { kind: 'event', outcome: 'invalid', panel: 'map' })
  })
  it('a hash with no focus: URL untouched, nothing logged (E5)', () => {
    settleFocusHash(resolveHashLocation('#events?utm=1'))
    settleFocusHash(resolveHashLocation('#add-business'))
    expect(replaceState).not.toHaveBeenCalled()
    expect(logEvent).not.toHaveBeenCalled()
  })
  it('after the strip, reading the URL again finds no focus (a reload does not re-focus)', () => {
    settleFocusHash(resolveHashLocation(`#events?focus=event:${ID}`))
    const stripped = replaceState.mock.calls[0][2] as string
    expect(resolveHashLocation(stripped)).toMatchObject({ panel: 'feed', subtab: 'events', hadFocusParam: false })
    expect(resolveHashLocation(stripped).focus).toBeUndefined()
  })
})

// The panelParams each shell path produces — what a panel then reads (subtab, alias params, focus).
describe('panelParams merges', () => {
  const FOCUS = { kind: 'event' as const, id: ID }
  const OTHER = { kind: 'event' as const, id: '11111111-1111-4111-8111-111111111111' }

  describe('on mount (paramsOnInit)', () => {
    it('a focus link: events subtab + the focus, other params kept', () => {
      expect(paramsOnInit({ openConversationId: 'c1' }, resolveHashLocation(`#events?focus=event:${ID}`))).toEqual({
        openConversationId: 'c1',
        subtab: 'events',
        focus: FOCUS,
      })
    })
    it('alias params come through (#add-business opens the form); a plain #feed clears the subtab', () => {
      expect(paramsOnInit({}, resolveHashLocation('#add-business'))).toMatchObject({ subtab: 'businesses', businessSubmit: true })
      expect(paramsOnInit({ subtab: 'events' }, resolveHashLocation('#feed')).subtab).toBeUndefined()
    })
    it('a second run on the stripped hash keeps the focus taken by the first', () => {
      const first = paramsOnInit({}, resolveHashLocation(`#events?focus=event:${ID}`))
      expect(paramsOnInit(first, resolveHashLocation('#events')).focus).toEqual(FOCUS)
    })
  })

  describe('on hashchange (paramsOnHashChange)', () => {
    it('a focus link in an open tab: sets the subtab and the new focus (a re-click replaces the old one)', () => {
      expect(paramsOnHashChange({ subtab: 'feed', focus: OTHER }, resolveHashLocation(`#events?focus=event:${ID}`))).toEqual({
        subtab: 'events',
        businessSubmit: undefined,
        focus: FOCUS,
      })
    })
    it('any other hash clears an untaken focus and a stale add-business flag; #add-business still sets it', () => {
      const next = paramsOnHashChange({ focus: FOCUS, businessSubmit: true, openConversationId: 'c1' }, resolveHashLocation('#feed'))
      expect(next).toEqual({ subtab: undefined, businessSubmit: undefined, focus: undefined, openConversationId: 'c1' })
      expect(paramsOnHashChange({}, resolveHashLocation('#add-business'))).toMatchObject({ subtab: 'businesses', businessSubmit: true })
      expect(paramsOnHashChange({}, resolveHashLocation('#messages')).subtab).toBe('messages')
    })
  })

  describe('in-app switches (setActivePanel)', () => {
    it('an alias switch keeps other params, sets its subtab + params, and drops an untaken focus', () => {
      expect(paramsOnAliasSwitch({ openConversationId: 'c1', focus: FOCUS }, { subtab: 'petitions' })).toEqual({
        openConversationId: 'c1',
        subtab: 'petitions',
        focus: undefined,
      })
      expect(paramsOnAliasSwitch({}, { subtab: 'businesses', params: { businessSubmit: true } })).toMatchObject({ businessSubmit: true })
    })
    it('a base switch clears subtab, the add-business flag and an untaken focus, keeping the rest', () => {
      expect(paramsOnBaseSwitch({ subtab: 'events', businessSubmit: true, focus: FOCUS, formsTarget: 'x' })).toEqual({
        subtab: undefined,
        businessSubmit: undefined,
        focus: undefined,
        formsTarget: 'x',
      })
    })
  })
})
