// apps/web/src/components/panels/feed-panel.posts.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// FeedPanel's post paths, driven on the mini hook runtime with a fake Supabase client: who sees a
// hidden post (ranked, chronological, realtime), what a moderator's card action sends, where focus
// goes and what is announced after the edit / report / remove dialogs, and that a realtime patch
// announces nothing. Children are not rendered: the test reads the props FeedPanel gives them
// (FeedPostCard, PostEditDialog, ReportDialog, ConfirmDeleteDialog) and calls them as React would.
//
// Also the sign-up ("opt-in") actions of a card: each sends exactly the request it always sent,
// once; its outcome is said in the card-notice region and focus goes to the control that replaced
// the pressed one (or stays, when the member moved on); a failure is said and moves nothing; the
// list stays on screen while the feed is re-read; and the review dialog gets its opener back.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

type Row = Record<string, unknown>
type Call = { m: string; a: unknown[] }

const h = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null, profileSettled: true, isAuthenticated: false, isAnonymous: false, loading: false },
  tier: null as string | null,
  rows: [] as Row[],
  rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcReply: (() => ({ data: null, error: null })) as (fn: string) => { data: unknown; error: unknown },
  reads: [] as Array<{ table: string; calls: Call[] }>,
  notices: [] as string[],
  realtime: null as null | { onUpdate: (row: Row) => void; onInsert: (row: Row) => void },
  focused: [] as string[],
  elements: new Map<string, { focus: () => void; isConnected: boolean }>(),
  // Hook results are stable objects, as the real hooks' callbacks are (useCallback).
  stable: {} as Record<string, unknown>,
  // Sign-ups: the viewer's own statuses (post id → status), the rows of resource_opt_ins, and
  // what a write to that table answers.
  memberStatuses: new Map<string, string>(),
  optIns: [] as Row[],
  writeError: null as unknown,
  // Every request, in the order it was sent (reads, writes and rpcs alike).
  log: [] as string[],
  // What the single-post read and the sign-up rows read answer when they are to fail.
  postReadError: null as unknown,
  rowsReadError: null as unknown,
  // A read of one of these kinds takes the next gate of its kind (if any) and answers, with what
  // it read when it was sent, only once the gate opens: lets a test make an older read arrive
  // after a newer one. rows: the sign-up rows; post: the single-post read; status: my statuses;
  // reviews: my reviews; declines: the author's decline markers.
  rowGates: [] as Array<Promise<void>>,
  postGates: [] as Array<Promise<void>>,
  statusGates: [] as Array<Promise<void>>,
  reviewGates: [] as Array<Promise<void>>,
  declineGates: [] as Array<Promise<void>>,
  // What the reviews read and the decline-markers read answer.
  myReviews: new Map<string, Row>(),
  declines: [] as Row[],
  // The sign-up rows request throws as it is built (something no read result covers).
  rowsReadThrows: false,
  // Error-level log rows: event name and labels.
  logged: [] as Array<{ event: string; labels: unknown }>,
  eventCardWrites: 0,
  statusReadFails: false,
  // Persisted wide-event rows, as the real withMetric core writes them (level, event, labels,
  // request id, duration), and every x-request-id header a request carried.
  metrics: [] as Array<{ level: string; event: string; ctx: Record<string, unknown>; requestId?: string; duration_ms?: number }>,
  headers: [] as Array<{ to: string; name: string; value: string }>,
  // Called as each notice is said (to read the card at that moment).
  onNotice: null as null | ((text: string) => void),
  // Every call to the card-notice announcer, empty ones included (an empty one clears the region
  // and cancels a sentence still waiting for its frame).
  announced: [] as string[],
}))
const once = <T,>(k: string, make: () => T): T => (h.stable[k] ??= make()) as T

vi.mock('motion/react', () => {
  const pass = (p: { children?: unknown }) => p.children
  return { LazyMotion: pass, AnimatePresence: pass, domAnimation: {}, useReducedMotion: () => false, m: new Proxy({}, { get: () => 'div' }) }
})
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: (event: string, _err: unknown, labels: unknown) => void h.logged.push({ event, labels }) },
  logEvent: vi.fn(),
  // The REAL wide-event core, with its sink capturing the rows it would persist.
  withMetric: async (op: string, attrs: Record<string, string | number | boolean | null>, fn: () => Promise<unknown>, requestId?: string) => {
    const { runWithMetric } = await import('@/lib/with-metric-core.mjs')
    const sink = (level: string, event: string, ctx: Record<string, unknown> = {}, rid?: string, duration_ms?: number) => void h.metrics.push({ level, event, ctx: { ...ctx }, requestId: rid, duration_ms })
    return runWithMetric({ emit: () => {}, sink }, op, attrs, fn, requestId)
  },
}))
vi.mock('@/lib/privacy-prefs', async (orig) => ({ ...(await orig<object>()), readShareLocationPref: () => false }))
vi.mock('@/hooks/use-auth', async (orig) => ({
  ...(await orig<object>()), useAuth: () => h.auth }))
vi.mock('@/hooks/use-admin-viewer', async (orig) => ({
  ...(await orig<object>()),
  useAdminViewer: () => once(`viewer:${h.tier}`, () => ({ status: 'ready', tier: h.tier })),
}))
vi.mock('@/hooks/use-saved-resources', () => ({ useSavedResources: () => once('saved', () => ({ savedResources: [] })) }))
vi.mock('@/hooks/use-opt-ins', () => ({
  useOptIns: () =>
    once('optins', () => ({
      // The contract of hooks/use-opt-ins.ts: the statuses of the posts asked about, or "the
      // read failed" — never an empty map for a failure.
      fetchOptInsForPosts: async (ids: string[]) => {
        h.log.push(`optins.mine(${ids.join(',')})`)
        const answer = h.statusReadFails ? { ok: false } : { ok: true, statuses: new Map([...h.memberStatuses].filter(([id]) => ids.includes(id))) }
        await (h.statusGates.shift() ?? Promise.resolve())
        return answer
      },
      optIn: vi.fn(),
      withdrawOptIn: vi.fn(),
    })),
}))
vi.mock('@/hooks/use-reviews', () => ({
  useReviews: () =>
    once('reviews', () => ({
      fetchMyReviewsForOptIns: async (ids: string[]) => {
        h.log.push(`reviews.mine(${ids.join(',')})`)
        const answer = new Map([...h.myReviews].filter(([id]) => ids.includes(id)))
        await (h.reviewGates.shift() ?? Promise.resolve())
        return answer
      },
    })),
}))
vi.mock('@/hooks/use-follows', () => ({
  useFollows: () => once('follows', () => ({ followingIds: new Set(), fetchFollowing: () => {}, follow: vi.fn(), unfollow: vi.fn(), error: null })),
}))
vi.mock('@/hooks/use-petitions', () => ({ usePetitions: () => once('petitions', () => ({ petitions: [], sign: vi.fn(), signingId: null })) }))
vi.mock('@/hooks/use-profile-locale', () => ({ useProfileLocale: () => 'en' }))
vi.mock('@/components/layout/feed-shell', async (orig) => ({
  ...(await orig<object>()),
  usePanelContext: () => once('panel', () => ({ panelParams: {}, setActivePanel: () => {}, setPanelParams: () => {} })),
}))
vi.mock('@/hooks/use-realtime-feed', async (orig) => ({
  ...(await orig<object>()),
  useRealtimeFeed: (o: { onUpdate: (row: Row) => void; onInsert: (row: Row) => void }) => {
    h.realtime = o
  },
  useRealtimeComments: () => {},
}))
vi.mock('@/hooks/use-feed-event-cards', async (orig) => ({
  ...(await orig<object>()),
  useFeedEventCards: () => once('events', () => ({
    eventItems: [],
    setEventItems: () => void h.eventCardWrites++,
    eventMyStatuses: {},
    setEventMyStatuses: () => void h.eventCardWrites++,
    eventAnonClaims: new Set(),
    setEventAnonClaims: () => void h.eventCardWrites++,
    feedNotice: '',
    handleEventManaged: () => {},
    // The real announcer moves focus first, then sets the notice: the same order here.
    // (An empty sentence is the announcer being asked to move focus and say nothing.)
    announceCardNotice: (text: string, moveFocus?: () => void) => {
      h.announced.push(text)
      moveFocus?.()
      if (text !== '') h.notices.push(text)
      if (text !== '') h.onNotice?.(text)
    },
    syncFeedEventCard: () => {},
  })),
}))
vi.mock('@/lib/supabase/client', () => {
  const client = {
    from(table: string) {
      const calls: Call[] = []
      h.reads.push({ table, calls })
      const arg = (m: string, col: string) => calls.find((c) => c.m === m && c.a[0] === col)?.a[1]
      const fullRows = () => calls.some((c) => c.m === 'select' && String(c.a[0]).includes('seeker:profiles'))
      /** One line per request: what was asked of which table. */
      const describeCall = (single: boolean) => {
        if (table === 'posts') {
          if (single && arg('eq', 'id') !== undefined) return `posts.one(${String(arg('eq', 'id'))})`
          return calls.some((c) => c.m === 'limit') ? 'posts.page' : `posts.in(${((arg('in', 'id') as string[] | undefined) ?? []).join(',')})`
        }
        if (table === 'resource_opt_ins') {
          const upd = calls.find((c) => c.m === 'update')
          // The request shape: `.select(id)` when the update asks for the rows it changed.
          if (upd) return `optins.update(${String(arg('eq', 'id'))}=${(upd.a[0] as { status: string }).status})${calls.some((c) => c.m === 'select') ? `.select(${String(calls.find((c) => c.m === 'select')?.a[0])})` : ''}`
          const ids = ((arg('in', 'post_id') as string[] | undefined) ?? []).join(',')
          return fullRows() ? `optins.rows(${ids})` : `optins.counts(${ids})`
        }
        return table
      }
      const result = () => {
        if (table === 'resource_opt_ins') {
          // An update answers with the rows it changed when asked to (`.select('id')`): the rows
          // that exist under that id — none when the request is gone. No error either way.
          if (calls.some((c) => c.m === 'update')) {
            if (h.writeError) return { data: null, error: h.writeError }
            const returning = calls.some((c) => c.m === 'select')
            return { data: returning ? h.optIns.filter((o) => o.id === arg('eq', 'id')).map((o) => ({ id: o.id })) : null, error: null }
          }
          const full = fullRows()
          if (full && h.rowsReadError) return { data: null, error: h.rowsReadError }
          const posts = arg('in', 'post_id') as string[] | undefined
          const rows = h.optIns.filter((o) => !posts || posts.includes(o.post_id as string))
          return { data: full ? rows : rows.map((o) => ({ post_id: o.post_id })), error: null }
        }
        if (table === 'opt_in_declines') return { data: h.declines, error: null }
        if (table !== 'posts') return { data: [], error: null }
        const idEq = calls.find((c) => c.m === 'eq' && c.a[0] === 'id')?.a[1]
        const idIn = calls.find((c) => c.m === 'in' && c.a[0] === 'id')?.a[1] as string[] | undefined
        let data = h.rows
        if (idEq !== undefined) data = data.filter((r) => r.id === idEq)
        if (idIn) data = data.filter((r) => idIn.includes(r.id as string))
        // The chronological page: before the cursor, one page (the rows are kept newest first).
        const before = arg('lt', 'created_at') as string | undefined
        if (before !== undefined) data = data.filter((r) => String(r.created_at) < before)
        const limit = calls.find((c) => c.m === 'limit')?.a[0] as number | undefined
        if (limit !== undefined) data = data.slice(0, limit)
        return { data, error: null }
      }
      const chain: Record<string, unknown> = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === 'then')
              return (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
                h.log.push(describeCall(false))
                const r = result()
                const gate = table === 'resource_opt_ins' && fullRows() ? h.rowGates.shift() : table === 'opt_in_declines' ? h.declineGates.shift() : undefined
                return (gate ?? Promise.resolve()).then(() => r).then(res, rej)
              }
            if (prop === 'maybeSingle' || prop === 'single')
              return () => {
                h.log.push(describeCall(true))
                if (table === 'posts' && h.postReadError) return Promise.resolve({ data: null, error: h.postReadError })
                const r = result()
                const gate = table === 'posts' ? h.postGates.shift() : undefined
                return (gate ?? Promise.resolve()).then(() => ({ data: (r.data as Row[])[0] ?? null, error: null }))
              }
            return (...a: unknown[]) => {
              if (prop === 'setHeader') h.headers.push({ to: table, name: a[0] as string, value: a[1] as string })
              if (h.rowsReadThrows && table === 'resource_opt_ins' && prop === 'in' && fullRows()) throw new Error('the request could not be built')
              calls.push({ m: prop, a })
              return chain
            }
          },
        },
      )
      return chain
    },
    rpc(fn: string, args: Record<string, unknown>) {
      h.rpcs.push({ fn, args })
      h.log.push(`rpc:${fn}`)
      // The ranked feed: the rows in their order, one page of p_limit after the cursor.
      const ranked = () => {
        const all = h.rows.map((r, i) => ({ id: r.id, kind: 'post', score: 1000 - i, distance_bucket: 'unknown' }))
        const from = args.p_cursor_id ? all.findIndex((r) => r.id === args.p_cursor_id) + 1 : 0
        return all.slice(from, from + ((args.p_limit as number | undefined) ?? 25))
      }
      const reply = fn === 'ranked_feed_v2' ? { data: ranked(), error: null } : h.rpcReply(fn)
      const chain: Record<string, unknown> = {
        abortSignal: () => chain,
        setHeader: (name: string, value: string) => (h.headers.push({ to: fn, name, value }), chain),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(reply).then(res, rej),
      }
      return chain
    },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  }
  return { createClient: () => client }
})

