// apps/web/src/hooks/use-sign-up-outcomes.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The rules behind what a member hears and where their focus is after a sign-up action:
//   - an outcome counts only once the state the card renders from shows it;
//   - it is announced exactly once, through the announcer's own "move focus, then speak" frame
//     (the hook never focuses anything outside that callback);
//   - focus moves only when the pressed control is gone and focus was actually lost;
//   - each action has its target, with the sign-up list toggle and then the card as fallbacks;
//   - a failed request is said, and moves nothing;
//   - one attempt per row: two quick actions on different rows are both said, and a second press
//     on a row whose action is under way starts nothing (the row is busy until its outcome is
//     said or its action fails);
//   - an attempt never outlives the read that follows its action, nor its account or sub-tab;
//   - the sentences exist in 14 locales and name the person as they wrote their name.
// How the feed panel's handlers use it: components/panels/feed-panel.posts.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { mount } from '@/test/mini-react'
import { messages, type Locale } from '@/lib/i18n'
import { cardT } from '@/lib/i18n-feed-card'
import { isolate } from '@/lib/format-message'
import { optInsT, signUpNotice, type SignUpKind } from '@/lib/i18n-feed-optins'
import { focusWasLost } from '@/lib/focus-lost'
import { signUpAttemptKey, signUpControlTestId, signUpFocusTarget, signUpOutcomeShown, signUpRowsAfter, useSignUpOutcomes, type SignUpAttempt, type SignUpRow } from './use-sign-up-outcomes'

const LOCALES = Object.keys(messages) as Locale[]
const KINDS: SignUpKind[] = ['optIn', 'withdraw', 'accept', 'decline', 'complete', 'unblock']
const rowOf = (id: string, status = 'pending', name = `name-${id}`): SignUpRow => ({ id, postId: 'p1', seekerName: name, status })
const attempt = (o: Partial<SignUpAttempt>): SignUpAttempt => ({ kind: 'accept', postId: 'p1', optInId: 'o1', name: 'Bo', pressed: null, rowsAfter: [], context: 'feed|me', ...o })

describe('when an outcome is on screen', () => {
  it('opt in: once the member has a status; withdraw: once they have none', () => {
    expect(signUpOutcomeShown(attempt({ kind: 'optIn', optInId: null }), new Map(), {})).toBe(false)
    expect(signUpOutcomeShown(attempt({ kind: 'optIn', optInId: null }), new Map([['p1', 'pending']]), {})).toBe(true)
    expect(signUpOutcomeShown(attempt({ kind: 'optIn', optInId: null }), new Map([['p2', 'pending']]), {})).toBe(false)
    expect(signUpOutcomeShown(attempt({ kind: 'withdraw', optInId: null }), new Map([['p1', 'pending']]), {})).toBe(false)
    expect(signUpOutcomeShown(attempt({ kind: 'withdraw', optInId: null }), new Map(), {})).toBe(true)
  })

  it('accept, decline, complete: once that row has the new status; unblock: once the row is gone', () => {
    const rows = (status: string) => ({ p1: [rowOf('o1', status), rowOf('o2')] })
    for (const [kind, status] of [['accept', 'accepted'], ['decline', 'declined'], ['complete', 'completed']] as const) {
      expect(signUpOutcomeShown(attempt({ kind }), new Map(), rows('pending')), kind).toBe(false)
      expect(signUpOutcomeShown(attempt({ kind }), new Map(), rows(status)), kind).toBe(true)
      // Another row with that status is not this row.
      expect(signUpOutcomeShown(attempt({ kind, optInId: 'o9' }), new Map(), rows(status)), kind).toBe(false)
    }
    expect(signUpOutcomeShown(attempt({ kind: 'unblock' }), new Map(), rows('declined'))).toBe(false)
    expect(signUpOutcomeShown(attempt({ kind: 'unblock' }), new Map(), { p1: [rowOf('o2')] })).toBe(true)
    expect(signUpOutcomeShown(attempt({ kind: 'unblock' }), new Map(), {})).toBe(true)
  })
})

