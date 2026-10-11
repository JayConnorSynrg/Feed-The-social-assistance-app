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
import { signUpControlTestId, signUpFocusTarget, signUpOutcomeShown, useSignUpOutcomes, type SignUpAttempt, type SignUpRow } from './use-sign-up-outcomes'

const LOCALES = Object.keys(messages) as Locale[]
const KINDS: SignUpKind[] = ['optIn', 'withdraw', 'accept', 'decline', 'complete', 'unblock']
const rowOf = (id: string, status = 'pending', name = `name-${id}`): SignUpRow => ({ id, postId: 'p1', seekerName: name, status })
const attempt = (o: Partial<SignUpAttempt>): SignUpAttempt => ({ kind: 'accept', postId: 'p1', optInId: 'o1', name: 'Bo', pressed: null, rowsAfter: [], ...o })

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

  it('decline and unblock: the first action of the next row that has one, in order; else the toggle', () => {
    for (const kind of ['decline', 'unblock'] as const) {
      expect(target({ kind, rowsAfter: ['o2', 'o3'] }, 'row:o2', 'row:o3', 'opt-in-manage-p1')).toBe('row:o2')
      expect(target({ kind, rowsAfter: ['o2', 'o3'] }, 'row:o3', 'opt-in-manage-p1')).toBe('row:o3')
      expect(target({ kind, rowsAfter: ['o2', 'o3'] }, 'opt-in-manage-p1')).toBe('opt-in-manage-p1')
      expect(target({ kind, rowsAfter: [] }, 'row:o1', 'opt-in-manage-p1')).toBe('opt-in-manage-p1')
    }
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
    const state = { memberStatuses: new Map<string, string>(), authorRows: {} as Record<string, SignUpRow[]> }
    const c = mount(() => useSignUpOutcomes({ locale, announce, memberStatuses: state.memberStatuses, authorRows: state.authorRows }))
    return { c, log, state, api: () => c.tree() }
  }

  it('says nothing until the request came back AND the card shows the outcome; then once, focus before the sentence', () => {
    const h = harness()
    const pressed = el('opt-in-btn-p1')
    el('withdraw-btn-p1')
    const a = h.api().begin('optIn', { postId: 'p1' })
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
    const a = h.api().begin('decline', { optInId: 'o1' })
    expect(a).toMatchObject({ kind: 'decline', postId: 'p1', optInId: 'o1', name: 'Bo', rowsAfter: ['o2', 'o3'] })
    const last = h.api().begin('decline', { optInId: 'o3' })
    expect(last.rowsAfter).toEqual([])
  })

  it('focus is not moved when the pressed control is still on the page, or when the member has moved on', () => {
    for (const scenario of ['still-there', 'moved-on'] as const) {
      const h = harness()
      focused = []
      const pressed = el('opt-in-btn-p1')
      el('withdraw-btn-p1')
      const a = h.api().begin('optIn', { postId: 'p1' })
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
    const a = h.api().begin('accept', { optInId: 'o1' })
    h.api().succeeded(a)
    h.api().failed()
    expect(h.log).toEqual([`say:${cardT('es', 'statusModerationFailed')}`])
    pressed.isConnected = false
    h.state.authorRows = { p1: [rowOf('o1', 'accepted', 'Bo')] }
    h.c.rerender()
    expect(h.log).toHaveLength(1)
    expect(focused).toEqual([])
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
  })

  it('English sentences', () => {
    expect(KINDS.map((k) => signUpNotice(k, 'Bo', 'en'))).toEqual([
      'You are opted in.',
      'Your opt-in was withdrawn.',
      `${isolate('Bo')} accepted.`,
      `${isolate('Bo')} declined.`,
      `Marked completed for ${isolate('Bo')}.`,
      `${isolate('Bo')} unblocked. They can request again.`,
    ])
    // A name is never looked up: one that equals a key or a status is said as written.
    expect(signUpNotice('accept', 'announceDeclined', 'es')).toBe(`Aceptaste a ${isolate('announceDeclined')}.`)
  })
})
