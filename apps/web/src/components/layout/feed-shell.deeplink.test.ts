// feed-shell.deeplink.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// E1/E4 — what the shell does with a focus hash once it has read it: the query is stripped in place
// (a reload opens the panel without focusing again; a re-click of the same link then differs from
// the URL and fires a hashchange), and an ignored focus writes exactly one nav.deeplink.resolve row.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const logEvent = vi.fn()
vi.mock('@/lib/logger', () => ({ logEvent: (...a: unknown[]) => logEvent(...a), logger: { info: vi.fn() } }))

import { resolveHashLocation, settleFocusHash } from './feed-shell'

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