// A minimal DOM: elements by data-testid that record focus.
function el(testId: string) {
  const e = { isConnected: true, focus: () => void h.focused.push(testId) }
  h.elements.set(testId, e)
  return e
}
const testIdOf = (sel: string) => /data-testid="([^"]+)"/.exec(sel)?.[1] ?? sel
;(globalThis as Record<string, unknown>).document = {
  querySelector: (sel: string) => h.elements.get(testIdOf(sel)) ?? null,
  getElementById: () => null,
}
;(globalThis as Record<string, unknown>).CSS = { escape: (s: string) => s }
;(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: (t: number) => void) => {
  cb(0)
  return 0
}
;(globalThis as Record<string, unknown>).cancelAnimationFrame = () => {}

import { mount, findAll } from '@/test/mini-react'
import { CreatePostCard, FeedPanel } from './feed-panel'
import { FeedPostCard } from '@/components/feed/feed-post-card'
import { PostEditDialog } from '@/components/feed/post-edit-dialog'
import { ReportDialog } from '@/components/feed/report-dialog'
import { ConfirmDeleteDialog } from '@/components/feed/post-delete-dialog'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { FEED_POST_SELECT } from '@/components/feed/post-model'
import { cardT } from '@/lib/i18n-feed-card'
import { FeedHeader, FeedLoadMore, FeedStatusRegions } from '@/components/feed/feed-chrome'
import { ReviewModal } from '@/components/feed/review-modal'
import { isolate } from '@/lib/format-message'
import { optInErrorText, optInsT, SIGN_UP_CHANGED_MEANWHILE, SIGN_UP_NOT_DONE } from '@/lib/i18n-feed-optins'

const AUTHOR = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002'

function row(id: string, o: Row = {}): Row {
  return {
    id,
    user_id: AUTHOR,
    content: `post ${id}`,
    created_at: '2026-10-01T12:00:00.000Z',
    is_pinned: false,
    is_hidden: false,
    image_url: null,
    max_seekers: null,
    slots_remaining: null,
    post_type: 'feed',
    petition_id: null,
    resource_id: null,
    metadata: null,
    like_count: 0,
    comment_count: 0,
    version: 3,
    edited_at: null,
    edit_count: 0,
    image_alt: null,
    hidden_reason: null,
    user: { id: AUTHOR, first_name: 'Ada', avatar_url: null, admin_tier: null, harmony_score: null, harmony_reviews_count: 0, badge_summary: null },
    resource: null,
    ...o,
  }
}

type Viewer = 'author' | 'member' | 'cm' | 'pa' | 'guest'
function signIn(v: Viewer) {
  h.auth = {
    user: v === 'guest' ? null : { id: v === 'author' ? AUTHOR : OTHER },
    profileSettled: true,
    isAuthenticated: v !== 'guest',
    isAnonymous: false,
    loading: false,
  }
  h.tier = v === 'cm' ? 'community_moderator' : v === 'pa' ? 'platform_admin' : null
}

type El = { type: unknown; props: Record<string, unknown> }
const cardsOf = (tree: unknown) => findAll(tree, (e) => e.type === FeedPostCard) as El[]
const cardIds = (tree: unknown) => cardsOf(tree).map((c) => (c.props.post as { id: string }).id)
const one = (tree: unknown, type: unknown, pred: (e: El) => boolean = () => true) => findAll(tree, (e) => e.type === type && pred(e as El))[0] as El

beforeEach(() => {
  h.rows = [row('p1'), row('p2', { is_hidden: true, hidden_reason: 'hold_for_review' }), row('p3', { user_id: OTHER, user: { ...(row('x').user as Row), id: OTHER, first_name: 'Bo' } })]
  h.rpcs.length = 0
  h.reads.length = 0
  h.notices.length = 0
  h.focused.length = 0
  h.elements.clear()
  h.realtime = null
  h.rpcReply = () => ({ data: { success: true }, error: null })
  h.memberStatuses = new Map()
  h.optIns = []
  h.writeError = null
  h.log.length = 0
  h.postReadError = null
  h.rowsReadError = null
  h.rowGates.length = 0
  h.postGates.length = 0
  h.statusGates.length = 0
  h.reviewGates.length = 0
  h.declineGates.length = 0
  h.myReviews = new Map()
  h.declines = []
  h.rowsReadThrows = false
  h.logged.length = 0
  h.eventCardWrites = 0
  h.statusReadFails = false
  h.metrics.length = 0
  h.headers.length = 0
  h.onNotice = null
  h.announced.length = 0
  signIn('member')
})

async function feed() {
  const c = mount(() => FeedPanel())
  await c.flush(12)
  return c
}

describe('a hidden post is shown only to its author (ranked feed)', () => {
  it.each([
    ['author', ['p1', 'p2', 'p3']],
    ['member', ['p1', 'p3']],
    ['cm', ['p1', 'p3']],
    ['pa', ['p1', 'p3']],
    ['guest', ['p1', 'p3']],
  ] as const)('%s sees %j', async (v, ids) => {
    signIn(v)
    const c = await feed()
    expect(cardIds(c.tree())).toEqual(ids)
  })

  it("the author's own hidden post carries its hidden state to the card (the banner)", async () => {
    signIn('author')
    const c = await feed()
    const held = cardsOf(c.tree()).find((e) => (e.props.post as { id: string }).id === 'p2')!
    expect((held.props.post as { isHidden: boolean }).isHidden).toBe(true)
  })
})

describe('a hidden post is shown only to its author (chronological feed)', () => {
  it.each([
    ['author', ['p1', 'p2', 'p3']],
    ['member', ['p1', 'p3']],
    ['cm', ['p1', 'p3']],
    ['pa', ['p1', 'p3']],
  ] as const)('%s sees %j', async (v, ids) => {
    signIn(v)
    const c = await feed()
    ;(one(c.tree(), FeedHeader).props.onRankModeChange as (m: string) => void)('recent')
    await c.flush(12)
    expect(h.rpcs.filter((r) => r.fn === 'ranked_feed_v2')).toHaveLength(1)
    expect(cardIds(c.tree())).toEqual(ids)
  })
})

describe('realtime', () => {
  it('an inserted hidden post is hydrated but not shown to another viewer; its author sees it', async () => {
    h.rows = [row('p1')]
    const c = await feed()
    h.rows = [row('p1'), row('p9', { is_hidden: true, hidden_reason: 'hold_for_review' })]
    h.realtime!.onInsert({ id: 'p9' })
    await c.flush()
    expect(cardIds(c.tree())).toEqual(['p1'])

    signIn('author')
    const a = await feed()
    h.realtime!.onInsert({ id: 'p9' })
    await a.flush()
    expect(cardIds(a.tree())).toContain('p9')
  })

  it('a realtime patch (an edit, or the author marked held) changes the card and announces nothing', async () => {
    signIn('author')
    const c = await feed()
    h.realtime!.onUpdate({ id: 'p1', user_id: AUTHOR, version: 4, content: 'edited', is_hidden: false, deleted_at: null })
    h.realtime!.onUpdate({ id: 'p1', user_id: AUTHOR, version: 5, is_hidden: true, hidden_reason: 'hold_for_review', deleted_at: null })
    await c.flush()
    const p1 = cardsOf(c.tree()).find((e) => (e.props.post as { id: string }).id === 'p1')!
    expect((p1.props.post as { isHidden: boolean }).isHidden).toBe(true)
    expect(h.notices).toEqual([])
  })
})

describe('moderation from the card', () => {
  it('Remove asks first; confirming sends the version on screen, then the card leaves with focus on the next card', async () => {
    signIn('cm')
    const c = await feed()
    el('post-card-p3')
    const trigger = el('post-menu-p1')
    ;(cardsOf(c.tree())[0].props.onAction as (p: unknown, id: string, t: unknown) => void)(cardsOf(c.tree())[0].props.post, 'remove', trigger)
    c.rerender()
    // Nothing is sent until the moderator confirms.
    expect(h.rpcs.filter((r) => r.fn === 'admin_remove_post')).toEqual([])
    const dialog = one(c.tree(), ConfirmDeleteDialog, (e) => e.props.kind === 'remove')
    expect(dialog.props.open).toBe(true)
    await (dialog.props.onConfirm as () => Promise<unknown>)()
    await c.flush()
    expect(h.rpcs.filter((r) => r.fn === 'admin_remove_post').map((r) => r.args)).toEqual([{ p_post_id: 'p1', p_expected_version: 3 }])
    // The notice waits for the dialog to close (the modal hides the region).
    expect(h.notices).toEqual([])
    ;(dialog.props.onClosed as () => void)()
    await c.flush()
    expect(h.focused).toEqual(['post-card-p3'])
    expect(h.notices).toEqual(['Post removed.'])
    expect(cardIds(c.tree())).toEqual(['p3'])
  })

  it('Remove refused: the card stays, and the notice waits for the dialog to close, then focus returns to its ⋯ button', async () => {
    signIn('cm')
    h.rpcReply = (fn) => (fn === 'admin_remove_post' ? { data: null, error: { code: '42501', message: 'denied' } } : { data: null, error: null })
    const c = await feed()
    const trigger = el('post-menu-p1')
    const card = cardsOf(c.tree())[0]
    ;(card.props.onAction as (p: unknown, id: string, t: unknown) => void)(card.props.post, 'remove', trigger)
    c.rerender()
    const dialog = one(c.tree(), ConfirmDeleteDialog, (e) => e.props.kind === 'remove')
    await (dialog.props.onConfirm as () => Promise<unknown>)()
    await c.flush()
    expect(h.notices).toEqual([])
    ;(dialog.props.onClosed as () => void)()
    await c.flush()
    expect(h.focused).toEqual(['post-menu-p1'])
    expect(h.notices).toEqual([cardT('en', 'statusModerationFailed')])
    expect(cardIds(c.tree())).toEqual(['p1', 'p3'])
  })

  it('Hold sends the version on screen', async () => {
    signIn('cm')
    const c = await feed()
    const card = cardsOf(c.tree())[0]
    ;(card.props.onAction as (p: unknown, id: string, t: unknown) => void)(card.props.post, 'hold', el('post-menu-p1'))
    await c.flush()
    expect(h.rpcs.filter((r) => r.fn === 'admin_hold_post').map((r) => r.args)).toEqual([{ p_post_id: 'p1', p_expected_version: 3 }])
  })
})

describe('the edit dialog', () => {
  it('after a save, focus returns to the card ⋯ button that opened it, then the notice', async () => {
    signIn('author')
    const c = await feed()
    const trigger = el('post-menu-p1')
    const card = cardsOf(c.tree())[0]
    ;(card.props.onAction as (p: unknown, id: string, t: unknown) => void)(card.props.post, 'edit', trigger)
    c.rerender()
    const dialog = one(c.tree(), PostEditDialog)
    ;(dialog.props.onSaved as (...a: unknown[]) => void)('p1', null, { version: 4, editedAt: '2026-10-02T00:00:00Z', editCount: 1 }, { content: 'new' })
    ;(dialog.props.onClose as () => void)()
    ;(dialog.props.onClosed as () => void)()
    await c.flush()
    expect(h.focused).toEqual(['post-menu-p1'])
    expect(h.notices).toEqual(['Post updated.'])
  })

  it('"Use the current version" patches the card and announces nothing', async () => {
    signIn('author')
    const c = await feed()
    const card = cardsOf(c.tree())[0]
    ;(card.props.onAction as (p: unknown, id: string, t: unknown) => void)(card.props.post, 'edit', el('post-menu-p1'))
    c.rerender()
    const dialog = one(c.tree(), PostEditDialog)
    ;(dialog.props.onSaved as (...a: unknown[]) => void)('p1', { ...row('p1'), content: 'theirs', version: 6 }, null, {})
    ;(dialog.props.onClosed as () => void)()
    await c.flush()
    expect((cardsOf(c.tree())[0].props.post as { content: string }).content).toBe('theirs')
    expect(h.notices).toEqual([])
  })

  it('a post found gone: once the dialog closes, focus goes to the next card, the card leaves, then the notice', async () => {
    signIn('author')
    const c = await feed()
    el('post-card-p2')
    const card = cardsOf(c.tree())[0]
    ;(card.props.onAction as (p: unknown, id: string, t: unknown) => void)(card.props.post, 'edit', el('post-menu-p1'))
    c.rerender()
    const dialog = one(c.tree(), PostEditDialog)
    ;(dialog.props.onGone as (id: string) => void)('p1')
    ;(dialog.props.onClose as () => void)()
    expect(h.notices).toEqual([])
    ;(dialog.props.onClosed as () => void)()
    await c.flush()
    expect(h.focused).toEqual(['post-card-p2'])
    expect(cardIds(c.tree())).toEqual(['p2', 'p3'])
    expect(h.notices).toEqual(['This post was deleted by its author.'])
  })
})

