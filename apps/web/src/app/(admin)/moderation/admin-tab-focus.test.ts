// apps/web/src/app/(admin)/moderation/admin-tab-focus.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I2 — a followed "Edit in admin" link for a place settles exactly once in its tab:
//   - decideTabFocus: a tab answers only links naming it; a malformed / other-kind focus is invalid;
//   - AdminTabFocusSession: found (opens the item), not_found, forbidden, invalid, abandoned — each
//     one admin.deeplink.resolve row, `focus` stripped, a notice for the misses; a late read result
//     after the link settled does nothing; a StrictMode unmount + remount keeps the link;
//   - hiddenTabFocus: a tier that does not see Manage / Businesses gets 'forbidden';
//   - stripFocusFromLocation: drops only `focus`, in place.
// The tabs' wiring to this session is proven in manage-resources-tab.focus.test.ts and
// businesses-tab.focus.test.ts.

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  AdminTabFocusSession,
  decideTabFocus,
  hiddenTabFocus,
  stripFocusFromLocation,
  type AdminFocusNotice,
} from './admin-tab-focus'

const ID = '11111111-1111-4111-8111-111111111111'
const UPPER = ID.toUpperCase()
const manage = (focus: string) => `?tab=manage&focus=${focus}`

describe('decideTabFocus', () => {
  it('a resource link on the Manage tab names that resource (id lower-cased)', () => {
    expect(decideTabFocus(manage(`resource:${UPPER}`), 'manage')).toEqual({ type: 'focus', focus: { kind: 'resource', id: ID } })
    expect(decideTabFocus(`?tab=businesses&focus=business:${ID}`, 'businesses')).toEqual({
      type: 'focus',
      focus: { kind: 'business', id: ID },
    })
  })

  it("not this tab's link: another tab, or no focus at all", () => {
    expect(decideTabFocus(`?tab=businesses&focus=business:${ID}`, 'manage')).toEqual({ type: 'none' })
    expect(decideTabFocus('?tab=manage', 'manage')).toEqual({ type: 'none' })
    expect(decideTabFocus('', 'manage')).toEqual({ type: 'none' })
  })

  it('a focus that is malformed, repeated or of another kind is invalid', () => {
    for (const search of [
      manage('resource:not-a-uuid'),
      manage(`business:${ID}`),
      manage(`post:${ID}`),
      manage(''),
      `${manage(`resource:${ID}`)}&focus=resource:${ID}`,
    ]) {
      expect(decideTabFocus(search, 'manage'), search).toEqual({ type: 'invalid' })
    }
  })
})

