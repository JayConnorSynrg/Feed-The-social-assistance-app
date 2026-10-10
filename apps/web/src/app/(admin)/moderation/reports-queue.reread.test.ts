// apps/web/src/app/(admin)/moderation/reports-queue.reread.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The reports queue decides on the version the moderator is looking at: Dismiss and Hold send it as
// p_expected_version. When the author edited since (PT409) or deleted the post (PT404), the queue
// reads the post again, shows the current text (and sends that version next time) or that it is
// gone, and says so in an alert.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const POST = '22222222-2222-4222-8222-222222222222'
const h = vi.hoisted(() => ({
  rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  replies: [] as Array<{ data: unknown; error: unknown }>,
  post: null as null | Record<string, unknown>,
  held: [] as Array<Record<string, unknown>>,
}))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/supabase/client', () => {
  const client = {
    from: (table: string) => {
      const filters: Record<string, unknown> = {}
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'order', 'limit', 'in']) chain[m] = () => chain
      chain.eq = (c: string, v: unknown) => ((filters[c] = v), chain)
      const rows = () => {
        if (table === 'content_reports')
          return [{ id: 'r1', reporter_id: 'u', content_type: 'post', content_id: POST, reason: 'spam', details: null, status: 'open', created_at: '2026-10-01T00:00:00Z' }]
        if (table === 'posts' && filters.is_hidden === true) return h.held
        if (table === 'posts' && filters.id !== undefined) {
          const all = [...(h.post ? [h.post] : []), ...h.held]
          return all.filter((p) => p.id === filters.id)
        }
        if (table === 'posts') return h.post ? [h.post] : []
        return []
      }
      chain.maybeSingle = () => Promise.resolve({ data: rows()[0] ?? null, error: null })
      chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(res)
      return chain
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      h.rpcs.push({ fn, args })
      const reply = h.replies.shift() ?? { data: { success: true }, error: null }
      const b = { setHeader: () => b, then: (res: (v: unknown) => unknown) => Promise.resolve(reply).then(res) }
      return b
    },
  }
  return { createClient: () => client }
})

import { mount, findAll } from '@/test/mini-react'
import { ReportsQueue } from './reports-queue'
import { MODERATION_CONFLICT_MESSAGE } from './post-moderation-actions'
const ENGLISH_REFUSAL = "You can't moderate your own content — another moderator needs to review it."

type El = { type: unknown; props: Record<string, unknown> }
const byTestId = (tree: unknown, id: string) => findAll(tree, (e) => e.props['data-testid'] === id)[0] as El | undefined
const conflict = { data: null, error: { code: 'PT409', message: 'post_version_conflict', details: '{"current_version":8}' } }
const gone = { data: null, error: { code: 'PT404', message: 'post_not_found' } }

beforeEach(() => {
  h.rpcs.length = 0
  h.replies.length = 0
  h.post = { id: POST, content: 'Buy now', user_id: 'a', is_hidden: false, version: 7 }
  h.held = []
})

async function openGroup() {
  const c = mount(() => ReportsQueue())
  let tree = await c.flush()
  ;(findAll(tree, (el) => el.props.variant === 'ghost')[0].props.onClick as () => void)()
  tree = c.rerender()
  return c
}
const click = async (c: ReturnType<typeof mount>, id: string) => {
  ;(byTestId(c.tree(), id)!.props.onClick as () => void)()
  return c.flush()
}
const alertText = (tree: unknown) => (findAll(tree, (e) => e.props.role === 'alert')[0] as El | undefined)?.props.children

describe('ReportsQueue sends the version on screen', () => {
  it('Dismiss sends p_expected_version', async () => {
    const c = await openGroup()
    await click(c, 'dismiss-report-r1')
    expect(h.rpcs).toEqual([{ fn: 'admin_resolve_report', args: { p_report_id: 'r1', p_action: 'dismiss', p_expected_version: 7 } }])
  })

  it('Hold sends p_expected_version', async () => {
    const c = await openGroup()
    await click(c, `hold-post-${POST}`)
    expect(h.rpcs).toEqual([{ fn: 'admin_hold_post', args: { p_post_id: POST, p_expected_version: 7 } }])
  })
})

describe('after a conflict or a gone post the queue reads the post again', () => {
  it('Hold refused (the author edited): the new text shows, an alert says so, and the next try sends the new version', async () => {
    const c = await openGroup()
    h.replies.push(conflict)
    h.post = { id: POST, content: 'Buy now — edited', user_id: 'a', is_hidden: false, version: 8 }
    const tree = await click(c, `hold-post-${POST}`)
    expect(alertText(tree)).toBe(MODERATION_CONFLICT_MESSAGE)
    expect(findAll(tree, (e) => e.props.children === 'Buy now — edited')).toHaveLength(1)
    await click(c, `hold-post-${POST}`)
    expect(h.rpcs.map((r) => r.args.p_expected_version)).toEqual([7, 8])
  })

  it('Dismiss refused (the author edited): re-read, and the next Dismiss sends the new version', async () => {
    const c = await openGroup()
    h.replies.push(conflict)
    h.post = { id: POST, content: 'Edited', user_id: 'a', is_hidden: false, version: 8 }
    const tree = await click(c, 'dismiss-report-r1')
    expect(alertText(tree)).toBe(MODERATION_CONFLICT_MESSAGE)
    await click(c, 'dismiss-report-r1')
    expect(h.rpcs.map((r) => r.args.p_expected_version)).toEqual([7, 8])
  })

  it('the post is gone: the queue says so and its link reads as deleted', async () => {
    const c = await openGroup()
    h.replies.push(gone)
    h.post = null
    const tree = await click(c, `remove-post-${POST}`)
    expect(String(alertText(tree))).toMatch(/gone/i)
    expect(findAll(tree, (e) => e.props.children === 'Buy now')).toHaveLength(0)
  })
})