describe('reporting', () => {
  it('a report that hides the post: after the dialog closes the card leaves (focus to the next card)', async () => {
    h.rpcReply = (fn) => (fn === 'submit_content_report' ? { data: { report_count: 3, hidden: true }, error: null } : { data: null, error: null })
    const c = await feed()
    el('post-card-p3')
    const card = cardsOf(c.tree())[0]
    ;(card.props.onAction as (p: unknown, id: string, t: unknown) => void)(card.props.post, 'report', el('post-menu-p1'))
    c.rerender()
    const dialog = one(c.tree(), ReportDialog)
    await (dialog.props.onSubmit as (...a: unknown[]) => Promise<void>)('p1', 'spam', null)
    ;(dialog.props.onClosed as () => void)()
    await c.flush()
    expect(cardIds(c.tree())).toEqual(['p3'])
    expect(h.focused).toEqual(['post-card-p3'])
    expect(h.notices).toEqual(['Report sent. The post is hidden while moderators review it.'])
  })

  it("a guest's report prompt names its link in the viewer's language", async () => {
    signIn('guest')
    const c = await feed()
    const card = cardsOf(c.tree())[0]
    ;(card.props.onAction as (p: unknown, id: string, t: unknown) => void)(card.props.post, 'signup_to_report', el('post-menu-p1'))
    c.rerender()
    const prompt = findAll(c.tree(), (e) => e.type === CreateAccountPrompt).map((e) => e.props.linkLabel)
    expect(prompt.every((l) => typeof l === 'string' && l.length > 0)).toBe(true)
    expect(prompt.length).toBeGreaterThanOrEqual(1)
  })
})

describe('the feed reads posts with one column list', () => {
  it('the ranked read and a re-read both select FEED_POST_SELECT', async () => {
    await feed()
    const selects = h.reads.filter((r) => r.table === 'posts').map((r) => r.calls.find((c) => c.m === 'select')?.a[0])
    expect(selects.length).toBeGreaterThan(0)
    expect(new Set(selects)).toEqual(new Set([FEED_POST_SELECT]))
  })
})

describe('the composer card', () => {
  it('the "notify nearby" switch: wrapped in its <label>, stone-500 when off, thumb mirrored in right-to-left', () => {
    const c = mount(() => CreatePostCard({ onPost: async () => null, onCreated: () => {}, resourceOptions: [{ id: 'r1', name: 'Pantry' }], onSafetyAlertClick: () => {}, locale: 'en', onAnnounce: () => {} }))
    const select = findAll(c.tree(), (e) => e.type === 'select')[0] as El
    ;(select.props.onChange as (e: unknown) => void)({ target: { value: 'r1' } })
    const tree = c.rerender()
    const label = findAll(tree, (e) => e.type === 'label' && findAll(e.props.children, (x) => x.props['data-testid'] === 'geo-outreach-toggle').length > 0)
    expect(label).toHaveLength(1)
    const sw = findAll(tree, (e) => e.props['data-testid'] === 'geo-outreach-toggle')[0] as El
    expect(String(sw.props.className)).toContain('bg-stone-500')
    expect(String(sw.props.className)).not.toContain('bg-stone-400')
    const thumb = findAll(sw.props.children, (e) => e.type === 'span')[0] as El
    expect(String(thumb.props.className)).toContain('rtl:-translate-x-0.5')
  })
})

describe('dialogs without a description say so (no dangling aria-describedby)', () => {
  it("the guest's create-account dialog", async () => {
    signIn('guest')
    const c = await feed()
    const card = cardsOf(c.tree())[0]
    ;(card.props.onAction as (p: unknown, id: string, t: unknown) => void)(card.props.post, 'signup_to_report', el('post-menu-p1'))
    const tree = c.rerender()
    const content = findAll(tree, (e) => e.props.className === 'max-w-sm' && 'aria-describedby' in e.props)
    expect(content).toHaveLength(1)
    expect(content[0].props['aria-describedby']).toBeUndefined()
  })
})