describe('where focus goes', () => {
  const page = (...ids: string[]) => {
    const has = new Set(ids)
    return { byTestId: (id: string) => (has.has(id) ? ({ id } as unknown as HTMLElement) : null), rowAction: (id: string) => (has.has(`row:${id}`) ? ({ id: `row:${id}` } as unknown as HTMLElement) : null) }
  }
  const target = (a: Partial<SignUpAttempt>, ...ids: string[]) => {
    const p = page(...ids)
    return (signUpFocusTarget(attempt(a), p.byTestId, p.rowAction) as unknown as { id: string } | null)?.id ?? null
  }

  it('each action has its control', () => {
    expect(target({ kind: 'optIn' }, 'withdraw-btn-p1', 'opt-in-btn-p1')).toBe('withdraw-btn-p1')
    expect(target({ kind: 'withdraw' }, 'withdraw-btn-p1', 'opt-in-btn-p1')).toBe('opt-in-btn-p1')
    expect(target({ kind: 'accept' }, 'complete-optin-o1', 'opt-in-manage-p1')).toBe('complete-optin-o1')
    expect(target({ kind: 'complete' }, 'complete-optin-o1', 'opt-in-manage-p1')).toBe('opt-in-manage-p1')
  })

  it('decline: that same row\'s Unblock (the way to undo it) — never another person\'s row; the toggle only when the row has no control', () => {
    expect(target({ kind: 'decline', rowsAfter: ['o2', 'o3'] }, 'unblock-optin-o1', 'row:o1', 'row:o2', 'row:o3', 'opt-in-manage-p1')).toBe('unblock-optin-o1')
    // No Unblock by that id: whatever control the row has.
    expect(target({ kind: 'decline', rowsAfter: ['o2'] }, 'row:o1', 'row:o2', 'opt-in-manage-p1')).toBe('row:o1')
    // The row has no control: the toggle, not the next row.
    expect(target({ kind: 'decline', rowsAfter: ['o2'] }, 'row:o2', 'opt-in-manage-p1')).toBe('opt-in-manage-p1')
    expect(target({ kind: 'decline', rowsAfter: [] }, 'post-card-p1')).toBe('post-card-p1')
  })

  it('unblock (its row is gone): the first action of the next row that has one, in order; else the toggle', () => {
    expect(target({ kind: 'unblock', rowsAfter: ['o2', 'o3'] }, 'row:o2', 'row:o3', 'opt-in-manage-p1')).toBe('row:o2')
    expect(target({ kind: 'unblock', rowsAfter: ['o2', 'o3'] }, 'row:o3', 'opt-in-manage-p1')).toBe('row:o3')
    expect(target({ kind: 'unblock', rowsAfter: ['o2', 'o3'] }, 'opt-in-manage-p1')).toBe('opt-in-manage-p1')
    expect(target({ kind: 'unblock', rowsAfter: [] }, 'row:o1', 'opt-in-manage-p1')).toBe('opt-in-manage-p1')
  })

  it('a target that is not on the page falls back to the toggle, then to the card, then to nothing', () => {
    expect(target({ kind: 'accept' }, 'opt-in-manage-p1', 'post-card-p1')).toBe('opt-in-manage-p1')
    expect(target({ kind: 'accept' }, 'post-card-p1')).toBe('post-card-p1')
    expect(target({ kind: 'optIn' }, 'post-card-p1')).toBe('post-card-p1')
    expect(target({ kind: 'withdraw' })).toBeNull()
  })

  it('the pressed control of each action, by its test id', () => {
    expect(KINDS.map((k) => signUpControlTestId(k, 'p1', 'o1'))).toEqual(['opt-in-btn-p1', 'withdraw-btn-p1', 'accept-optin-o1', 'decline-optin-o1', 'complete-optin-o1', 'unblock-optin-o1'])
    const card = readCard()
    for (const id of ['opt-in-btn-${post.id}', 'withdraw-btn-${post.id}', 'accept-optin-${oi.id}', 'decline-optin-${oi.id}', 'complete-optin-${oi.id}', 'unblock-optin-${oi.id}', 'opt-in-manage-${post.id}', 'post-card-${post.id}']) {
      expect(card, id).toContain(`data-testid={\`${id}\`}`)
    }
    // Each row is findable by its id (the next row's first action).
    expect(card).toContain('data-opt-in-row={oi.id}')
  })
})

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
function readCard() {
  return readFileSync(fileURLToPath(new URL('../components/feed/feed-post-card.tsx', import.meta.url)), 'utf8')
}