describe('"Removed & Held Posts" follows the re-read', () => {
  const HELD = '33333333-3333-4333-8333-333333333333'
  const heldRow = (o: Record<string, unknown> = {}) => ({ id: HELD, is_hidden: true, content: 'Held text', created_at: '2026-10-01T00:00:00Z', hidden_at: '2026-10-02T00:00:00Z', hidden_reason: 'hold_for_review', user_id: 'a', version: 4, ...o })

  it('Authorize refused because the post is gone: it leaves the held list', async () => {
    h.held = [heldRow()]
    const c = mount(() => ReportsQueue())
    await c.flush()
    expect(byTestId(c.tree(), `authorize-post-${HELD}`)).toBeDefined()
    h.replies.push(gone)
    h.held = []
    const tree = await click(c, `authorize-post-${HELD}`)
    expect(byTestId(tree, `authorize-post-${HELD}`)).toBeUndefined()
    expect(String(alertText(tree))).toMatch(/gone/i)
  })

  it('Authorize refused because the author edited: the held entry shows the new text and the next try sends its version', async () => {
    h.held = [heldRow()]
    const c = mount(() => ReportsQueue())
    await c.flush()
    h.replies.push(conflict)
    h.held = [heldRow({ content: 'Held text, edited', version: 5 })]
    const tree = await click(c, `authorize-post-${HELD}`)
    expect(findAll(tree, (e) => e.props.children === 'Held text, edited')).toHaveLength(1)
    await click(c, `authorize-post-${HELD}`)
    expect(h.rpcs.map((r) => r.args.p_expected_version)).toEqual([4, 5])
  })
})

describe('a moderator cannot lift moderation on their own content', () => {
  it('a refused Dismiss (self-moderation) reads in English, like the rest of the console', async () => {
    const c = await openGroup()
    h.replies.push({ data: null, error: { code: '42501', message: 'self_moderation_refused' } })
    const tree = await click(c, 'dismiss-report-r1')
    expect(alertText(tree)).toBe(ENGLISH_REFUSAL)
    expect(byTestId(tree, 'dismiss-report-r1')).toBeDefined()
  })

  it('a refused Authorize (self-moderation) reads in English and the post stays held', async () => {
    const HELD = '44444444-4444-4444-8444-444444444444'
    h.held = [{ id: HELD, is_hidden: true, content: 'Mine', created_at: '2026-10-01T00:00:00Z', hidden_at: null, hidden_reason: 'hold_for_review', user_id: 'me', version: 2 }]
    const c = mount(() => ReportsQueue())
    await c.flush()
    h.replies.push({ data: null, error: { code: '42501', message: 'self_moderation_refused' } })
    const tree = await click(c, `authorize-post-${HELD}`)
    expect(alertText(tree)).toBe(ENGLISH_REFUSAL)
    expect(byTestId(tree, `authorize-post-${HELD}`)).toBeDefined()
  })
})

describe("the moderator's own post in the queue", () => {
  const openAs = async (viewerId: string) => {
    const c = mount(() => ReportsQueue({ viewerId }))
    let tree = await c.flush()
    ;(findAll(tree, (el) => el.props.variant === 'ghost')[0].props.onClick as () => void)()
    tree = c.rerender()
    return { c, tree }
  }

  it('its author sees no Dismiss (another moderator resolves its reports) and a note why; Remove and Hold stay', async () => {
    const { tree } = await openAs('a')
    expect(byTestId(tree, 'dismiss-report-r1')).toBeUndefined()
    expect(byTestId(tree, `own-post-note-${POST}`)).toBeDefined()
    expect(byTestId(tree, `remove-post-${POST}`)).toBeDefined()
    expect(byTestId(tree, `hold-post-${POST}`)).toBeDefined()
  })

  it('another moderator sees Dismiss and no note', async () => {
    const { tree } = await openAs('someone-else')
    expect(byTestId(tree, 'dismiss-report-r1')).toBeDefined()
    expect(byTestId(tree, `own-post-note-${POST}`)).toBeUndefined()
  })

  it('no Hold of your own post another moderator removed; another moderator can still hold it', async () => {
    h.post = { id: POST, content: 'Buy now', user_id: 'a', is_hidden: true, hidden_reason: 'admin_removal', version: 7 }
    expect(byTestId((await openAs('a')).tree, `hold-post-${POST}`)).toBeUndefined()
    expect(byTestId((await openAs('someone-else')).tree, `hold-post-${POST}`)).toBeDefined()
  })

  it('no Authorize of your own held post; another moderator gets it', async () => {
    const HELD = '55555555-5555-4555-8555-555555555555'
    h.held = [{ id: HELD, is_hidden: true, content: 'Mine', created_at: '2026-10-01T00:00:00Z', hidden_at: null, hidden_reason: 'hold_for_review', user_id: 'me', version: 2 }]
    const own = mount(() => ReportsQueue({ viewerId: 'me' }))
    expect(byTestId(await own.flush(), `authorize-post-${HELD}`)).toBeUndefined()
    const other = mount(() => ReportsQueue({ viewerId: 'someone-else' }))
    expect(byTestId(await other.flush(), `authorize-post-${HELD}`)).toBeDefined()
  })
})
