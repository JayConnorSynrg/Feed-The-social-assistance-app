// apps/web/src/components/panels/feed-panel.posts.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// FeedPanel's post paths, driven on the mini hook runtime with a fake Supabase client: who sees a
// hidden post (ranked, chronological, realtime), what a moderator's card action sends, where focus
// goes and what is announced after the edit / report / remove dialogs, and that a realtime patch
// announces nothing. Children are not rendered: the test reads the props FeedPanel gives them
// (FeedPostCard, PostEditDialog, ReportDialog, ConfirmDeleteDialog) and calls them as React would.

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
}))
const once = <T,>(k: string, make: () => T): T => (h.stable[k] ??= make()) as T

vi.mock('motion/react', () => {
  const pass = (p: { children?: unknown }) => p.children
  return { LazyMotion: pass, AnimatePresence: pass, domAnimation: {}, useReducedMotion: () => false, m: new Proxy({}, { get: () => 'div' }) }
})
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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
  useOptIns: () => once('optins', () => ({ fetchOptInsForPosts: async () => new Map(), optIn: vi.fn(), withdrawOptIn: vi.fn() })),
}))
vi.mock('@/hooks/use-reviews', () => ({ useReviews: () => once('reviews', () => ({ fetchMyReviewsForOptIns: async () => new Map() })) }))
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
    setEventItems: () => {},
    eventMyStatuses: {},
    setEventMyStatuses: () => {},
    eventAnonClaims: new Set(),
    setEventAnonClaims: () => {},
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
      const result = () => {
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
            if (prop === 'then') return (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej)
            if (prop === 'maybeSingle' || prop === 'single')
              return () => {
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
import { FeedHeader } from '@/components/feed/feed-chrome'

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
    user: { id: AUTHOR, first_name: 'Ada', avatar_url: null, is_staff: false, admin_tier: null, harmony_score: null, harmony_reviews_count: 0, badge_summary: null },
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