describe('was focus lost?', () => {
  const body = {}
  const doc = (activeElement: unknown) => ({ activeElement, body }) as unknown as Document
  const removed = { isConnected: false } as unknown as Element

  it('on the body, on nothing, on the removed control or on any detached element: yes', () => {
    expect(focusWasLost(removed, doc(body))).toBe(true)
    expect(focusWasLost(removed, doc(null))).toBe(true)
    expect(focusWasLost(removed, doc(removed))).toBe(true)
    expect(focusWasLost(null, doc({ isConnected: false }))).toBe(true)
  })

  it('on another control that is on the page: no', () => {
    expect(focusWasLost(removed, doc({ isConnected: true }))).toBe(false)
    expect(focusWasLost(null, doc({ isConnected: true }))).toBe(false)
  })

  it('with no document (a server render) there is no focus to keep', () => {
    expect(focusWasLost(null, undefined)).toBe(true)
  })
})

describe('the hook', () => {
  const g = globalThis as Record<string, unknown>
  let focused: string[] = []
  let page: Map<string, { isConnected: boolean; focus: () => void }>
  const el = (key: string) => {
    const e = { isConnected: true, focus: () => void focused.push(key) }
    page.set(key, e)
    return e
  }
  beforeEach(() => {
    focused = []
    page = new Map()
    const body = {}
    g.document = {
      body,
      activeElement: body,
      querySelector: (sel: string) => page.get(/data-testid="([^"]+)"/.exec(sel)?.[1] ?? sel) ?? null,
    }
    g.CSS = { escape: (s: string) => s }
  })
  afterEach(() => {
    delete g.document
    delete g.CSS
  })

  /** The hook on the mini runtime, with an announcer that records the order of what it is asked. */
  function harness(locale: Locale = 'en') {
    const log: string[] = []
    const announce = (text: string, moveFocus?: () => void) => {
      const before = focused.length
      moveFocus?.()
      log.push(...focused.slice(before).map((f) => `focus:${f}`), `say:${text}`)
    }
    const state = { memberStatuses: new Map<string, string>(), authorRows: {} as Record<string, SignUpRow[]>, context: 'feed|me' }
    const c = mount(() => useSignUpOutcomes({ locale, announce, memberStatuses: state.memberStatuses, authorRows: state.authorRows, context: state.context }))
    const begin = (kind: SignUpKind, ids: { postId?: string; optInId?: string }) => {
      const a = c.tree().begin(kind, ids)
      if (!a) throw new Error(`begin(${kind}) was refused`)
      return a
    }
    return { c, log, state, api: () => c.tree(), begin, busy: () => [...c.rerender().busy] }
  }

  it('says nothing until the request came back AND the card shows the outcome; then once, focus before the sentence', () => {
    const h = harness()
    const pressed = el('opt-in-btn-p1')
    el('withdraw-btn-p1')
    const a = h.begin('optIn', { postId: 'p1' })
    expect(a.pressed).toBe(pressed)
    // The state changes before the request is confirmed: nothing.
    h.state.memberStatuses = new Map([['p1', 'pending']])
    h.c.rerender()
    expect(h.log).toEqual([])
    h.state.memberStatuses = new Map()
    h.c.rerender()
    // Confirmed, not on screen yet: nothing.
    h.api().succeeded(a)
    h.c.rerender()
    expect(h.log).toEqual([])
    // Something else changes first (another post's status, another post's rows): still nothing.
    h.state.memberStatuses = new Map([['p2', 'pending']])
    h.c.rerender()
    h.state.authorRows = { p3: [rowOf('o9', 'accepted')] }
    h.c.rerender()
    expect(h.log).toEqual([])
    // On screen; the pressed button went with the old state.
    pressed.isConnected = false
    h.state.memberStatuses = new Map([['p1', 'pending']])
    h.c.rerender()
    expect(h.log).toEqual(['focus:withdraw-btn-p1', `say:${optInsT('en', 'announceOptedIn')}`])
    // Later renders, and later state changes, add nothing.
    h.c.rerender()
    h.state.memberStatuses = new Map([['p1', 'accepted']])
    h.c.rerender()
    expect(h.log).toHaveLength(2)
  })

  it('an author\'s action: it remembers whom it is about and the rows after that row', () => {
    const h = harness()
    h.state.authorRows = { p1: [rowOf('o1', 'pending', 'Bo'), rowOf('o2'), rowOf('o3')] }
    h.c.rerender()
    el('decline-optin-o1')
    const a = h.begin('decline', { optInId: 'o1' })
    expect(a).toMatchObject({ kind: 'decline', postId: 'p1', optInId: 'o1', name: 'Bo', rowsAfter: ['o2', 'o3'], context: 'feed|me' })
    const last = h.begin('decline', { optInId: 'o3' })
    expect(last.rowsAfter).toEqual([])
  })

  it('focus is not moved when the pressed control is still on the page, or when the member has moved on', () => {
    for (const scenario of ['still-there', 'moved-on'] as const) {
      const h = harness()
      focused = []
      const pressed = el('opt-in-btn-p1')
      el('withdraw-btn-p1')
      const a = h.begin('optIn', { postId: 'p1' })
      h.api().succeeded(a)
      if (scenario === 'moved-on') {
        pressed.isConnected = false
        ;(g.document as Record<string, unknown>).activeElement = { isConnected: true }
      }
      h.state.memberStatuses = new Map([['p1', 'pending']])
      h.c.rerender()
      expect(h.log, scenario).toEqual([`say:${optInsT('en', 'announceOptedIn')}`])
    }
  })

  it('a failed request is said in the same region and moves nothing; a later state change says nothing more', () => {
    const h = harness('es')
    h.state.authorRows = { p1: [rowOf('o1', 'pending', 'Bo')] }
    h.c.rerender()
    const pressed = el('accept-optin-o1')
    el('complete-optin-o1')
    const a = h.begin('accept', { optInId: 'o1' })
    h.api().succeeded(a)
    h.api().failed(a)
    expect(h.log).toEqual([`say:${cardT('es', 'statusModerationFailed')}`])
    pressed.isConnected = false
    h.state.authorRows = { p1: [rowOf('o1', 'accepted', 'Bo')] }
    h.c.rerender()
    expect(h.log).toHaveLength(1)
    expect(focused).toEqual([])
  })

  describe('one attempt per row', () => {
    const two = () => {
      const h = harness()
      h.state.authorRows = { p1: [rowOf('o1', 'pending', 'Bo'), rowOf('o2', 'pending', 'Cy')] }
      h.c.rerender()
      const acceptBo = el('accept-optin-o1')
      const declineCy = el('decline-optin-o2')
      el('complete-optin-o1')
      el('unblock-optin-o2')
      return { h, acceptBo, declineCy }
    }

    it('two quick actions on different rows are both said, each when its row shows it; the second does not replace the first', () => {
      const { h, acceptBo, declineCy } = two()
      const a = h.begin('accept', { optInId: 'o1' })
      const b = h.begin('decline', { optInId: 'o2' })
      expect(signUpAttemptKey(a)).not.toBe(signUpAttemptKey(b))
      h.api().succeeded(a)
      h.api().succeeded(b)
      acceptBo.isConnected = false
      h.state.authorRows = { p1: [rowOf('o1', 'accepted', 'Bo'), rowOf('o2', 'pending', 'Cy')] }
      h.c.rerender()
      expect(h.log).toEqual(['focus:complete-optin-o1', `say:You accepted ${isolate('Bo')}.`])
      declineCy.isConnected = false
      h.state.authorRows = { p1: [rowOf('o1', 'accepted', 'Bo'), rowOf('o2', 'declined', 'Cy')] }
      h.c.rerender()
      expect(h.log.slice(2)).toEqual(['focus:unblock-optin-o2', `say:You declined ${isolate('Cy')}.`])
    })

    it('outcomes that show in the same render are one announcement, in press order; focus follows the latest press', () => {
      const { h, acceptBo, declineCy } = two()
      const a = h.begin('accept', { optInId: 'o1' })
      const b = h.begin('decline', { optInId: 'o2' })
      h.api().succeeded(a)
      h.api().succeeded(b)
      acceptBo.isConnected = false
      declineCy.isConnected = false
      h.state.authorRows = { p1: [rowOf('o1', 'accepted', 'Bo'), rowOf('o2', 'declined', 'Cy')] }
      h.c.rerender()
      expect(h.log).toEqual(['focus:unblock-optin-o2', `say:You accepted ${isolate('Bo')}. You declined ${isolate('Cy')}.`])
      h.c.rerender()
      expect(h.log).toHaveLength(2)
    })

    it('a failed action on one row leaves another row\'s confirmed outcome to be said', () => {
      const { h, acceptBo } = two()
      const a = h.begin('accept', { optInId: 'o1' })
      const b = h.begin('decline', { optInId: 'o2' })
      h.api().succeeded(a)
      h.api().failed(b)
      expect(h.log).toEqual([`say:${cardT('en', 'statusModerationFailed')}`])
      acceptBo.isConnected = false
      h.state.authorRows = { p1: [rowOf('o1', 'accepted', 'Bo'), rowOf('o2', 'pending', 'Cy')] }
      h.c.rerender()
      expect(h.log.slice(1)).toEqual(['focus:complete-optin-o1', `say:You accepted ${isolate('Bo')}.`])
    })

    it('a row is busy from the press until its outcome is settled or its action fails: a second press starts nothing', () => {
      const { h } = two()
      expect(h.busy()).toEqual([])
      const a = h.begin('accept', { optInId: 'o1' })
      expect(h.busy()).toEqual(['o1'])
      // The same row again, with any of its actions: refused, synchronously (before any render).
      expect(h.api().begin('accept', { optInId: 'o1' })).toBeNull()
      expect(h.api().begin('decline', { optInId: 'o1' })).toBeNull()
      // Another row is free.
      const b = h.begin('decline', { optInId: 'o2' })
      expect(h.busy()).toEqual(['o1', 'o2'])
      // A failure frees its row at once.
      h.api().failed(b)
      expect(h.busy()).toEqual(['o1'])
      expect(h.api().begin('decline', { optInId: 'o2' })).not.toBeNull()
      // A confirmed action keeps its row busy until the read that follows it has settled.
      h.api().succeeded(a)
      h.c.rerender()
      expect(h.busy()).toContain('o1')
      expect(h.api().begin('complete', { optInId: 'o1' })).toBeNull()
      h.api().settled(a)
      expect(h.busy()).not.toContain('o1')
      expect(h.api().begin('complete', { optInId: 'o1' })).not.toBeNull()
    })

    it('the member\'s own two actions are not gated here (the card swaps their button itself)', () => {
      const h = harness()
      expect(h.api().begin('optIn', { postId: 'p1' })).not.toBeNull()
      expect(h.api().begin('optIn', { postId: 'p1' })).not.toBeNull()
      expect(h.busy()).toEqual([])
    })
  })

  describe('an attempt never outlives the read that follows its action', () => {
    it('settled and shown: said once, as before', () => {
      const h = harness()
      h.state.authorRows = { p1: [rowOf('o1', 'pending', 'Bo')] }
      h.c.rerender()
      const pressed = el('accept-optin-o1')
      el('complete-optin-o1')
      const a = h.begin('accept', { optInId: 'o1' })
      h.api().succeeded(a)
      pressed.isConnected = false
      h.state.authorRows = { p1: [rowOf('o1', 'accepted', 'Bo')] }
      h.api().settled(a)
      h.c.rerender()
      expect(h.log).toEqual(['focus:complete-optin-o1', `say:You accepted ${isolate('Bo')}.`])
      h.c.rerender()
      expect(h.log).toHaveLength(2)
    })

    it('settled and NOT shown (the row never came back): said then, with focus on what is left — and never later', () => {
      const h = harness()
      h.state.authorRows = { p1: [rowOf('o1', 'pending', 'Bo')] }
      h.c.rerender()
      const pressed = el('accept-optin-o1')
      el('opt-in-manage-p1')
      const a = h.begin('accept', { optInId: 'o1' })
      h.api().succeeded(a)
      h.c.rerender()
      expect(h.log).toEqual([])
      pressed.isConnected = false
      h.api().settled(a)
      h.c.rerender()
      expect(h.log).toEqual(['focus:opt-in-manage-p1', `say:You accepted ${isolate('Bo')}.`])
      // The row shows up accepted much later (another read): nothing is said then.
      h.state.authorRows = { p1: [rowOf('o1', 'accepted', 'Bo')] }
      h.c.rerender()
      expect(h.log).toHaveLength(2)
    })

    it('settled after a read that failed: the sentence also says the list could not be refreshed', () => {
      const h = harness('es')
      h.state.authorRows = { p1: [rowOf('o1', 'pending', 'Bo')] }
      h.c.rerender()
      el('accept-optin-o1').isConnected = false
      el('complete-optin-o1')
      const a = h.begin('accept', { optInId: 'o1' })
      h.api().succeeded(a)
      h.state.authorRows = signUpRowsAfter(h.state.authorRows, a)
      h.api().settled(a, true)
      h.c.rerender()
      expect(h.log).toEqual(['focus:complete-optin-o1', `say:Aceptaste a ${isolate('Bo')}. ${optInsT('es', 'announceListStale')}`])
    })

    it('settling an attempt that is not armed (never confirmed, or already said) says nothing', () => {
      const h = harness()
      h.state.authorRows = { p1: [rowOf('o1', 'pending', 'Bo')] }
      h.c.rerender()
      const a = h.begin('accept', { optInId: 'o1' })
      h.api().settled(a)
      h.c.rerender()
      expect(h.log).toEqual([])
    })

    it('disarm: the caller says the outcome itself; true only while it had not been said; the row is freed', () => {
      const h = harness('es')
      h.state.authorRows = { p1: [rowOf('o1', 'pending', 'Bo')] }
      h.c.rerender()
      const a = h.begin('accept', { optInId: 'o1' })
      h.api().succeeded(a)
      expect(h.api().sentence(a)).toBe(`Aceptaste a ${isolate('Bo')}.`)
      expect(h.api().disarm(a)).toBe(true)
      expect(h.api().disarm(a)).toBe(false)
      expect(h.busy()).toEqual([])
      h.state.authorRows = { p1: [rowOf('o1', 'accepted', 'Bo')] }
      h.c.rerender()
      expect(h.log).toEqual([])
    })
  })

  describe('an attempt belongs to the account and sub-tab visit it began in', () => {
    it.each([['another account', 'feed|someone-else'], ['another sub-tab', 'events|me']])('%s: nothing begun before is said, and no row stays busy', (_name, next) => {
      const h = harness()
      h.state.authorRows = { p1: [rowOf('o1', 'pending', 'Bo'), rowOf('o2', 'pending', 'Cy')] }
      h.c.rerender()
      const a = h.begin('accept', { optInId: 'o1' })
      const b = h.begin('decline', { optInId: 'o2' })
      h.api().succeeded(a)
      expect(h.busy()).toEqual(['o1', 'o2'])
      h.state.context = next
      expect(h.busy()).toEqual([])
      // The old account's requests come back now: confirmed, failed, settled — all ignored.
      h.api().succeeded(b)
      h.api().failed(b)
      h.api().settled(a)
      h.state.authorRows = { p1: [rowOf('o1', 'accepted', 'Bo'), rowOf('o2', 'declined', 'Cy')] }
      h.c.rerender()
      expect(h.log).toEqual([])
      expect(h.api().disarm(a)).toBe(false)
      // The rows are free for the account that is here now.
      expect(h.api().begin('accept', { optInId: 'o1' })).not.toBeNull()
    })
  })

  describe('the rows as an action left them (used when the read that follows it fails)', () => {
    const rows = { p1: [rowOf('o1', 'pending', 'Bo'), rowOf('o2', 'declined', 'Cy')], p2: [rowOf('o3')] }
    it.each([['accept', 'accepted'], ['decline', 'declined'], ['complete', 'completed']] as const)('%s sets that row to %s and leaves every other row as it is', (kind, status) => {
      const next = signUpRowsAfter(rows, attempt({ kind, optInId: 'o1' }))
      expect(next.p1.map((r) => [r.id, r.status])).toEqual([['o1', status], ['o2', 'declined']])
      expect(next.p1[1]).toBe(rows.p1[1])
      expect(next.p2).toEqual(rows.p2)
      expect(signUpOutcomeShown(attempt({ kind, optInId: 'o1' }), new Map(), next)).toBe(true)
    })
    it('unblock removes the row', () => {
      const next = signUpRowsAfter(rows, attempt({ kind: 'unblock', optInId: 'o2' }))
      expect(next.p1.map((r) => r.id)).toEqual(['o1'])
      expect(signUpOutcomeShown(attempt({ kind: 'unblock', optInId: 'o2' }), new Map(), next)).toBe(true)
    })
    it('the member\'s own actions, and an attempt with no row, change nothing', () => {
      expect(signUpRowsAfter(rows, attempt({ kind: 'optIn', optInId: null }))).toBe(rows)
      expect(signUpRowsAfter(rows, attempt({ kind: 'accept', optInId: null }))).toBe(rows)
    })
  })

  it.each(LOCALES)('%s: each of the six outcomes has its own sentence; the author\'s four name the person, isolated', (locale) => {
    const said = KINDS.map((k) => signUpNotice(k, 'مريم', locale))
    expect(new Set(said).size).toBe(6)
    for (const [i, kind] of KINDS.entries()) {
      expect(said[i]).not.toMatch(/\{\w+\}/)
      if (kind === 'optIn' || kind === 'withdraw') expect(said[i]).not.toContain('مريم')
      else expect(said[i]).toContain(isolate('مريم'))
    }
    if (locale !== 'en') for (const [i, kind] of KINDS.entries()) expect(said[i], kind).not.toBe(signUpNotice(kind, 'مريم', 'en'))
    // The sentence added when the list could not be read again.
    expect(optInsT(locale, 'announceListStale').trim()).not.toBe('')
    if (locale !== 'en') expect(optInsT(locale, 'announceListStale')).not.toBe(optInsT('en', 'announceListStale'))
  })

  it('English sentences', () => {
    expect(KINDS.map((k) => signUpNotice(k, 'Bo', 'en'))).toEqual([
      'You are opted in.',
      'Your opt-in was withdrawn.',
      `You accepted ${isolate('Bo')}.`,
      `You declined ${isolate('Bo')}.`,
      `Marked completed for ${isolate('Bo')}.`,
      `${isolate('Bo')} unblocked. They can request again.`,
    ])
    // A name is never looked up: one that equals a key or a status is said as written.
    expect(signUpNotice('accept', 'announceDeclined', 'es')).toBe(`Aceptaste a ${isolate('announceDeclined')}.`)
    // A name that is a stored status word is not turned into its label (English labels equal the stored words, so check a locale where they differ).
    for (const status of ['pending', 'accepted', 'declined', 'completed']) expect(signUpNotice('accept', status, 'es')).toBe(`Aceptaste a ${isolate(status)}.`)
  })
})
