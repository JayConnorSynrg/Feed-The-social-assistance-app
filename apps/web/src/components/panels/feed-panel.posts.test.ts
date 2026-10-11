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
  // Sign-up rows reads take the next gate (if any) and answer, with what they read when they were
  // sent, only once it opens: lets a test make an older read arrive after a newer one.
  rowGates: [] as Array<Promise<void>>,
  // Error-level log rows: event name and labels.
  logged: [] as Array<{ event: string; labels: unknown }>,
  eventCardWrites: 0,
}))
const once = <T,>(k: string, make: () => T): T => (h.stable[k] ??= make()) as T

vi.mock('motion/react', () => {
  const pass = (p: { children?: unknown }) => p.children
  return { LazyMotion: pass, AnimatePresence: pass, domAnimation: {}, useReducedMotion: () => false, m: new Proxy({}, { get: () => 'div' }) }
})
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: (event: string, _err: unknown, labels: unknown) => void h.logged.push({ event, labels }) },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
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
      fetchOptInsForPosts: async (ids: string[]) => {
        h.log.push(`optins.mine(${ids.join(',')})`)
        return new Map(h.memberStatuses)
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
        return new Map()
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
    announceCardNotice: (text: string, moveFocus?: () => void) => {
      moveFocus?.()
      h.notices.push(text)
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
          if (upd) return `optins.update(${String(arg('eq', 'id'))}=${(upd.a[0] as { status: string }).status})`
          const ids = ((arg('in', 'post_id') as string[] | undefined) ?? []).join(',')
          return fullRows() ? `optins.rows(${ids})` : `optins.counts(${ids})`
        }
        return table
      }
      const result = () => {
        if (table === 'resource_opt_ins') {
          if (calls.some((c) => c.m === 'update')) return { data: null, error: h.writeError }
          const full = fullRows()
          if (full && h.rowsReadError) return { data: null, error: h.rowsReadError }
          const posts = arg('in', 'post_id') as string[] | undefined
          const rows = h.optIns.filter((o) => !posts || posts.includes(o.post_id as string))
          return { data: full ? rows : rows.map((o) => ({ post_id: o.post_id })), error: null }
        }
        if (table !== 'posts') return { data: [], error: null }
        const idEq = calls.find((c) => c.m === 'eq' && c.a[0] === 'id')?.a[1]
        const idIn = calls.find((c) => c.m === 'in' && c.a[0] === 'id')?.a[1] as string[] | undefined
        let data = h.rows
        if (idEq !== undefined) data = data.filter((r) => r.id === idEq)
        if (idIn) data = data.filter((r) => idIn.includes(r.id as string))
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
                const gate = table === 'resource_opt_ins' && fullRows() ? h.rowGates.shift() : undefined
                return (gate ?? Promise.resolve()).then(() => r).then(res, rej)
              }
            if (prop === 'maybeSingle' || prop === 'single')
              return () => {
                h.log.push(describeCall(true))
                if (table === 'posts' && h.postReadError) return Promise.resolve({ data: null, error: h.postReadError })
                const r = result()
                return Promise.resolve({ data: (r.data as Row[])[0] ?? null, error: null })
              }
            return (...a: unknown[]) => {
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
      const reply = fn === 'ranked_feed_v2' ? { data: h.rows.map((r, i) => ({ id: r.id, kind: 'post', score: 10 - i, distance_bucket: 'unknown' })), error: null } : h.rpcReply(fn)
      const chain: Record<string, unknown> = {
        abortSignal: () => chain,
        setHeader: () => chain,
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
import { FeedHeader, FeedStatusRegions } from '@/components/feed/feed-chrome'
import { ReviewModal } from '@/components/feed/review-modal'
import { isolate } from '@/lib/format-message'
import { optInsT } from '@/lib/i18n-feed-optins'

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
  h.logged.length = 0
  h.eventCardWrites = 0
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
    doc().body = {}
    doc().activeElement = doc().body
  })

  describe('the member', () => {
    it('Opt In: one request; then "You are opted in." and focus on Withdraw, which took the button\'s place', async () => {
      const c = await feed()
      optInSpies().optIn.mockClear()
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
      expect(optInSpies().optIn).toHaveBeenCalledWith('p1')
      expect(optInSpies().withdrawOptIn).not.toHaveBeenCalled()
      expect(card(c, 'p1').props.optInStatus).toBe('pending')
      expect(h.focused).toEqual(['withdraw-btn-p1'])
      expect(h.notices).toEqual([optInsT('en', 'announceOptedIn')])
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
      const sent = (card(c, 'p1').props.onWithdraw as (id: string) => Promise<void>)('p1')
      h.memberStatuses.delete('p1')
      gone(pressed)
      await sent
      await c.flush()
      expect(optInSpies().withdrawOptIn).toHaveBeenCalledTimes(1)
      expect(optInSpies().withdrawOptIn).toHaveBeenCalledWith('p1')
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
  const POSTS = 'p1,p3'
  /** The one follow-up: a single read of the acted post, then ONE side-data set for every post
   *  on screen (my statuses, decline markers, the sign-up rows, and — when there are rows — my
   *  reviews for them). */
  const followUp = (postId: string, rowIds: string[], posts = POSTS) => [
    `posts.one(${postId})`,
    `optins.mine(${posts})`,
    'opt_in_declines',
    `optins.rows(${posts})`,
    ...(rowIds.length > 0 ? [`reviews.mine(${rowIds.join(',')})`] : []),
  ]
  const asAuthor = async (rows: Row[]) => {
    signIn('author')
    h.optIns = rows
    const c = await feed()
    h.reads.length = 0
    h.rpcs.length = 0
    h.log.length = 0
    h.eventCardWrites = 0
    return c
  }
  type Mounted = { tree: () => unknown; rerender: () => unknown; flush: (n?: number) => Promise<unknown> }
  const update = (c: Mounted, id: string, status: string, post = 'p1') => (card(c, post).props.onAuthorUpdateOptIn as (id: string, s: string) => Promise<void>)(id, status)
  const unblock = (c: Mounted, id: string) => (card(c, 'p1').props.onAuthorUnblockOptIn as (id: string) => Promise<void>)(id)
  const rowsOf = (c: Mounted, post = 'p1') => ((card(c, post).props.authorOptIns as Array<{ id: string; status: string }> | undefined) ?? []).map((o) => [o.id, o.status])
  const busy = (c: Mounted) => [...((card(c, 'p1').props.busyOptInIds as ReadonlySet<string> | undefined) ?? [])]

  describe('the author', () => {
    it('the card gets the rows of its sign-up list', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      expect((card(c, 'p1').props.authorOptIns as Array<{ id: string; seekerName: string }>).map((o) => [o.id, o.seekerName])).toEqual([['o1', 'Bo'], ['o2', 'Cy']])
    })

    it('Accept: one write, one post read, one side-data set; then "You accepted …" and focus on that row\'s Mark Completed', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      const before = cardIds(c.tree())
      const pressed = el('accept-optin-o1')
      el('complete-optin-o1')
      const sent = update(c, 'o1', 'accepted')
      h.optIns = [optIn('o1', 'Bo', 'accepted'), optIn('o2', 'Cy')]
      gone(pressed)
      c.rerender()
      expect(cardIds(c.tree())).toEqual(before)
      await sent
      await c.flush()
      expect(h.log).toEqual(['optins.update(o1=accepted)', ...followUp('p1', ['o1', 'o2'])])
      expect(rowsOf(c)).toEqual([['o1', 'accepted'], ['o2', 'pending']])
      expect(h.focused).toEqual(['complete-optin-o1'])
      expect(h.notices).toEqual([`You accepted ${isolate('Bo')}.`])
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
      h.optIns = [optIn('o1', 'Bo', 'declined'), optIn('o2', 'Cy')]
      gone(pressed)
      await sent
      await c.flush()
      expect(h.log).toEqual(['optins.update(o1=declined)', ...followUp('p1', ['o1', 'o2'])])
      expect(h.focused).toEqual(['unblock-optin-o1'])
      expect(h.notices).toEqual([`You declined ${isolate('Bo')}.`])
    })

    it('Decline when that row ends up with no control: focus goes to the sign-up list toggle', async () => {
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy')])
      const pressed = el('decline-optin-o2')
      el(rowAction('o1'))
      el('opt-in-manage-p1')
      const sent = update(c, 'o2', 'declined')
      h.optIns = [optIn('o1', 'Bo'), optIn('o2', 'Cy', 'declined')]
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
      h.optIns = [optIn('o1', 'Bo', 'completed')]
      gone(pressed)
      await sent
      await c.flush()
      expect(h.log).toEqual(['optins.update(o1=completed)', ...followUp('p1', ['o1'])])
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

    it.each(['accepted', 'declined', 'completed'] as const)('a failed %s: said in the same region; the write and nothing after it; focus stays; the row is free again', async (status) => {
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
      expect(h.log).toEqual([`optins.update(o1=${status})`])
      expect(h.notices).toEqual([cardT('en', 'statusModerationFailed')])
      expect(h.focused).toEqual([])
      expect(busy(c)).toEqual([])
    })

    it('a failed unblock is said too, and sends nothing else', async () => {
      const c = await asAuthor([optIn('o1', 'Bo', 'declined')])
      h.rpcReply = (fn) => (fn === 'unblock_opt_in' ? { data: null, error: { message: 'Only a declined opt-in can be unblocked' } } : { data: null, error: null })
      el('unblock-optin-o1')
      await unblock(c, 'o1')
      await c.flush()
      expect(h.log).toEqual(['rpc:unblock_opt_in'])
      expect(h.notices).toEqual([cardT('en', 'statusModerationFailed')])
      expect(h.focused).toEqual([])
      expect(busy(c)).toEqual([])
    })

    it('a name that reads like a status or a sentence is said as written, isolated', async () => {
      const c = await asAuthor([optIn('o1', 'accepted')])
      const pressed = el('accept-optin-o1')
      el('complete-optin-o1')
      const sent = update(c, 'o1', 'accepted')
      h.optIns = [optIn('o1', 'accepted', 'accepted')]
      gone(pressed)
      await sent
      await c.flush()
      expect(h.notices).toEqual([`You accepted ${isolate('accepted')}.`])
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
      h.optIns = [optIn('o1', 'Bo', 'accepted'), optIn('o2', 'Cy')]
      await Promise.all([first, second, third])
      await c.flush()
      expect(h.log.filter((l) => l.startsWith('optins.update'))).toEqual(['optins.update(o1=accepted)'])
      expect(h.log).toEqual(['optins.update(o1=accepted)', ...followUp('p1', ['o1', 'o2'])])
      expect(h.notices).toEqual([`You accepted ${isolate('Bo')}.`])
      expect(busy(c)).toEqual([])
      // Free again: the next action on that row goes through.
      h.log.length = 0
      await update(c, 'o1', 'completed')
      await c.flush()
      expect(h.log[0]).toBe('optins.update(o1=completed)')
    })

    it('a second Unblock on the same row sends nothing, so the first one\'s outcome is still said', async () => {
      const c = await asAuthor([optIn('o1', 'Bo', 'declined'), optIn('o2', 'Cy')])
      const pressed = el('unblock-optin-o1')
      el(rowAction('o2'))
      const first = unblock(c, 'o1')
      await first
      // The rpc is back; the row is still on screen (the follow-up has not landed). Press again.
      const second = unblock(c, 'o1')
      h.optIns = [optIn('o2', 'Cy')]
      gone(pressed)
      await second
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
      expect(h.log.filter((l) => l.startsWith('optins.update'))).toEqual(['optins.update(o1=accepted)', 'optins.update(o2=declined)'])
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
      h.optIns = h.optIns.map((o) => (o.id === 'o1' ? { ...o, status: 'accepted' } : o))
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

    it('reads sign-up side data for EVERY listed post: another card keeps its rows', async () => {
      h.rows = [...h.rows, row('p5', { max_seekers: 1, slots_remaining: 0 })]
      const c = await asAuthor([optIn('o1', 'Bo'), optIn('o2', 'Cy'), optIn('o5', 'Di', 'accepted', 'p5')])
      expect(rowsOf(c, 'p5')).toEqual([['o5', 'accepted']])
      await accept(c)
      expect(h.log).toEqual(['optins.update(o1=accepted)', ...followUp('p1', ['o1', 'o2', 'o5'], 'p1,p3,p5')])
      expect(rowsOf(c, 'p5')).toEqual([['o5', 'accepted']])
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
      h.optIns = [optIn('o1', 'Bo', 'completed'), optIn('o2', 'Cy')]
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
        // Still exactly one post read and one side-data set (for the cards that are left).
        expect(h.log).toEqual(['optins.update(o1=accepted)', 'posts.one(p1)', 'optins.mine(p3)', 'opt_in_declines', 'optins.rows(p3)'])
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
        expect(h.log).toEqual(['optins.update(o1=accepted)', ...followUp('p1', ['o1', 'o2'])])
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
        expect(h.notices).toEqual(['Your review was submitted'])
        expect(h.focused).toEqual(['post-card-p3'])
        expect(h.log.slice(0, 1)).toEqual(['posts.one(p1)'])
      })
    })

    describe('when the sign-up rows cannot be read again', () => {
      it('an error row is written, the row is set from the action\'s own result, and the outcome is said with a sentence that says the list is not fresh', async () => {
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
        expect(h.notices).toEqual([`You accepted ${isolate('Bo')}. ${optInsT('en', 'announceListStale')}`])
        expect(h.focused).toEqual(['complete-optin-o1'])
        expect(busy(c)).toEqual([])
        expect(h.log).toEqual(['optins.update(o1=accepted)', 'posts.one(p1)', `optins.mine(${POSTS})`, 'opt_in_declines', `optins.rows(${POSTS})`])
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

      it('a sent review: said with the same sentence added', async () => {
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
        expect(h.notices).toEqual([`Your review was submitted ${optInsT('en', 'announceListStale')}`])
        expect(h.logged).toEqual([{ event: 'feed.optin.reread_failed', labels: { step: 'side_data', action: 'review' } }])
      })
    })

    describe('a read that has been overtaken writes nothing', () => {
      const deferred = () => {
        let open = () => {}
        const promise = new Promise<void>((res) => {
          open = res
        })
        return { promise, open }
      }

      it('an older sign-up rows read that arrives after a newer one is dropped (the last request, not the last response, wins)', async () => {
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

    it('a sent review: one post read and one side-data set, the list left as it is; then focus first and "Your review was submitted", once', async () => {
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
      expect(h.notices).toEqual(['Your review was submitted'])
      c.rerender()
      await c.flush()
      expect(h.log).toHaveLength(5)
      expect(h.notices).toHaveLength(1)
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
      expect(h.notices).toEqual(['Your review was submitted'])
      expect(h.focused).toEqual(['post-card-p3'])
      expect(h.logged).toEqual([])
    })
  })
})