function session(tab: 'manage' | 'businesses' = 'manage') {
  const rows: Array<Record<string, string>> = []
  const notices: AdminFocusNotice[] = []
  const strip = vi.fn()
  const s = new AdminTabFocusSession<{ id: string }>({
    tab,
    log: (attrs) => rows.push(attrs),
    strip,
    onNotice: (n) => notices.push(n),
  })
  return { s, rows, notices, strip }
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

afterEach(() => {
  vi.useRealTimers()
})

describe('AdminTabFocusSession — one row per followed link', () => {
  it('found: reads the named id, opens the item, one found row, focus stripped, no notice', async () => {
    const { s, rows, notices, strip } = session()
    const read = vi.fn(async (id: string) => ({ id }))
    const onFound = vi.fn()
    s.arrive(manage(`resource:${UPPER}`))
    s.ready('allowed', { read, onFound })
    await tick()
    expect(read).toHaveBeenCalledTimes(1)
    expect(read.mock.calls[0][0]).toBe(ID)
    expect(onFound).toHaveBeenCalledWith({ id: ID })
    expect(rows).toEqual([{ kind: 'resource', outcome: 'found', tab: 'manage' }])
    expect(strip).toHaveBeenCalledTimes(1)
    expect(notices).toEqual([])
  })

  it('not_found: the read returns nothing -> one row, a notice, nothing opened', async () => {
    const { s, rows, notices, strip } = session()
    const onFound = vi.fn()
    s.arrive(manage(`resource:${ID}`))
    s.ready('allowed', { read: async () => null, onFound })
    await tick()
    expect(rows).toEqual([{ kind: 'resource', outcome: 'not_found', tab: 'manage' }])
    expect(notices).toEqual(['not_found'])
    expect(strip).toHaveBeenCalledTimes(1)
    expect(onFound).not.toHaveBeenCalled()
  })

  it('a failed read counts as not_found', async () => {
    const { s, rows } = session()
    s.arrive(manage(`resource:${ID}`))
    s.ready('allowed', { read: () => Promise.reject(new Error('network')), onFound: vi.fn() })
    await tick()
    expect(rows).toEqual([{ kind: 'resource', outcome: 'not_found', tab: 'manage' }])
  })

  it('forbidden: no read, one row, a notice', () => {
    const { s, rows, notices, strip } = session('businesses')
    const read = vi.fn()
    s.arrive(`?tab=businesses&focus=business:${ID}`)
    s.ready('forbidden', { read, onFound: vi.fn() })
    expect(read).not.toHaveBeenCalled()
    expect(rows).toEqual([{ kind: 'business', outcome: 'forbidden', tab: 'businesses' }])
    expect(notices).toEqual(['forbidden'])
    expect(strip).toHaveBeenCalledTimes(1)
  })

  it('invalid: settled at arrival, before the tab is ready; ready then does nothing', () => {
    const { s, rows, notices, strip } = session()
    s.arrive(manage('resource:42'))
    expect(rows).toEqual([{ kind: 'resource', outcome: 'invalid', tab: 'manage' }])
    expect(notices).toEqual(['invalid'])
    expect(strip).toHaveBeenCalledTimes(1)
    const read = vi.fn()
    s.ready('allowed', { read, onFound: vi.fn() })
    expect(read).not.toHaveBeenCalled()
    expect(rows).toHaveLength(1)
  })

  it('no focus for this tab: zero rows, nothing stripped, ready does nothing', () => {
    const { s, rows, strip } = session()
    const read = vi.fn()
    s.arrive('?tab=manage')
    s.ready('allowed', { read, onFound: vi.fn() })
    s.unmount()
    expect(read).not.toHaveBeenCalled()
    expect(rows).toEqual([])
    expect(strip).not.toHaveBeenCalled()
  })

  it('abandoned: the tab unmounts mid-read; the late result opens nothing and writes no second row', async () => {
    vi.useFakeTimers()
    const { s, rows, strip } = session()
    let resolve!: (v: { id: string } | null) => void
    const onFound = vi.fn()
    s.arrive(manage(`resource:${ID}`))
    s.ready('allowed', { read: () => new Promise((r) => (resolve = r)), onFound })
    s.unmount()
    vi.runAllTimers()
    expect(rows).toEqual([{ kind: 'resource', outcome: 'abandoned', tab: 'manage' }])
    expect(strip).toHaveBeenCalledTimes(1)
    resolve({ id: ID })
    await vi.runAllTimersAsync()
    expect(onFound).not.toHaveBeenCalled()
    expect(rows).toHaveLength(1)
  })

  it('abandoned also covers a tab that unmounts while still waiting to be ready', () => {
    vi.useFakeTimers()
    const { s, rows } = session('businesses')
    s.arrive(`?tab=businesses&focus=business:${ID}`)
    s.unmount()
    vi.runAllTimers()
    expect(rows).toEqual([{ kind: 'business', outcome: 'abandoned', tab: 'businesses' }])
  })

  it('a StrictMode unmount + remount keeps the link: one found row, no abandoned', async () => {
    const { s, rows } = session()
    const onFound = vi.fn()
    let resolve!: (v: { id: string }) => void
    const read = vi.fn(() => new Promise<{ id: string }>((r) => (resolve = r)))
    s.arrive(manage(`resource:${ID}`))
    s.ready('allowed', { read, onFound })
    s.unmount()
    s.remount()
    s.arrive(manage(`resource:${ID}`))
    s.ready('allowed', { read, onFound })
    // The deferred unmount check runs while the read is still in flight: the remount kept the link.
    await tick()
    expect(rows).toEqual([])
    resolve({ id: ID })
    await tick()
    expect(read).toHaveBeenCalledTimes(1)
    expect(rows).toEqual([{ kind: 'resource', outcome: 'found', tab: 'manage' }])
    expect(onFound).toHaveBeenCalledTimes(1)
  })

  it('ready repeated on every re-render reads once', async () => {
    const { s, rows } = session()
    const read = vi.fn(async (id: string) => ({ id }))
    s.arrive(manage(`resource:${ID}`))
    for (let n = 0; n < 3; n++) s.ready('allowed', { read, onFound: vi.fn() })
    await tick()
    expect(read).toHaveBeenCalledTimes(1)
    expect(rows).toHaveLength(1)
  })
})

describe('hiddenTabFocus — the tab this tier does not show answers forbidden', () => {
  const resourceLink = manage(`resource:${ID}`)
  const businessLink = `?tab=businesses&focus=business:${ID}`
  it('community moderator / no tier: forbidden for Manage and Businesses (even a malformed focus)', () => {
    for (const tier of ['community_moderator', null] as const) {
      expect(hiddenTabFocus(resourceLink, tier)).toEqual({ tab: 'manage', kind: 'resource' })
      expect(hiddenTabFocus(businessLink, tier)).toEqual({ tab: 'businesses', kind: 'business' })
      expect(hiddenTabFocus(manage('junk'), tier)).toEqual({ tab: 'manage', kind: 'resource' })
    }
  })
  it('resource admin and platform admin see both tabs: the tab answers, not the gate', () => {
    for (const tier of ['resource_admin', 'platform_admin'] as const) {
      expect(hiddenTabFocus(resourceLink, tier)).toBeNull()
      expect(hiddenTabFocus(businessLink, tier)).toBeNull()
    }
  })
  it('no focus, or another tab: nothing to answer', () => {
    expect(hiddenTabFocus('?tab=manage', null)).toBeNull()
    expect(hiddenTabFocus(`?tab=moderation&focus=post:${ID}`, null)).toBeNull()
  })
})

describe('stripFocusFromLocation', () => {
  function win(search: string) {
    const replaceState = vi.fn()
    return { w: { location: { pathname: '/moderation', search, hash: '#x' }, history: { state: { k: 1 }, replaceState } }, replaceState }
  }
  it('replaces the URL in place without focus, keeping tab, other params and the hash', () => {
    const { w, replaceState } = win(`?tab=manage&focus=resource:${ID}&org=all`)
    stripFocusFromLocation(w)
    expect(replaceState).toHaveBeenCalledWith({ k: 1 }, '', '/moderation?tab=manage&org=all#x')
  })
  it('no focus: the URL is left alone', () => {
    const { w, replaceState } = win('?tab=manage')
    stripFocusFromLocation(w)
    expect(replaceState).not.toHaveBeenCalled()
  })
})