describe('sign-up actions: what is sent, what is said, where focus goes', () => {
  type Spy = ReturnType<typeof vi.fn>
  const optInSpies = () => h.stable.optins as { optIn: Spy; withdrawOptIn: Spy }
  const doc = () => (globalThis as unknown as { document: Record<string, unknown> }).document
  const seeker = (id: string, name: string) => ({ id, first_name: name, harmony_score: null, harmony_reviews_count: 0 })
  const optIn = (id: string, name: string, status = 'pending', post = 'p1'): Row => ({ id, post_id: post, seeker_id: `s-${id}`, status, seeker: seeker(`s-${id}`, name) })
  const card = (c: { tree: () => unknown }, id: string) => cardsOf(c.tree()).find((x) => (x.props.post as { id: string }).id === id) as El
  const rowAction = (id: string) => `[data-opt-in-row="${id}"] button:not([disabled])`
  /** The pressed control has left the page and focus went with it (the browser puts it on the body). */
  const gone = (e: { isConnected: boolean }) => {
    e.isConnected = false
    doc().activeElement = doc().body
  }

  beforeEach(() => {
    h.rows = [row('p1', { max_seekers: 2, slots_remaining: 2 }), row('p3', { user_id: OTHER, user: { ...(row('x').user as Row), id: OTHER, first_name: 'Bo' } })]
    optInSpies()?.optIn.mockReset().mockResolvedValue({ id: 'o9', post_id: 'p1', status: 'pending' })
    optInSpies()?.withdrawOptIn.mockReset().mockResolvedValue(true)
    // unblock_opt_in answers whether it deleted the row.
    h.rpcReply = (fn) => (fn === 'unblock_opt_in' ? { data: true, error: null } : { data: { success: true }, error: null })
    doc().body = {}
    doc().activeElement = doc().body
  })

  describe('the member', () => {
    it('Opt In: one request; then "You are opted in." and focus on Withdraw, which took the button\'s place', async () => {
      const c = await feed()
      optInSpies().optIn.mockClear()
      // F4: what the card shows at the moment the sentence is said (the new state, not the old).
      const atNotice: unknown[] = []
      h.onNotice = () => void atNotice.push(card(c, 'p1').props.optInStatus)
      const pressed = el('opt-in-btn-p1')
      el('withdraw-btn-p1')
      const sent = (card(c, 'p1').props.onOptIn as (id: string) => Promise<void>)('p1')
      // Nothing is said or moved before the request has come back and the card shows it.
      expect(h.notices).toEqual([])
      h.memberStatuses.set('p1', 'pending')
      gone(pressed)
      await sent
      await c.flush()
      expect(optInSpies().optIn).toHaveBeenCalledTimes(1)
      expect(optInSpies().optIn).toHaveBeenCalledWith('p1', expect.any(String))
      expect(optInSpies().withdrawOptIn).not.toHaveBeenCalled()
      expect(card(c, 'p1').props.optInStatus).toBe('pending')
      expect(h.focused).toEqual(['withdraw-btn-p1'])
      expect(h.notices).toEqual([optInsT('en', 'announceOptedIn')])
      expect(atNotice).toEqual(['pending'])
      // Said once: later renders and re-reads add nothing.
      c.rerender()
      await c.flush()
      expect(h.notices).toHaveLength(1)
      expect(h.focused).toHaveLength(1)
      expect(optInSpies().optIn).toHaveBeenCalledTimes(1)
    })

    it('Opt In refused ("This offer is full"): the card gets the sentence for its alert line; nothing is announced here and focus stays', async () => {
      const c = await feed()
      optInSpies().optIn.mockReset().mockRejectedValue(new Error('This offer is full'))
      el('opt-in-btn-p1')
      el('withdraw-btn-p1')
      await (card(c, 'p1').props.onOptIn as (id: string) => Promise<void>)('p1')
      await c.flush()
      expect(optInSpies().optIn).toHaveBeenCalledTimes(1)
      expect(card(c, 'p1').props.optInError).toBe('This offer is full')
      expect(h.notices).toEqual([])
      expect(h.focused).toEqual([])
    })

    it('Withdraw: one request; then "Your opt-in was withdrawn." and focus on Opt In', async () => {
      h.memberStatuses.set('p1', 'pending')
      const c = await feed()
      expect(card(c, 'p1').props.optInStatus).toBe('pending')
      const pressed = el('withdraw-btn-p1')
      el('opt-in-btn-p1')
      // F4: at the moment the sentence is said the card shows Opt In again (no status).
      const atNotice: unknown[] = []
      h.onNotice = () => void atNotice.push(card(c, 'p1').props.optInStatus ?? 'none')
      const sent = (card(c, 'p1').props.onWithdraw as (id: string) => Promise<void>)('p1')
      h.memberStatuses.delete('p1')
      gone(pressed)
      await sent
      await c.flush()
      expect(atNotice).toEqual(['none'])
      expect(optInSpies().withdrawOptIn).toHaveBeenCalledTimes(1)
      expect(optInSpies().withdrawOptIn).toHaveBeenCalledWith('p1', expect.any(String))
      expect(optInSpies().optIn).not.toHaveBeenCalled()
      expect(h.focused).toEqual(['opt-in-btn-p1'])
      expect(h.notices).toEqual([optInsT('en', 'announceWithdrawn')])
    })

    it('a member who moved on keeps their place: the result is said, focus is not taken', async () => {
      const c = await feed()
      const pressed = el('opt-in-btn-p1')
      el('withdraw-btn-p1')
      const sent = (card(c, 'p1').props.onOptIn as (id: string) => Promise<void>)('p1')
      h.memberStatuses.set('p1', 'pending')
      pressed.isConnected = false
      doc().activeElement = { isConnected: true }
      await sent
      await c.flush()
      expect(h.notices).toEqual([optInsT('en', 'announceOptedIn')])
      expect(h.focused).toEqual([])
    })

    it('the read that follows an opt-in comes back without the status: the outcome is said then, once — and never later', async () => {
      const c = await feed()
      const pressed = el('opt-in-btn-p1')
      el('post-card-p1')
      const sent = (card(c, 'p1').props.onOptIn as (id: string) => Promise<void>)('p1')
      gone(pressed)
      await sent
      await c.flush()
      // The write went through; the card does not show it. It is still said, with focus on the card.
      expect(card(c, 'p1').props.optInStatus).toBeUndefined()
      expect(h.notices).toEqual([optInsT('en', 'announceOptedIn')])
      expect(h.focused).toEqual(['post-card-p1'])
      // Much later the status shows up (a realtime update, another read): nothing more is said.
      h.memberStatuses.set('p1', 'pending')
      h.realtime!.onInsert({ id: 'p1' })
      ;(one(c.tree(), FeedHeader).props.onRankModeChange as (m: string) => void)('recent')
      await c.flush(12)
      expect(card(c, 'p1').props.optInStatus).toBe('pending')
      expect(h.notices).toHaveLength(1)
    })

    it('a pressed control that is still on the page keeps the focus', async () => {
      const c = await feed()
      el('opt-in-btn-p1')
      el('withdraw-btn-p1')
      const sent = (card(c, 'p1').props.onOptIn as (id: string) => Promise<void>)('p1')
      h.memberStatuses.set('p1', 'pending')
      await sent
      await c.flush()
      expect(h.notices).toHaveLength(1)
      expect(h.focused).toEqual([])
    })
  })

  // ── What an author action (and a sent review) sends, and what it leaves alone ──────────────
  /** The author's write, as it is sent: it asks for the row it changed. */
  const WRITE = (id: string, status: string) => `optins.update(${id}=${status}).select(id)`
  /** The one follow-up: a single read of the acted post, then ONE side-data set for THAT post (my
   *  status, decline markers, its sign-up rows, and — when it has rows — my reviews for them). */
  const followUp = (postId: string, rowIds: string[]) => [
    `posts.one(${postId})`,
    `optins.mine(${postId})`,
    'opt_in_declines',
    `optins.rows(${postId})`,
    ...(rowIds.length > 0 ? [`reviews.mine(${rowIds.join(',')})`] : []),
  ]
  const clearLog = () => {
    h.reads.length = 0
    h.rpcs.length = 0
    h.log.length = 0
    h.eventCardWrites = 0
  }
  const asAuthor = async (rows: Row[]) => {
    signIn('author')
    h.optIns = rows
    const c = await feed()
    clearLog()
    return c
  }
  type Mounted = { tree: () => unknown; rerender: () => unknown; flush: (n?: number) => Promise<unknown> }
  const update = (c: Mounted, id: string, status: string, post = 'p1') => (card(c, post).props.onAuthorUpdateOptIn as (id: string, s: string) => Promise<void>)(id, status)
  const unblock = (c: Mounted, id: string) => (card(c, 'p1').props.onAuthorUnblockOptIn as (id: string) => Promise<void>)(id)
  const rowsOf = (c: Mounted, post = 'p1') => ((card(c, post).props.authorOptIns as Array<{ id: string; status: string }> | undefined) ?? []).map((o) => [o.id, o.status])
  const busy = (c: Mounted) => [...((card(c, 'p1').props.busyOptInIds as ReadonlySet<string> | undefined) ?? [])]
  const cardError = (c: Mounted, post = 'p1') => card(c, post).props.optInError
  const setStatus = (id: string, status: string) => {
    h.optIns = h.optIns.map((o) => (o.id === id ? { ...o, status } : o))
  }
  const deferred = () => {
    let open = () => {}
    const promise = new Promise<void>((res) => {
      open = res
    })
    return { promise, open }
  }
  const loadMore = async (c: Mounted) => {
    ;(one(c.tree(), FeedLoadMore).props.onLoadMore as () => void)()
    await c.flush(12)
  }
  /** 27 posts, ranked: 25 on the first page (p1 is the author's, p3 another member's), then q1
   *  (the author's) and q2 (another member's) on the second. All with a seeker limit. */
  const twoPages = () => {
    const other = { user_id: OTHER, user: { ...(row('x').user as Row), id: OTHER, first_name: 'Bo' } }
    const capped = { max_seekers: 3, slots_remaining: 3 }
    const rows = [row('p1', capped), row('p3', { ...capped, ...other }), ...Array.from({ length: 23 }, (_, i) => row(`f${i + 1}`)), row('q1', capped), row('q2', { ...capped, ...other })]
    // Newest first, one minute apart (the chronological page reads "before the last one").
    return rows.map((r, i) => ({ ...r, created_at: new Date(Date.UTC(2026, 9, 1, 12) - i * 60_000).toISOString() }))
  }
  const PAGE_TWO = 'q1,q2'

  describe('the author', () => {
    it('the card gets the rows of its sign-up list', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      expect((card(c, 'p1').props.authorOptIns as Array<{ id: string; seekerName: string }>).map((o) => [o.id, o.seekerName])).toEqual([['o1', 'Bo'], ['o2', 'Cy']])
    })

    it('Accept: one write that asks for the changed row, one post read, one side-data set for that post; then "You accepted …" and focus on that row\'s Mark Completed', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      const before = cardIds(c.tree())
      const pressed = el('accept-optin-o1')
      el('complete-optin-o1')
      const sent = update(c, 'o1', 'accepted')
      setStatus('o1', 'accepted')
      gone(pressed)
      c.rerender()
      expect(cardIds(c.tree())).toEqual(before)
      await sent
      await c.flush()
      expect(h.log).toEqual([WRITE('o1', 'accepted'), ...followUp('p1', ['o1', 'o2'])])
      expect(rowsOf(c)).toEqual([['o1', 'accepted'], ['o2', 'pending']])
      expect(h.focused).toEqual(['complete-optin-o1'])
      expect(h.notices).toEqual([`You accepted ${isolate('Bo')}.`])
      expect(cardError(c)).toBeFalsy()
      // Nothing more is sent or said by later renders: the announce and focus code reads nothing.
      c.rerender()
      await c.flush()
      expect(h.log).toHaveLength(6)
      expect(h.notices).toHaveLength(1)
    })

    it('Decline: focus goes to that same row\'s Unblock (the way to undo it), not to another person\'s row', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      const pressed = el('decline-optin-o1')
      el('unblock-optin-o1')
      el(rowAction('o2'))
      el('opt-in-manage-p1')
      const sent = update(c, 'o1', 'declined')
      setStatus('o1', 'declined')
      gone(pressed)
      await sent
      await c.flush()
      expect(h.log).toEqual([WRITE('o1', 'declined'), ...followUp('p1', ['o1', 'o2'])])
      expect(h.focused).toEqual(['unblock-optin-o1'])
      expect(h.notices).toEqual([`You declined ${isolate('Bo')}.`])
    })

    it('Decline when that row ends up with no control: focus goes to the sign-up list toggle', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      const pressed = el('decline-optin-o2')
      el(rowAction('o1'))
      el('opt-in-manage-p1')
      const sent = update(c, 'o2', 'declined')
      setStatus('o2', 'declined')
      gone(pressed)
      await sent
      await c.flush()
      expect(h.focused).toEqual(['opt-in-manage-p1'])
      expect(h.notices).toEqual([`You declined ${isolate('Cy')}.`])
    })

    it('Mark Completed: one write and one follow-up; then "Marked completed for …" and focus on the sign-up list toggle', async () => {
      const c = await asAuthor([optIn('o1', 'Bo', 'accepted')])
      const pressed = el('complete-optin-o1')
      el('opt-in-manage-p1')
      const sent = update(c, 'o1', 'completed')
      setStatus('o1', 'completed')
      gone(pressed)
      await sent
      await c.flush()
      expect(h.log).toEqual([WRITE('o1', 'completed'), ...followUp('p1', ['o1'])])
      expect(h.focused).toEqual(['opt-in-manage-p1'])
      expect(h.notices).toEqual([`Marked completed for ${isolate('Bo')}.`])
    })

    it('Unblock: one request and one follow-up; the row goes, the count follows, then "… unblocked." and focus on the next row', async () => {
      const c = await asAuthor([optIn('o1', 'Bo', 'declined'), optIn('o2', 'Cy')])
      expect(card(c, 'p1').props.optInCount).toBe(2)
      const pressed = el('unblock-optin-o1')
      el(rowAction('o2'))
      const sent = unblock(c, 'o1')
      h.optIns = [optIn('o2', 'Cy')]
      gone(pressed)
      await sent
      await c.flush()
      expect(h.log).toEqual(['rpc:unblock_opt_in', ...followUp('p1', ['o2'])])
      expect(h.rpcs).toEqual([{ fn: 'unblock_opt_in', args: { p_opt_in_id: 'o1' } }])
      expect(rowsOf(c)).toEqual([['o2', 'pending']])
      // "N opted in" on the toggle is right after the action (it used to come from the page read).
      expect(card(c, 'p1').props.optInCount).toBe(1)
      expect(h.focused).toEqual([rowAction('o2')])
      expect(h.notices).toEqual([`${isolate('Bo')} unblocked. They can request again.`])
    })

    it('an Unblock on another row while the first is under way goes through (no panel-wide gate); the same row twice does not', async () => {
      const c = await asAuthor([optIn('o1', 'Bo', 'declined'), optIn('o2', 'Cy', 'declined')])
      el('unblock-optin-o1')
      el('unblock-optin-o2')
      const a = unblock(c, 'o1')
      const b = unblock(c, 'o2')
      const again = unblock(c, 'o1')
      h.optIns = []
      await Promise.all([a, b, again])
      await c.flush()
      expect(h.rpcs.filter((r) => r.fn === 'unblock_opt_in').map((r) => r.args.p_opt_in_id)).toEqual(['o1', 'o2'])
      expect(h.notices.join(' ')).toContain(`${isolate('Bo')} unblocked.`)
      expect(h.notices.join(' ')).toContain(`${isolate('Cy')} unblocked.`)
      expect(rowsOf(c)).toEqual([])
    })

    it('a name that reads like a status or a sentence is said as written, isolated', async () => {
      const c = await asAuthor([optIn('o1', 'accepted')])
      const pressed = el('accept-optin-o1')
      el('complete-optin-o1')
      const sent = update(c, 'o1', 'accepted')
      setStatus('o1', 'accepted')
      gone(pressed)
      await sent
      await c.flush()
      expect(h.notices).toEqual([`You accepted ${isolate('accepted')}.`])
    })
  })

  describe('an action that did not go through is shown on the card, and said once', () => {
    it.each(['accepted', 'declined', 'completed'] as const)('a failed %s: the card gets the fixed sentence for its alert line; nothing is said in the notice region; the write and nothing after it; focus stays; the row is free', async (status) => {
      const c = await asAuthor([optIn('o1', 'Bo', status === 'completed' ? 'accepted' : 'pending'), optIn('o2', 'Cy')])
      h.writeError = { code: '42501', message: 'permission denied' }
      el(status === 'accepted' ? 'accept-optin-o1' : status === 'declined' ? 'decline-optin-o1' : 'complete-optin-o1')
      el('complete-optin-o1')
      el('unblock-optin-o1')
      el('opt-in-manage-p1')
      el(rowAction('o2'))
      await update(c, 'o1', status)
      await c.flush()
      // No read of any kind follows a failed write.
      expect(h.log).toEqual([WRITE('o1', status)])
      // Shown: the card is handed the code its alert line reads. Not said twice: the alert speaks.
      expect(cardError(c)).toBe(SIGN_UP_NOT_DONE)
      expect(optInErrorText(SIGN_UP_NOT_DONE, 'es')).toEqual({ text: cardT('es', 'statusModerationFailed'), translated: true })
      expect(h.notices).toEqual([])
      expect(h.focused).toEqual([])
      expect(busy(c)).toEqual([])
    })

    it('a failed unblock is shown too, and sends nothing else', async () => {
      const c = await asAuthor([optIn('o1', 'Bo', 'declined')])
      h.rpcReply = (fn) => (fn === 'unblock_opt_in' ? { data: null, error: { message: 'Only a declined opt-in can be unblocked' } } : { data: null, error: null })
      el('unblock-optin-o1')
      await unblock(c, 'o1')
      await c.flush()
      expect(h.log).toEqual(['rpc:unblock_opt_in'])
      expect(cardError(c)).toBe(SIGN_UP_NOT_DONE)
      expect(h.notices).toEqual([])
      expect(h.focused).toEqual([])
      expect(busy(c)).toEqual([])
    })

    it('the line clears on the next action on that card that goes through', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      h.writeError = { code: '42501', message: 'permission denied' }
      el('accept-optin-o1')
      await update(c, 'o1', 'accepted')
      await c.flush()
      expect(cardError(c)).toBe(SIGN_UP_NOT_DONE)
      h.writeError = null
      el('accept-optin-o2')
      el('complete-optin-o2')
      const sent = update(c, 'o2', 'accepted')
      setStatus('o2', 'accepted')
      await sent
      await c.flush()
      expect(cardError(c)).toBeFalsy()
      expect(h.notices).toEqual([`You accepted ${isolate('Cy')}.`])
    })
  })

  describe('a write that changed nothing is not said as done', () => {
    it('K4-01 · Accept on a request the seeker has withdrawn: the update answers with no row; nothing is said as accepted; the card says the request had already changed (no retry); the stale row goes; focus is on the toggle', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      const pressed = el('accept-optin-o1')
      el('complete-optin-o1')
      el('opt-in-manage-p1')
      // The seeker withdrew; the author's list has not caught up and still shows the row.
      h.optIns = [optIn('o2', 'Cy')]
      const sent = update(c, 'o1', 'accepted')
      gone(pressed)
      await sent
      await c.flush()
      // The same follow-up as any action: it is what corrects the list.
      expect(h.log).toEqual([WRITE('o1', 'accepted'), ...followUp('p1', ['o2'])])
      expect(rowsOf(c)).toEqual([['o2', 'pending']])
      expect(card(c, 'p1').props.optInCount).toBe(1)
      expect(h.notices).toEqual([])
      expect(cardError(c)).toBe(SIGN_UP_CHANGED_MEANWHILE)
      expect(optInErrorText(SIGN_UP_CHANGED_MEANWHILE, 'es')).toEqual({ text: optInsT('es', 'changedMeanwhile'), translated: true })
      // The pressed button went with its row: focus is on a stable control, never on Mark Completed.
      expect(h.focused).toEqual(['opt-in-manage-p1'])
      expect(busy(c)).toEqual([])
      // Nothing is said later either.
      c.rerender()
      await c.flush()
      expect(h.notices).toEqual([])
    })

    it('K4-02 · Withdraw when the request was accepted meanwhile (withdraw_opt_in answers false): nothing is said as withdrawn; the card shows its real status and says it had already changed, without asking for a retry; no slot is given back', async () => {
      h.memberStatuses.set('p1', 'pending')
      // One spot of two is taken (by this member): a slot given back would show as 2.
      h.rows = [row('p1', { max_seekers: 2, slots_remaining: 1 }), ...h.rows.slice(1)]
      h.optIns = [optIn('o1', 'Me', 'pending')]
      const c = await feed()
      const slots = () => (card(c, 'p1').props.post as { slotsRemaining: number }).slotsRemaining
      const before = slots()
      expect(before).toBe(1)
      const count = card(c, 'p1').props.optInCount
      el('withdraw-btn-p1').isConnected = false
      el('post-card-p1')
      h.memberStatuses.set('p1', 'accepted')
      optInSpies().withdrawOptIn.mockReset().mockResolvedValue(false)
      h.log.length = 0
      await (card(c, 'p1').props.onWithdraw as (id: string) => Promise<void>)('p1')
      await c.flush()
      expect(optInSpies().withdrawOptIn).toHaveBeenCalledTimes(1)
      expect(h.log).toEqual(['optins.mine(p1)'])
      expect(card(c, 'p1').props.optInStatus).toBe('accepted')
      expect(h.notices).toEqual([])
      expect(cardError(c)).toBe(SIGN_UP_CHANGED_MEANWHILE)
      expect(optInErrorText(SIGN_UP_CHANGED_MEANWHILE, 'ar').text).toBe(optInsT('ar', 'changedMeanwhile'))
      expect(slots()).toBe(before)
      expect(card(c, 'p1').props.optInCount).toBe(count)
      expect(h.focused).toEqual(['post-card-p1'])
    })

    it('with the rows read failing on top: the request that no longer exists is NOT settled as accepted or declined; only the stale-list sentence is said', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      el('decline-optin-o1')
      el('unblock-optin-o1')
      h.optIns = [optIn('o2', 'Cy')]
      h.rowsReadError = { code: '57014', message: 'timeout' }
      await update(c, 'o1', 'declined')
      await c.flush()
      // The list could not be read again: it shows what it showed, and says it is not fresh.
      expect(rowsOf(c)).toEqual([['o1', 'pending'], ['o2', 'pending']])
      expect(h.notices).toEqual([optInsT('en', 'announceListStale')])
      expect(cardError(c)).toBe(SIGN_UP_NOT_DONE)
      expect(h.logged).toEqual([{ event: 'feed.optin.reread_failed', labels: { step: 'side_data', action: 'decline' } }])
      expect(busy(c)).toEqual([])
    })

    it.each([
      ['K4-06', 'declined', 'decline-optin-o1'],
      ['K4-07', 'completed', 'complete-optin-o1'],
    ] as const)('%s · %s on a request that is gone (the update answers with no row): nothing is said as done; the list is read again and the card says the request had already changed', async (_label, status, testId) => {
      const c = await asAuthor([optIn('o1', 'Bo', status === 'completed' ? 'accepted' : 'pending'), optIn('o2', 'Cy')])
      const pressed = el(testId)
      el('unblock-optin-o1')
      el('opt-in-manage-p1')
      h.optIns = [optIn('o2', 'Cy')]
      const sent = update(c, 'o1', status)
      gone(pressed)
      await sent
      await c.flush()
      expect(h.log).toEqual([WRITE('o1', status), ...followUp('p1', ['o2'])])
      expect(rowsOf(c)).toEqual([['o2', 'pending']])
      expect(h.notices).toEqual([])
      expect(cardError(c)).toBe(SIGN_UP_CHANGED_MEANWHILE)
      expect(h.focused).toEqual(['opt-in-manage-p1'])
      expect(busy(c)).toEqual([])
    })

    it('K4-09 · Unblock that deleted nothing (unblock_opt_in answers false, another tab got there first): not said as unblocked; the card shows the row as it is now and says it had already changed; the count is not lowered', async () => {
      const c = await asAuthor([optIn('o1', 'Bo', 'declined'), optIn('o2', 'Cy')])
      h.rpcReply = (fn) => (fn === 'unblock_opt_in' ? { data: false, error: null } : { data: null, error: null })
      const pressed = el('unblock-optin-o1')
      el('opt-in-manage-p1')
      // The other tab's unblock went through and the seeker asked again: a new pending row.
      h.optIns = [optIn('o3', 'Bo'), optIn('o2', 'Cy')]
      const sent = unblock(c, 'o1')
      gone(pressed)
      await sent
      await c.flush()
      expect(h.log).toEqual(['rpc:unblock_opt_in', ...followUp('p1', ['o3', 'o2'])])
      expect(rowsOf(c)).toEqual([['o3', 'pending'], ['o2', 'pending']])
      expect(card(c, 'p1').props.optInCount).toBe(2)
      expect(h.notices).toEqual([])
      expect(cardError(c)).toBe(SIGN_UP_CHANGED_MEANWHILE)
      expect(h.focused).toEqual(['opt-in-manage-p1'])
    })

    it('K4-09 · stale path: an Unblock that deleted nothing, with the rows read failing on top: both rows stay, the count stays, the card keeps the plain failure, only the stale-list sentence is said', async () => {
      const c = await asAuthor([optIn('o1', 'Bo', 'declined'), optIn('o2', 'Cy')])
      expect(card(c, 'p1').props.optInCount).toBe(2)
      h.rpcReply = (fn) => (fn === 'unblock_opt_in' ? { data: false, error: null } : { data: null, error: null })
      h.rowsReadError = { code: '57014', message: 'timeout' }
      el('unblock-optin-o1')
      el('opt-in-manage-p1')
      await unblock(c, 'o1')
      await c.flush()
      expect(rowsOf(c)).toEqual([['o1', 'declined'], ['o2', 'pending']])
      expect(card(c, 'p1').props.optInCount).toBe(2)
      expect(cardError(c)).toBe(SIGN_UP_NOT_DONE)
      expect(h.notices).toEqual([optInsT('en', 'announceListStale')])
      expect(busy(c)).toEqual([])
    })

    it('L1 · a write that changed nothing on a post that is gone at the re-read: the card leaves without an empty announcement (which would cancel another card\'s waiting sentence), focus to the next card', async () => {
      const c = await asAuthor([optIn('o1', 'Bo')])
      h.optIns = []
      h.rows = h.rows.filter((r) => r.id !== 'p1')
      el('accept-optin-o1').isConnected = false
      el('post-card-p3')
      await update(c, 'o1', 'accepted')
      await c.flush()
      expect(cardIds(c.tree())).toEqual(['p3'])
      expect(h.focused).toEqual(['post-card-p3'])
      expect(h.announced).toEqual([])
      expect(h.notices).toEqual([])
    })

    it('L2 · a write that changed nothing: focus lands first, and only then does the card say why — once', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      const pressed = el('accept-optin-o1')
      el('complete-optin-o1')
      const toggle = el('opt-in-manage-p1')
      const lineAtFocus: unknown[] = []
      toggle.focus = () => {
        lineAtFocus.push(cardError(c) || null)
        h.focused.push('opt-in-manage-p1')
      }
      h.optIns = [optIn('o2', 'Cy')]
      const sent = update(c, 'o1', 'accepted')
      gone(pressed)
      await sent
      await c.flush()
      expect(lineAtFocus).toEqual([null])
      expect(cardError(c)).toBe(SIGN_UP_CHANGED_MEANWHILE)
      expect(h.focused).toEqual(['opt-in-manage-p1'])
      expect(h.announced).toEqual([])
    })

    it('L4a · the line goes only on a card that is on screen, and never comes back with a post that returns later', async () => {
      h.rows = [...h.rows, row('p5', { max_seekers: 1, slots_remaining: 1 })]
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      el('accept-optin-o1').isConnected = false
      el('opt-in-manage-p1')
      // (a) The follow-up read of a no-change is held; meanwhile a refresh lists the feed without p1.
      const held = deferred()
      h.rowGates.push(held.promise)
      h.optIns = [optIn('o2', 'Cy')]
      const sent = update(c, 'o1', 'accepted')
      await c.flush()
      const all = h.rows
      h.rows = all.filter((r) => r.id !== 'p1')
      ;(one(c.tree(), FeedHeader).props.onRankModeChange as (m: string) => void)('recent')
      await c.flush(12)
      expect(cardIds(c.tree())).not.toContain('p1')
      held.open()
      await sent
      await c.flush()
      // p1 comes back: no line from before.
      h.rows = all
      ;(one(c.tree(), FeedHeader).props.onRankModeChange as (m: string) => void)('ranked')
      await c.flush(12)
      expect(cardIds(c.tree())).toContain('p1')
      expect(cardError(c)).toBeFalsy()
      // (b) A line that was shown on screen goes with its card when a refresh drops the post.
      el('accept-optin-o2').isConnected = false
      h.optIns = []
      await update(c, 'o2', 'accepted')
      await c.flush()
      expect(cardError(c)).toBe(SIGN_UP_CHANGED_MEANWHILE)
      h.rows = all.filter((r) => r.id !== 'p1')
      ;(one(c.tree(), FeedHeader).props.onRankModeChange as (m: string) => void)('recent')
      await c.flush(12)
      h.rows = all
      ;(one(c.tree(), FeedHeader).props.onRankModeChange as (m: string) => void)('ranked')
      await c.flush(12)
      expect(cardIds(c.tree())).toContain('p1')
      expect(cardError(c)).toBeFalsy()
      expect(h.notices).toEqual([])
    })

    it('L4a · a card taken out by realtime while the follow-up read of a no-change is on its way: no line is kept for it, so the post comes back without one', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      el('accept-optin-o1').isConnected = false
      const held = deferred()
      h.rowGates.push(held.promise)
      h.optIns = [optIn('o2', 'Cy')]
      const sent = update(c, 'o1', 'accepted')
      await c.flush()
      h.realtime!.onUpdate({ id: 'p1', user_id: AUTHOR, version: 3, is_hidden: false, deleted_at: '2026-10-02T00:00:00.000Z' })
      await c.flush()
      expect(cardIds(c.tree())).not.toContain('p1')
      held.open()
      await sent
      await c.flush()
      h.realtime!.onInsert({ id: 'p1' })
      await c.flush()
      expect(cardIds(c.tree())).toContain('p1')
      expect(cardError(c)).toBeFalsy()
    })

    it('second check: the update answered with a row, yet the fresh read does not show the outcome — not said as done; the card shows the failure', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      el('accept-optin-o1').isConnected = false
      el('opt-in-manage-p1')
      // The row exists (the update matches it) and still reads pending afterwards.
      await update(c, 'o1', 'accepted')
      await c.flush()
      expect(rowsOf(c)).toEqual([['o1', 'pending'], ['o2', 'pending']])
      expect(h.notices).toEqual([])
      expect(cardError(c)).toBe(SIGN_UP_NOT_DONE)
      expect(busy(c)).toEqual([])
    })
  })

  describe('every sign-up write is one wide event in app_logs', () => {
    /** The persisted rows of the sign-up write event. */
    const writes = () => h.metrics.filter((m) => m.event.startsWith('feed.optin.write'))
    /** The x-request-id each request carried (by table or rpc name). */
    const headerTo = (to: string) => h.headers.filter((x) => x.to === to && x.name === 'x-request-id').map((x) => x.value)
    const expectOne = (event: string, action: string, outcome: string) => {
      const rows = writes()
      expect(rows.map((r) => [r.event, r.ctx.action, r.ctx.outcome])).toEqual([[event, action, outcome]])
      const [r] = rows
      expect(typeof r.duration_ms).toBe('number')
      expect(r.requestId).toMatch(/\S/)
      expect(r.ctx.request_id).toBe(r.requestId)
      return r
    }

    it('KG-07 · each of the six actions that goes through writes exactly one row: outcome success, its action, duration_ms and the request id it sent as x-request-id; no other error row', async () => {
      // Member: opt in, then withdraw.
      const m = await feed()
      el('opt-in-btn-p1')
      h.memberStatuses.set('p1', 'pending')
      await (card(m, 'p1').props.onOptIn as (id: string) => Promise<void>)('p1')
      await m.flush()
      let r = expectOne('feed.optin.write.complete', 'opt_in', 'success')
      expect(optInSpies().optIn).toHaveBeenLastCalledWith('p1', r.requestId)
      h.metrics.length = 0
      h.memberStatuses.delete('p1')
      await (card(m, 'p1').props.onWithdraw as (id: string) => Promise<void>)('p1')
      await m.flush()
      r = expectOne('feed.optin.write.complete', 'withdraw', 'success')
      expect(optInSpies().withdrawOptIn).toHaveBeenLastCalledWith('p1', r.requestId)
      // Author: accept, decline, mark completed, unblock.
      for (const [status, action, start] of [['accepted', 'accept', 'pending'], ['declined', 'decline', 'pending'], ['completed', 'complete', 'accepted']] as const) {
        const c = await asAuthor([optIn('o1', 'Bo', start)])
        h.metrics.length = 0
        h.headers.length = 0
        const sent = update(c, 'o1', status)
        setStatus('o1', status)
        await sent
        await c.flush()
        r = expectOne('feed.optin.write.complete', action, 'success')
        expect(headerTo('resource_opt_ins')).toEqual([r.requestId])
      }
      const c = await asAuthor([optIn('o1', 'Bo', 'declined')])
      h.metrics.length = 0
      h.headers.length = 0
      const sent = unblock(c, 'o1')
      h.optIns = []
      await sent
      await c.flush()
      r = expectOne('feed.optin.write.complete', 'unblock', 'success')
      expect(headerTo('unblock_opt_in')).toEqual([r.requestId])
      expect(h.logged).toEqual([])
    })

    it('KG-12 · a write that changed nothing is its own outcome: no_change (accept, decline, complete with no row back; withdraw and unblock answering false)', async () => {
      for (const status of ['accepted', 'declined', 'completed'] as const) {
        const c = await asAuthor([optIn('o1', 'Bo', status === 'completed' ? 'accepted' : 'pending')])
        h.optIns = []
        h.metrics.length = 0
        await update(c, 'o1', status)
        await c.flush()
        expectOne('feed.optin.write.complete', status === 'accepted' ? 'accept' : status === 'declined' ? 'decline' : 'complete', 'no_change')
      }
      const c = await asAuthor([optIn('o1', 'Bo', 'declined')])
      h.rpcReply = (fn) => (fn === 'unblock_opt_in' ? { data: false, error: null } : { data: null, error: null })
      h.metrics.length = 0
      await unblock(c, 'o1')
      await c.flush()
      expectOne('feed.optin.write.complete', 'unblock', 'no_change')
      signIn('member')
      h.memberStatuses.set('p1', 'accepted')
      const m = await feed()
      optInSpies().withdrawOptIn.mockReset().mockResolvedValue(false)
      h.metrics.length = 0
      await (card(m, 'p1').props.onWithdraw as (id: string) => Promise<void>)('p1')
      await m.flush()
      expectOne('feed.optin.write.complete', 'withdraw', 'no_change')
    })

    it('a failed write is one error row: outcome failed and the server\'s code as error_code (an author update, an unblock, a refused opt in)', async () => {
      const c = await asAuthor([optIn('o1', 'Bo')])
      h.writeError = { code: '42501', message: 'permission denied' }
      h.metrics.length = 0
      await update(c, 'o1', 'accepted')
      await c.flush()
      expect(expectOne('feed.optin.write.error', 'accept', 'failed').ctx.error_code).toBe('42501')
      h.writeError = null
      const u = await asAuthor([optIn('o1', 'Bo', 'declined')])
      h.rpcReply = (fn) => (fn === 'unblock_opt_in' ? { data: null, error: { code: '22023', message: 'Only a declined opt-in can be unblocked' } } : { data: null, error: null })
      h.metrics.length = 0
      await unblock(u, 'o1')
      await u.flush()
      expect(expectOne('feed.optin.write.error', 'unblock', 'failed').ctx.error_code).toBe('22023')
      signIn('member')
      const m = await feed()
      optInSpies().optIn.mockReset().mockRejectedValue(Object.assign(new Error('This offer is full'), { code: 'P0001' }))
      h.metrics.length = 0
      await (card(m, 'p1').props.onOptIn as (id: string) => Promise<void>)('p1')
      await m.flush()
      expect(expectOne('feed.optin.write.error', 'opt_in', 'failed').ctx.error_code).toBe('P0001')
      // The old failure-only rows are gone: one row per action, never two.
      expect(h.logged.filter((l) => l.event === 'feed.optin.update' || l.event === 'feed.optin.unblock')).toEqual([])
    })
  })

  describe('a row is busy until its outcome shows', () => {
    it('a double press sends one write; the row is marked busy for the card, and free once the outcome is on screen', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      el('accept-optin-o1')
      el('complete-optin-o1')
      // Two presses before anything has rendered, then a third (Decline, same row) after a render.
      const first = update(c, 'o1', 'accepted')
      const second = update(c, 'o1', 'accepted')
      c.rerender()
      expect(busy(c)).toEqual(['o1'])
      const third = update(c, 'o1', 'declined')
      setStatus('o1', 'accepted')
      await Promise.all([first, second, third])
      await c.flush()
      expect(h.log).toEqual([WRITE('o1', 'accepted'), ...followUp('p1', ['o1', 'o2'])])
      expect(h.notices).toEqual([`You accepted ${isolate('Bo')}.`])
      expect(busy(c)).toEqual([])
      // Free again: the next action on that row goes through.
      h.log.length = 0
      setStatus('o1', 'completed')
      await update(c, 'o1', 'completed')
      await c.flush()
      expect(h.log[0]).toBe(WRITE('o1', 'completed'))
    })

    it('a second Unblock on the same row before its outcome shows sends nothing, so the first one\'s outcome is still said', async () => {
      const c = await asAuthor([optIn('o1', 'Bo', 'declined'), optIn('o2', 'Cy')])
      const pressed = el('unblock-optin-o1')
      el(rowAction('o2'))
      // The follow-up's rows read is held: the rpc is back, the row is still on screen.
      const held = deferred()
      h.rowGates.push(held.promise)
      h.optIns = [optIn('o2', 'Cy')]
      const first = unblock(c, 'o1')
      await c.flush()
      expect(rowsOf(c)).toEqual([['o1', 'declined'], ['o2', 'pending']])
      await unblock(c, 'o1')
      gone(pressed)
      held.open()
      await first
      await c.flush()
      expect(h.rpcs.filter((r) => r.fn === 'unblock_opt_in')).toHaveLength(1)
      expect(h.notices).toEqual([`${isolate('Bo')} unblocked. They can request again.`])
    })

    it('two quick actions on different rows: two writes, and both outcomes are said', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      el('accept-optin-o1')
      el('decline-optin-o2')
      el('complete-optin-o1')
      el('unblock-optin-o2')
      const a = update(c, 'o1', 'accepted')
      const b = update(c, 'o2', 'declined')
      h.optIns = [optIn('o1', 'Bo', 'accepted'), optIn('o2', 'Cy', 'declined')]
      await Promise.all([a, b])
      await c.flush()
      expect(h.log.filter((l) => l.startsWith('optins.update'))).toEqual([WRITE('o1', 'accepted'), WRITE('o2', 'declined')])
      expect(h.notices.join(' ')).toContain(`You accepted ${isolate('Bo')}.`)
      expect(h.notices.join(' ')).toContain(`You declined ${isolate('Cy')}.`)
      expect(rowsOf(c)).toEqual([['o1', 'accepted'], ['o2', 'declined']])
      expect(busy(c)).toEqual([])
    })
  })

  describe('the read that follows an action', () => {
    const accept = async (c: Mounted, after: () => void = () => {}) => {
      const pressed = el('accept-optin-o1')
      el('complete-optin-o1')
      el('opt-in-manage-p1')
      el('post-card-p3')
      const sent = update(c, 'o1', 'accepted')
      setStatus('o1', 'accepted')
      gone(pressed)
      after()
      await sent
      await c.flush()
    }

    it('leaves the list alone: same cards in the same order, still ranked, no page read, no event-card write, no loading state', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      const before = cardIds(c.tree())
      const loadingSeen: unknown[] = []
      await accept(c, () => {
        c.rerender()
        loadingSeen.push(one(c.tree(), FeedStatusRegions).props.loading)
      })
      loadingSeen.push(one(c.tree(), FeedStatusRegions).props.loading)
      expect(cardIds(c.tree())).toEqual(before)
      expect(one(c.tree(), FeedHeader).props.rankMode).toBe('ranked')
      expect(h.rpcs.filter((r) => r.fn === 'ranked_feed_v2')).toEqual([])
      expect(h.log.filter((l) => l === 'posts.page' || l.startsWith('posts.in') || l === 'post_likes' || l.startsWith('optins.counts'))).toEqual([])
      expect(h.eventCardWrites).toBe(0)
      expect(loadingSeen).toEqual([false, false])
      expect(one(c.tree(), FeedStatusRegions).props.error).toBe(false)
    })

    it('leaves the page cursor alone: after an action "load more" is still offered and loads the next page from where the list ends', async () => {
      h.rows = twoPages()
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      expect(cardIds(c.tree())).toHaveLength(25)
      await accept(c)
      clearLog()
      await loadMore(c)
      expect(h.rpcs.filter((r) => r.fn === 'ranked_feed_v2').map((r) => r.args.p_cursor_id)).toEqual(['f23'])
      expect(cardIds(c.tree()).slice(-2)).toEqual(['q1', 'q2'])
      expect(cardIds(c.tree())).toHaveLength(27)
    })

    it('asks about the acted post alone, and every other card keeps its rows and its count', async () => {
      h.rows = [...h.rows, row('p5', { max_seekers: 1, slots_remaining: 0 })]
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy'), optIn('o5', 'Di', 'accepted', 'p5')])
      expect(rowsOf(c, 'p5')).toEqual([['o5', 'accepted']])
      await accept(c)
      // The request does not grow with the list: one post, whatever is on screen.
      expect(h.log).toEqual([WRITE('o1', 'accepted'), ...followUp('p1', ['o1', 'o2'])])
      expect(rowsOf(c, 'p5')).toEqual([['o5', 'accepted']])
      expect(card(c, 'p5').props.optInCount).toBe(1)
      expect(rowsOf(c)).toEqual([['o1', 'accepted'], ['o2', 'pending']])
    })

    it('version guard kept: a sign-up does not move the version, and slots_remaining still patches; an older version does not', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      const post = () => card(c, 'p1').props.post as { slotsRemaining: number; content: string; version: number }
      expect([post().slotsRemaining, post().version]).toEqual([2, 3])
      h.rows = h.rows.map((r) => (r.id === 'p1' ? { ...r, slots_remaining: 1 } : r))
      await accept(c)
      expect([post().slotsRemaining, post().version]).toEqual([1, 3])
      // A stale row (an older version) changes nothing.
      h.rows = h.rows.map((r) => (r.id === 'p1' ? { ...r, version: 2, content: 'older text', slots_remaining: 0 } : r))
      setStatus('o1', 'completed')
      el('complete-optin-o1')
      await update(c, 'o1', 'completed')
      await c.flush()
      expect([post().slotsRemaining, post().content]).toEqual([1, 'post p1'])
    })

    describe('gone is not the same as failed', () => {
      it('the post is gone at the re-read: the card leaves as a deleted one does, the outcome is still said, focus goes to the next card; nothing is logged as an error', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        await accept(c, () => {
          h.rows = h.rows.filter((r) => r.id !== 'p1')
        })
        expect(cardIds(c.tree())).toEqual(['p3'])
        expect(h.notices).toEqual([`You accepted ${isolate('Bo')}.`])
        expect(h.focused).toEqual(['post-card-p3'])
        expect(h.logged).toEqual([])
        // The card is gone: there is nothing left to read about it.
        expect(h.log).toEqual([WRITE('o1', 'accepted'), 'posts.one(p1)'])
        c.rerender()
        await c.flush()
        expect(h.notices).toHaveLength(1)
      })

      it('the re-read FAILS: the card stays, an error row is written, and the outcome is still said from the side data', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        h.postReadError = { code: '57014', message: 'canceling statement due to statement timeout' }
        await accept(c)
        expect(cardIds(c.tree())).toEqual(['p1', 'p3'])
        expect(h.logged).toEqual([{ event: 'feed.optin.reread_failed', labels: { step: 'post', action: 'accept', postId: 'p1' } }])
        expect(h.notices).toEqual([`You accepted ${isolate('Bo')}.`])
        expect(h.focused).toEqual(['complete-optin-o1'])
        expect(h.log).toEqual([WRITE('o1', 'accepted'), ...followUp('p1', ['o1', 'o2'])])
      })

      it('a card that leaves after the member has moved to another sub-tab just goes: nothing is said, no focus is moved', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        const panel = h.stable.panel as { panelParams: Record<string, unknown> }
        try {
          await accept(c, () => {
            h.rows = h.rows.filter((r) => r.id !== 'p1')
            // The member opens the Events sub-tab while the write is on its way.
            panel.panelParams = { subtab: 'events' }
            c.rerender()
          })
          expect(h.notices).toEqual([])
          expect(h.focused).toEqual([])
          panel.panelParams = {}
          c.rerender()
          await c.flush()
          expect(cardIds(c.tree())).toEqual(['p3'])
          expect(h.notices).toEqual([])
        } finally {
          panel.panelParams = {}
        }
      })

      it('a follow-up that throws still settles its attempt: the outcome is said with the stale-list sentence and the row is free', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        h.rowsReadThrows = true
        el('accept-optin-o1')
        await update(c, 'o1', 'accepted')
        await c.flush()
        expect(h.logged).toEqual([{ event: 'feed.optin.reread_failed', labels: { step: 'follow_up', action: 'accept' } }])
        expect(h.notices).toEqual([`You accepted ${isolate('Bo')}. ${optInsT('en', 'announceListStale')}`])
        expect(busy(c)).toEqual([])
      })
    })

    describe('the hidden-post rule is the feed\'s own', () => {
      it('the author\'s own post was held meanwhile: the card stays, with its hidden state', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        await accept(c, () => {
          h.rows = h.rows.map((r) => (r.id === 'p1' ? { ...r, is_hidden: true, hidden_reason: 'hold_for_review' } : r))
        })
        expect(cardIds(c.tree())).toEqual(['p1', 'p3'])
        expect((card(c, 'p1').props.post as { isHidden: boolean }).isHidden).toBe(true)
        expect(h.notices).toEqual([`You accepted ${isolate('Bo')}.`])
      })

      it('a viewer who is not the author loses a card whose post is now hidden (a sent review): it leaves, and the review is still said', async () => {
        signIn('cm')
        h.memberStatuses.set('p1', 'completed')
        h.optIns = [{ ...optIn('o7', 'Me', 'completed'), seeker_id: OTHER }]
        const c = await feed()
        el('review-sourcer-p1')
        el('post-card-p3')
        ;(card(c, 'p1').props.onReviewSourcer as (postId: string, optInId: string) => void)('p1', 'o7')
        c.rerender()
        h.log.length = 0
        // Staff can still read the hidden row; the feed does not keep it for them.
        h.rows = h.rows.map((r) => (r.id === 'p1' ? { ...r, is_hidden: true, hidden_reason: 'removed' } : r))
        await (one(c.tree(), ReviewModal).props.onSubmitted as () => Promise<void>)()
        await c.flush()
        expect(cardIds(c.tree())).toEqual(['p3'])
        expect(h.notices).toEqual(['Your review was submitted.'])
        expect(h.focused).toEqual(['post-card-p3'])
        expect(h.log).toEqual(['posts.one(p1)'])
      })
    })

    describe('when the sign-up rows cannot be read again', () => {
      it('an error row is written, the row is set from the action\'s own result, and the outcome is said with a sentence that says the list is not fresh; the count is not touched', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        h.rowsReadError = { code: '57014', message: 'timeout' }
        const pressed = el('accept-optin-o1')
        el('complete-optin-o1')
        const sent = update(c, 'o1', 'accepted')
        gone(pressed)
        await sent
        await c.flush()
        expect(h.logged).toEqual([{ event: 'feed.optin.reread_failed', labels: { step: 'side_data', action: 'accept' } }])
        // Not shown with the status it had before.
        expect(rowsOf(c)).toEqual([['o1', 'accepted'], ['o2', 'pending']])
        // An accept does not change how many signed up: only an unblock lowers the count.
        expect(card(c, 'p1').props.optInCount).toBe(2)
        expect(h.notices).toEqual([`You accepted ${isolate('Bo')}. ${optInsT('en', 'announceListStale')}`])
        expect(h.focused).toEqual(['complete-optin-o1'])
        expect(busy(c)).toEqual([])
        expect(h.log).toEqual([WRITE('o1', 'accepted'), 'posts.one(p1)', 'optins.mine(p1)', 'opt_in_declines', 'optins.rows(p1)'])
      })

      it('unblock: the row is taken out and the count goes down by one', async () => {
        const c = await asAuthor([optIn('o1', 'Bo', 'declined'), optIn('o2', 'Cy')])
        h.rowsReadError = { message: 'timeout' }
        el('unblock-optin-o1').isConnected = false
        el(rowAction('o2'))
        await unblock(c, 'o1')
        await c.flush()
        expect(rowsOf(c)).toEqual([['o2', 'pending']])
        expect(card(c, 'p1').props.optInCount).toBe(1)
        expect(h.notices).toEqual([`${isolate('Bo')} unblocked. They can request again. ${optInsT('en', 'announceListStale')}`])
      })

      it('a sent review: said with the same sentence added (two sentences, each with its full stop)', async () => {
        signIn('author')
        h.optIns = [optIn('o1', 'Bo', 'completed')]
        const c = await feed()
        el('review-seeker-o1')
        el('opt-in-manage-p1')
        ;(card(c, 'p1').props.onAuthorReviewSeeker as (id: string, name: string) => void)('o1', 'Bo')
        c.rerender()
        h.rowsReadError = { message: 'timeout' }
        await (one(c.tree(), ReviewModal).props.onSubmitted as () => Promise<void>)()
        await c.flush()
        expect(h.notices).toEqual([`Your review was submitted. ${optInsT('en', 'announceListStale')}`])
        expect(h.logged).toEqual([{ event: 'feed.optin.reread_failed', labels: { step: 'side_data', action: 'review' } }])
      })
    })

    describe('a read that has been overtaken writes nothing (latest started wins, per post)', () => {
      it('an older sign-up rows read that arrives after a newer one for the same post is dropped; both outcomes are said', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        el('accept-optin-o1')
        el('decline-optin-o2')
        el('complete-optin-o1')
        el('unblock-optin-o2')
        // The first follow-up's rows read is held; it read the rows before the second write.
        const held = deferred()
        h.rowGates.push(held.promise)
        h.optIns = [optIn('o1', 'Bo', 'accepted'), optIn('o2', 'Cy')]
        const first = update(c, 'o1', 'accepted')
        await c.flush()
        expect(h.log.filter((l) => l.startsWith('optins.rows'))).toHaveLength(1)
        // The second action, whole: its rows read (not held) lands with both rows as they are now.
        h.optIns = [optIn('o1', 'Bo', 'accepted'), optIn('o2', 'Cy', 'declined')]
        await update(c, 'o2', 'declined')
        await c.flush()
        expect(rowsOf(c)).toEqual([['o1', 'accepted'], ['o2', 'declined']])
        // Now the older response arrives, saying Cy is still pending. It must not be written.
        held.open()
        await first
        await c.flush()
        expect(rowsOf(c)).toEqual([['o1', 'accepted'], ['o2', 'declined']])
        expect(h.notices.join(' ')).toContain(`You accepted ${isolate('Bo')}.`)
        expect(h.notices.join(' ')).toContain(`You declined ${isolate('Cy')}.`)
        expect(busy(c)).toEqual([])
      })

      it('an older read of the POST that arrives after a newer one is dropped (slots_remaining does not go back)', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        const slots = () => (card(c, 'p1').props.post as { slotsRemaining: number }).slotsRemaining
        el('accept-optin-o1')
        el('decline-optin-o2')
        const held = deferred()
        h.postGates.push(held.promise)
        // The first post read is sent while the post says 1 slot, and is held.
        h.rows = h.rows.map((r) => (r.id === 'p1' ? { ...r, slots_remaining: 1 } : r))
        setStatus('o1', 'accepted')
        const first = update(c, 'o1', 'accepted')
        await c.flush()
        // The second action's post read is sent later, and lands: 0 slots.
        h.rows = h.rows.map((r) => (r.id === 'p1' ? { ...r, slots_remaining: 0 } : r))
        setStatus('o2', 'declined')
        await update(c, 'o2', 'declined')
        await c.flush()
        expect(slots()).toBe(0)
        held.open()
        await first
        await c.flush()
        expect(slots()).toBe(0)
        expect(rowsOf(c)).toEqual([['o1', 'accepted'], ['o2', 'declined']])
      })

      it('an action that began under another account is not followed up: no post read, no side-data set, nothing said for the account that is here now', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        el('accept-optin-o1')
        el('complete-optin-o1')
        const sent = update(c, 'o1', 'accepted')
        h.log.length = 0
        // The account changes while the write is on its way.
        signIn('member')
        c.rerender()
        await sent
        await c.flush()
        // The new account loads its own feed (one ranked page, one side-data set); the old
        // account's write lands, and nothing follows it.
        expect(h.log.filter((l) => l === 'rpc:ranked_feed_v2')).toHaveLength(1)
        expect(h.log.filter((l) => l.startsWith('posts.one'))).toEqual([])
        expect(h.log.filter((l) => l.startsWith('optins.rows'))).toHaveLength(1)
        expect(h.log.filter((l) => l.startsWith('optins.mine'))).toHaveLength(1)
        expect(h.notices).toEqual([])
        expect(h.focused).toEqual([])
        expect(busy(c)).toEqual([])
      })

      it('a POST read that comes back to another account is dropped: the old account\'s stale row is not patched over what the new account loaded', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        const slots = () => (card(c, 'p1').props.post as { slotsRemaining: number }).slotsRemaining
        el('accept-optin-o1')
        const held = deferred()
        h.postGates.push(held.promise)
        h.rows = h.rows.map((r) => (r.id === 'p1' ? { ...r, slots_remaining: 1 } : r))
        setStatus('o1', 'accepted')
        const sent = update(c, 'o1', 'accepted')
        await c.flush()
        // Another account signs in and loads the feed: the post now says 0 slots.
        h.rows = h.rows.map((r) => (r.id === 'p1' ? { ...r, slots_remaining: 0 } : r))
        signIn('member')
        c.rerender()
        await c.flush(12)
        expect(slots()).toBe(0)
        held.open()
        await sent
        await c.flush()
        expect(slots()).toBe(0)
        expect(h.notices).toEqual([])
      })

      it('a sign-up rows read that comes back to another account is dropped: the old account\'s rows are not written over the new one\'s', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        el('accept-optin-o1')
        el('complete-optin-o1')
        const held = deferred()
        h.rowGates.push(held.promise)
        h.optIns = [optIn('o1', 'Bo', 'accepted'), optIn('o2', 'Cy')]
        const sent = update(c, 'o1', 'accepted')
        await c.flush()
        expect(h.log.filter((l) => l.startsWith('optins.rows'))).toHaveLength(1)
        // The account changes while that read is on its way; the new account sees no rows.
        h.optIns = []
        signIn('member')
        c.rerender()
        await c.flush(12)
        expect(rowsOf(c)).toEqual([])
        h.notices.length = 0
        held.open()
        await sent
        await c.flush()
        expect(rowsOf(c)).toEqual([])
        expect(h.notices).toEqual([])
        expect(h.focused).toEqual([])
      })

      it('an action the old account had under way is not settled into the new account\'s list when the new account\'s rows read fails', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        el('accept-optin-o1')
        // The old account's write is confirmed; the read that follows it is held.
        const held = deferred()
        h.postGates.push(held.promise)
        setStatus('o1', 'accepted')
        const sent = update(c, 'o1', 'accepted')
        await c.flush()
        // Another account signs in; its own rows read fails.
        h.rowsReadError = { message: 'timeout' }
        signIn('member')
        c.rerender()
        await c.flush(12)
        // Nothing of the old account's action is written as a "settled" row for the new one.
        expect(rowsOf(c).find(([id]) => id === 'o1')?.[1]).not.toBe('accepted')
        expect(h.notices).toEqual([])
        held.open()
        await sent
        await c.flush()
        expect(h.notices).toEqual([])
      })

      describe('the other side data of a read: my statuses, my reviews, the decline markers', () => {
        it('my statuses: a refresh that started before my opt-in and arrives after it does not take the status away', async () => {
          const c = await feed()
          el('opt-in-btn-p1')
          el('withdraw-btn-p1')
          // A refresh starts; its statuses read is held (it saw no opt-in).
          const held = deferred()
          h.statusGates.push(held.promise)
          ;(one(c.tree(), FeedHeader).props.onRankModeChange as (m: string) => void)('recent')
          await c.flush(12)
          // The member opts in; the read that follows starts later, and lands.
          const sent = (card(c, 'p1').props.onOptIn as (id: string) => Promise<void>)('p1')
          h.memberStatuses.set('p1', 'pending')
          await sent
          await c.flush()
          expect(card(c, 'p1').props.optInStatus).toBe('pending')
          // The older response arrives: the post it was overtaken on keeps its status.
          held.open()
          await c.flush()
          expect(card(c, 'p1').props.optInStatus).toBe('pending')
        })

        it('my statuses: a read that comes back to another account is dropped', async () => {
          h.memberStatuses.set('p1', 'pending')
          const held = deferred()
          h.statusGates.push(held.promise)
          const c = await feed()
          // The first account's statuses read is still on its way when another account signs in.
          h.memberStatuses = new Map()
          signIn('cm')
          c.rerender()
          await c.flush(12)
          expect(card(c, 'p1').props.optInStatus).toBeUndefined()
          held.open()
          await c.flush()
          expect(card(c, 'p1').props.optInStatus).toBeUndefined()
        })

        it('my reviews: a read that comes back to another account is dropped', async () => {
          signIn('author')
          h.optIns = [optIn('o1', 'Bo', 'completed')]
          h.myReviews = new Map([['o1', { opt_in_id: 'o1' } as Row]])
          const held = deferred()
          h.reviewGates.push(held.promise)
          const c = await feed()
          h.myReviews = new Map()
          signIn('cm')
          c.rerender()
          await c.flush(12)
          held.open()
          await c.flush()
          expect([...(card(c, 'p1').props.authorReviewedOptInIds as Set<string>)]).toEqual([])
        })

        it('my reviews: a page that is added, and the read after an action, add to the set; they never empty it', async () => {
          signIn('author')
          h.rows = twoPages()
          h.optIns = [optIn('o1', 'Bo', 'completed'), optIn('o5', 'Di', 'completed', 'q1')]
          h.myReviews = new Map([['o1', { opt_in_id: 'o1' } as Row], ['o5', { opt_in_id: 'o5' } as Row]])
          const c = await feed()
          expect([...(card(c, 'p1').props.authorReviewedOptInIds as Set<string>)]).toEqual(['o1'])
          await loadMore(c)
          expect([...(card(c, 'p1').props.authorReviewedOptInIds as Set<string>)].sort()).toEqual(['o1', 'o5'])
        })

        it('decline markers: of two reads, the one started later is the one that writes', async () => {
          signIn('author')
          h.optIns = [optIn('o1', 'Bo')]
          h.declines = []
          const c = await feed()
          el('decline-optin-o1')
          // A refresh starts; its markers read is held (it saw none).
          const held = deferred()
          h.declineGates.push(held.promise)
          ;(one(c.tree(), FeedHeader).props.onRankModeChange as (m: string) => void)('recent')
          await c.flush(12)
          // The author declines Bo; the read that follows starts later and sees the marker.
          h.declines = [{ seeker_id: 's-o1' }]
          setStatus('o1', 'declined')
          await update(c, 'o1', 'declined')
          await c.flush()
          expect([...(card(c, 'p1').props.authorDeclinedSeekerIds as Set<string>)]).toEqual(['s-o1'])
          held.open()
          await c.flush()
          expect([...(card(c, 'p1').props.authorDeclinedSeekerIds as Set<string>)]).toEqual(['s-o1'])
        })

        it('decline markers: a read that comes back to another account is dropped', async () => {
          signIn('author')
          h.optIns = [optIn('o1', 'Bo')]
          h.declines = [{ seeker_id: 's-o1' }]
          const held = deferred()
          h.declineGates.push(held.promise)
          const c = await feed()
          // Another account signs in while the first account's markers are on their way.
          h.declines = []
          signIn('cm')
          c.rerender()
          await c.flush(12)
          held.open()
          await c.flush()
          expect([...(card(c, 'p1').props.authorDeclinedSeekerIds as Set<string>)]).toEqual([])
        })
      })
    })
  })

  describe('"load more" keeps the sign-up data of earlier pages', () => {
    const authorRows = () => [optIn('o1', 'Bo'), optIn('o2', 'Cy'), optIn('o5', 'Di', 'pending', 'q1')]
    const asAuthorOfTwoPages = async () => {
      h.rows = twoPages()
      const c = await asAuthor(authorRows())
      return c
    }

    it('K6-03 · an author\'s first-page card still shows its count and its rows after the second page has loaded; the page read asks about its own posts only', async () => {
      const c = await asAuthorOfTwoPages()
      expect([card(c, 'p1').props.optInCount, rowsOf(c)]).toEqual([2, [['o1', 'pending'], ['o2', 'pending']]])
      await loadMore(c)
      expect(cardIds(c.tree())).toHaveLength(27)
      // The page that was added: its own posts, in every read of its side data.
      expect(h.log).toEqual(['rpc:ranked_feed_v2', `posts.in(${PAGE_TWO})`, 'post_likes', `optins.counts(${PAGE_TWO})`, `optins.mine(${PAGE_TWO})`, 'opt_in_declines', `optins.rows(${PAGE_TWO})`, 'reviews.mine(o5)'])
      // The first page's card is as it was.
      expect([card(c, 'p1').props.optInCount, rowsOf(c)]).toEqual([2, [['o1', 'pending'], ['o2', 'pending']]])
      // The new page's card has its own.
      expect([card(c, 'q1').props.optInCount, rowsOf(c, 'q1')]).toEqual([1, [['o5', 'pending']]])
    })

    it('a member\'s first-page card they opted in to still shows their status, their opt-in and their review after the second page has loaded', async () => {
      h.rows = twoPages()
      h.memberStatuses = new Map([['p1', 'completed'], ['q1', 'accepted']])
      h.optIns = [{ ...optIn('o8', 'Me', 'completed', 'p1'), seeker_id: OTHER }, { ...optIn('o9', 'Me', 'accepted', 'q1'), seeker_id: OTHER }]
      h.myReviews = new Map([['o8', { opt_in_id: 'o8' } as Row]])
      const c = await feed()
      const mine = () => [card(c, 'p1').props.optInStatus, card(c, 'p1').props.currentUserOptInId, card(c, 'p1').props.seekerHasReviewed]
      expect(mine()).toEqual(['completed', 'o8', true])
      await loadMore(c)
      expect(mine()).toEqual(['completed', 'o8', true])
      expect([card(c, 'q1').props.optInStatus, card(c, 'q1').props.currentUserOptInId]).toEqual(['accepted', 'o9'])
    })

    it('the same in the chronological feed: a page that is added there merges too', async () => {
      const c = await asAuthorOfTwoPages()
      ;(one(c.tree(), FeedHeader).props.onRankModeChange as (m: string) => void)('recent')
      await c.flush(12)
      expect(cardIds(c.tree())).toHaveLength(25)
      expect([card(c, 'p1').props.optInCount, rowsOf(c)]).toEqual([2, [['o1', 'pending'], ['o2', 'pending']]])
      clearLog()
      await loadMore(c)
      expect(cardIds(c.tree())).toHaveLength(27)
      expect(h.log).toEqual(['posts.page', 'post_likes', `optins.counts(${PAGE_TWO})`, `optins.mine(${PAGE_TWO})`, 'opt_in_declines', `optins.rows(${PAGE_TWO})`, 'reviews.mine(o5)'])
      expect([card(c, 'p1').props.optInCount, rowsOf(c)]).toEqual([2, [['o1', 'pending'], ['o2', 'pending']]])
      expect([card(c, 'q1').props.optInCount, rowsOf(c, 'q1')]).toEqual([1, [['o5', 'pending']]])
    })

    it('an action on a second-page post leaves the first page\'s entries intact; its follow-up asks about that post alone', async () => {
      const c = await asAuthorOfTwoPages()
      await loadMore(c)
      clearLog()
      el('accept-optin-o5')
      el('complete-optin-o5')
      setStatus('o5', 'accepted')
      await update(c, 'o5', 'accepted', 'q1')
      await c.flush()
      expect(h.log).toEqual([WRITE('o5', 'accepted'), ...followUp('q1', ['o5'])])
      expect(rowsOf(c, 'q1')).toEqual([['o5', 'accepted']])
      expect([card(c, 'p1').props.optInCount, rowsOf(c)]).toEqual([2, [['o1', 'pending'], ['o2', 'pending']]])
      expect(h.notices).toEqual([`You accepted ${isolate('Di')}.`])
    })

    it('a first page, or a refresh, replaces: entries of the list that was there before do not linger', async () => {
      const c = await asAuthorOfTwoPages()
      await loadMore(c)
      // Everyone withdrew; the author switches the order (a first page again).
      h.optIns = []
      ;(one(c.tree(), FeedHeader).props.onRankModeChange as (m: string) => void)('recent')
      await c.flush(12)
      expect(cardIds(c.tree())).toHaveLength(25)
      expect([card(c, 'p1').props.optInCount ?? 0, rowsOf(c)]).toEqual([0, []])
      // The second page comes back with what it has now, not with what the old list held for it.
      await loadMore(c)
      expect([card(c, 'q1').props.optInCount ?? 0, rowsOf(c, 'q1')]).toEqual([0, []])
    })

    it('a card that leaves the list drops its entries: when the post comes back it does not show what it had', async () => {
      const c = await asAuthorOfTwoPages()
      h.realtime!.onUpdate({ id: 'p1', user_id: AUTHOR, version: 3, is_hidden: false, deleted_at: '2026-10-02T00:00:00.000Z' })
      await c.flush()
      expect(cardIds(c.tree())).not.toContain('p1')
      h.realtime!.onInsert({ id: 'p1' })
      await c.flush()
      expect(cardIds(c.tree())).toContain('p1')
      expect([card(c, 'p1').props.optInCount ?? 0, rowsOf(c)]).toEqual([0, []])
    })

    describe('a failed read of my statuses keeps what is on screen', () => {
      it('K9-02 · on a page that is added: the first page\'s status stays', async () => {
        h.rows = twoPages()
        h.memberStatuses = new Map([['p1', 'pending']])
        const c = await feed()
        h.statusReadFails = true
        await loadMore(c)
        expect(card(c, 'p1').props.optInStatus).toBe('pending')
      })

      it('after an opt-in: the status is set from the opt-in itself, and it is said with the stale-list sentence; other posts keep theirs', async () => {
        h.memberStatuses = new Map([['p3', 'accepted']])
        const c = await feed()
        const pressed = el('opt-in-btn-p1')
        el('withdraw-btn-p1')
        h.statusReadFails = true
        h.log.length = 0
        const sent = (card(c, 'p1').props.onOptIn as (id: string) => Promise<void>)('p1')
        gone(pressed)
        await sent
        await c.flush()
        // The read that follows a member's own action asks about that post alone.
        expect(h.log).toEqual(['optins.mine(p1)'])
        expect(card(c, 'p1').props.optInStatus).toBe('pending')
        expect(card(c, 'p3').props.optInStatus).toBe('accepted')
        expect(h.notices).toEqual([`${optInsT('en', 'announceOptedIn')} ${optInsT('en', 'announceListStale')}`])
        expect(h.focused).toEqual(['withdraw-btn-p1'])
      })

      it('after a withdraw that went through: the status is taken off, and it is said with the stale-list sentence', async () => {
        h.memberStatuses = new Map([['p1', 'pending'], ['p3', 'accepted']])
        const c = await feed()
        el('withdraw-btn-p1').isConnected = false
        el('opt-in-btn-p1')
        h.statusReadFails = true
        await (card(c, 'p1').props.onWithdraw as (id: string) => Promise<void>)('p1')
        await c.flush()
        expect(card(c, 'p1').props.optInStatus).toBeUndefined()
        expect(card(c, 'p3').props.optInStatus).toBe('accepted')
        expect(h.notices).toEqual([`${optInsT('en', 'announceWithdrawn')} ${optInsT('en', 'announceListStale')}`])
      })

      it('after a withdraw that changed nothing: nothing is settled from it; the card keeps its status and shows the failure', async () => {
        h.memberStatuses = new Map([['p1', 'pending']])
        const c = await feed()
        el('withdraw-btn-p1')
        optInSpies().withdrawOptIn.mockReset().mockResolvedValue(false)
        h.statusReadFails = true
        await (card(c, 'p1').props.onWithdraw as (id: string) => Promise<void>)('p1')
        await c.flush()
        expect(card(c, 'p1').props.optInStatus).toBe('pending')
        expect(cardError(c)).toBe(SIGN_UP_NOT_DONE)
        expect(h.notices).toEqual([optInsT('en', 'announceListStale')])
      })
    })

    describe('a page load and the read after an action ask about the same post: the one started latest writes it', () => {
      it('the action\'s read started first and arrives last: the refresh that started after it keeps its rows, and settles the action (said once)', async () => {
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        el('accept-optin-o1')
        el('complete-optin-o1')
        // The follow-up's rows read is held. It read: Bo accepted, Cy pending.
        const held = deferred()
        h.rowGates.push(held.promise)
        setStatus('o1', 'accepted')
        const sent = update(c, 'o1', 'accepted')
        await c.flush()
        expect(h.notices).toEqual([])
        // A refresh starts after it and lands first. By then Cy has withdrawn.
        h.optIns = [optIn('o1', 'Bo', 'accepted')]
        ;(one(c.tree(), FeedHeader).props.onRankModeChange as (m: string) => void)('recent')
        await c.flush(12)
        expect(rowsOf(c)).toEqual([['o1', 'accepted']])
        // The refresh settled the action it covers.
        expect(h.notices).toEqual([`You accepted ${isolate('Bo')}.`])
        // The older response arrives: not written, and nothing is said again.
        held.open()
        await sent
        await c.flush()
        expect(rowsOf(c)).toEqual([['o1', 'accepted']])
        expect(h.notices).toHaveLength(1)
        expect(busy(c)).toEqual([])
      })

      it('the page load started first and arrives last: it writes the posts it still owns, not the one an action has read since', async () => {
        h.rows = [...h.rows, row('p5', { max_seekers: 1, slots_remaining: 1 })]
        const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
        el('accept-optin-o1')
        el('complete-optin-o1')
        // A refresh starts; its rows read is held. It read: Bo pending, and nobody on p5.
        const held = deferred()
        h.rowGates.push(held.promise)
        ;(one(c.tree(), FeedHeader).props.onRankModeChange as (m: string) => void)('recent')
        await c.flush(12)
        // Meanwhile someone signs up on p5, and the author accepts Bo; that read lands.
        h.optIns = [optIn('o1', 'Bo', 'accepted'), optIn('o2', 'Cy'), optIn('o6', 'Ed', 'pending', 'p5')]
        await update(c, 'o1', 'accepted')
        await c.flush()
        expect(rowsOf(c)).toEqual([['o1', 'accepted'], ['o2', 'pending']])
        // The refresh's older response arrives: p1 is not its to write; p5 is (as it read it).
        held.open()
        await c.flush()
        expect(rowsOf(c)).toEqual([['o1', 'accepted'], ['o2', 'pending']])
        expect(rowsOf(c, 'p5')).toEqual([])
        expect(h.notices).toEqual([`You accepted ${isolate('Bo')}.`])
      })

      it('a page that is added does not ask about the acted post, so it neither overtakes nor settles the action', async () => {
        h.rows = twoPages()
        const c = await asAuthor(authorRows())
        el('accept-optin-o1')
        el('complete-optin-o1')
        const held = deferred()
        h.rowGates.push(held.promise)
        setStatus('o1', 'accepted')
        const sent = update(c, 'o1', 'accepted')
        await c.flush()
        await loadMore(c)
        expect(h.notices).toEqual([])
        expect(rowsOf(c, 'q1')).toEqual([['o5', 'pending']])
        held.open()
        await sent
        await c.flush()
        expect(rowsOf(c)).toEqual([['o1', 'accepted'], ['o2', 'pending']])
        expect(h.notices).toEqual([`You accepted ${isolate('Bo')}.`])
      })
    })
  })

  describe('the review dialog', () => {
    const openFromList = async () => {
      signIn('author')
      h.optIns = [optIn('o1', 'Bo', 'completed')]
      const c = await feed()
      const opener = el('review-seeker-o1')
      ;(card(c, 'p1').props.onAuthorReviewSeeker as (id: string, name: string) => void)('o1', 'Bo')
      c.rerender()
      return { c, opener, modal: () => one(c.tree(), ReviewModal) }
    }

    it('gets the button that opened it (focus returns there when it closes unsent) and the role as a code', async () => {
      const { opener, modal } = await openFromList()
      expect((modal().props.returnFocusRef as { current: unknown }).current).toBe(opener)
      expect(modal().props).toMatchObject({ optInId: 'o1', revieweeName: 'Bo', revieweeRole: 'seeker' })
    })

    it('when that button is gone, focus goes to the sign-up list toggle of that post; with no toggle, to the post card', async () => {
      const { modal } = await openFromList()
      el('opt-in-manage-p1')
      el('post-card-p1')
      ;(modal().props.fallbackFocus as () => void)()
      expect(h.focused).toEqual(['opt-in-manage-p1'])
      h.elements.delete('opt-in-manage-p1')
      ;(modal().props.fallbackFocus as () => void)()
      expect(h.focused).toEqual(['opt-in-manage-p1', 'post-card-p1'])
    })

    it('a sent review: one post read and one side-data set for that post, the list left as it is; then "Your review was submitted.", once', async () => {
      const { c, modal } = await openFromList()
      el('opt-in-manage-p1')
      const before = cardIds(c.tree())
      h.log.length = 0
      h.eventCardWrites = 0
      const done = (modal().props.onSubmitted as () => Promise<void>)()
      c.rerender()
      expect(cardIds(c.tree())).toEqual(before)
      await done
      await c.flush()
      expect(h.log).toEqual(followUp('p1', ['o1']))
      expect(cardIds(c.tree())).toEqual(before)
      expect(h.eventCardWrites).toBe(0)
      expect(h.focused).toEqual(['opt-in-manage-p1'])
      expect(h.notices).toEqual(['Your review was submitted.'])
      c.rerender()
      await c.flush()
      expect(h.log).toHaveLength(5)
      expect(h.notices).toHaveLength(1)
    })

    it('a member who has moved on while the follow-up ran is not pulled back: the review is said, focus is left where they put it', async () => {
      const { c, modal } = await openFromList()
      el('opt-in-manage-p1')
      const done = (modal().props.onSubmitted as () => Promise<void>)()
      // They tabbed to another control on the page.
      doc().activeElement = { isConnected: true }
      await done
      await c.flush()
      expect(h.notices).toEqual(['Your review was submitted.'])
      expect(h.focused).toEqual([])
    })

    it('a member who has left the sub-tab hears nothing about the review there', async () => {
      const { c, modal } = await openFromList()
      const panel = h.stable.panel as { panelParams: Record<string, unknown> }
      try {
        const done = (modal().props.onSubmitted as () => Promise<void>)()
        panel.panelParams = { subtab: 'events' }
        c.rerender()
        await done
        await c.flush()
        expect(h.notices).toEqual([])
        expect(h.focused).toEqual([])
      } finally {
        panel.panelParams = {}
      }
    })

    it('opened from "Review sourcer": the opener is that button, and the stable control is the post card', async () => {
      h.memberStatuses.set('p1', 'completed')
      h.optIns = [{ ...optIn('o7', 'Me', 'completed'), seeker_id: OTHER }]
      const c = await feed()
      const opener = el('review-sourcer-p1')
      el('post-card-p1')
      ;(card(c, 'p1').props.onReviewSourcer as (postId: string, optInId: string) => void)('p1', 'o7')
      c.rerender()
      const modal = one(c.tree(), ReviewModal)
      expect((modal.props.returnFocusRef as { current: unknown }).current).toBe(opener)
      expect(modal.props.revieweeRole).toBe('sourcer')
      ;(modal.props.fallbackFocus as () => void)()
      expect(h.focused).toEqual(['post-card-p1'])
    })

    it('a sent review on a post that is gone at the re-read: the card leaves, and the review is said as it goes', async () => {
      h.memberStatuses.set('p1', 'completed')
      h.optIns = [{ ...optIn('o7', 'Me', 'completed'), seeker_id: OTHER }]
      const c = await feed()
      el('review-sourcer-p1')
      el('post-card-p3')
      ;(card(c, 'p1').props.onReviewSourcer as (postId: string, optInId: string) => void)('p1', 'o7')
      c.rerender()
      h.rows = h.rows.filter((r) => r.id !== 'p1')
      await (one(c.tree(), ReviewModal).props.onSubmitted as () => Promise<void>)()
      await c.flush()
      expect(cardIds(c.tree())).toEqual(['p3'])
      expect(h.notices).toEqual(['Your review was submitted.'])
      expect(h.focused).toEqual(['post-card-p3'])
      expect(h.logged).toEqual([])
    })
  })
})
