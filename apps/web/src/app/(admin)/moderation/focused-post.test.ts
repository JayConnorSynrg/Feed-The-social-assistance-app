// apps/web/src/app/(admin)/moderation/focused-post.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The single-post view an "Edit in admin" post link opens (I2), and the ONE post moderation path it
// shares with the reports queue:
//   - the post is read by id with the author FK named; found / not_found / error;
//   - the view offers Remove / Hold / Authorize only for a post that was read (none while loading,
//     none for a not-found or unreadable id), matching what members currently see;
//   - moderatePost makes exactly one privileged RPC per action, on the given id;
//   - reports-queue.tsx and focused-post.tsx both act through moderatePost; neither names a post RPC.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const warns = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>)
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: (n: string, a: Record<string, unknown>) => warns.push([n, a]), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { FocusedPostView, FOCUSED_POST_SELECT, applyPostAction, focusedPostStatusText, loadFocusedPost, postStatusLabel, type FocusedPostRow, type FocusedPostState } from './focused-post'
import { moderatePost, postActionsFor } from './post-moderation-actions'

const ID = '11111111-1111-4111-8111-111111111111'

function post(extra: Partial<FocusedPostRow> = {}): FocusedPostRow {
  return {
    id: ID,
    content: 'Need a ride to the clinic Tuesday',
    post_type: 'request',
    created_at: '2026-10-01T12:00:00Z',
    is_hidden: false,
    hidden_reason: null,
    hidden_at: null,
    author: { first_name: 'Ada' },
    ...extra,
  }
}

const view = (state: FocusedPostState, extra: Partial<Parameters<typeof FocusedPostView>[0]> = {}) =>
  renderToStaticMarkup(h(FocusedPostView, { state, processing: null, error: null, onAction: () => {}, onDismiss: () => {}, ...extra }))
const statusRegions = (html: string) => [...html.matchAll(/<p role="status"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''))

function postsReader(result: { data: unknown; error: unknown } | Error) {
  const calls: Array<[string, ...unknown[]]> = []
  const chain = {
    select: (...a: unknown[]) => (calls.push(['select', ...a]), chain),
    eq: (...a: unknown[]) => (calls.push(['eq', ...a]), chain),
    maybeSingle: async () => {
      if (result instanceof Error) throw result
      return result
    },
  }
  return { client: { from: (t: string) => (calls.push(['from', t]), chain) } as never, calls }
}

beforeEach(() => {
  warns.length = 0
})

describe('loadFocusedPost — read by id first', () => {
  it('reads posts by id with the author FK named and no location column', async () => {
    const r = postsReader({ data: post(), error: null })
    expect(await loadFocusedPost(r.client, ID)).toEqual({ status: 'found', post: post() })
    expect(r.calls).toEqual([['from', 'posts'], ['select', FOCUSED_POST_SELECT], ['eq', 'id', ID]])
    expect(FOCUSED_POST_SELECT).toMatch(/profiles!posts_user_id_fkey\(/)
    expect(FOCUSED_POST_SELECT).not.toMatch(/location/)
  })

  it('reads no profiles column Settings C2 revokes (username / avatar_url / bio): first_name only', () => {
    const embed = FOCUSED_POST_SELECT.match(/profiles!posts_user_id_fkey\(([^)]*)\)/)
    expect(embed?.[1]).toBe('first_name')
    expect(FOCUSED_POST_SELECT).not.toMatch(/\b(username|avatar_url|bio)\b/)
  })

  it('no row -> not_found; a failed or thrown read -> error (logged, no id in the row)', async () => {
    expect(await loadFocusedPost(postsReader({ data: null, error: null }).client, ID)).toEqual({ status: 'not_found' })
    expect(await loadFocusedPost(postsReader({ data: null, error: { code: '57014' } }).client, ID)).toEqual({ status: 'error' })
    expect(await loadFocusedPost(postsReader(new Error('net')).client, ID)).toEqual({ status: 'error' })
    expect(warns).toEqual([
      ['admin.deeplink.load_failed', { kind: 'post', code: '57014' }],
      ['admin.deeplink.load_failed', { kind: 'post', code: 'exception' }],
    ])
  })
})

describe('FocusedPostView — actions only for a post that was read', () => {
  it('found, visible: the post, its status, Remove + Hold (no Authorize)', () => {
    const html = view({ status: 'found', post: post() })
    expect(html).toContain('Linked post')
    expect(html).toContain('Need a ride to the clinic Tuesday')
    expect(html).toContain('Visible to members')
    expect(html).toContain('data-testid="focused-remove-post"')
    expect(html).toContain('data-testid="focused-hold-post"')
    expect(html).not.toContain('data-testid="focused-authorize-post"')
  })

  it('found, held: Remove + Authorize; removed: Authorize only', () => {
    const held = view({ status: 'found', post: post({ is_hidden: true, hidden_reason: 'hold_for_review' }) })
    expect(held).toContain('Held for review')
    expect(held).toMatch(/focused-remove-post[\s\S]*focused-authorize-post/)
    expect(held).not.toContain('focused-hold-post')
    const removed = view({ status: 'found', post: post({ is_hidden: true, hidden_reason: 'admin_removal' }) })
    expect(removed).toContain('Removed')
    expect(removed).toContain('focused-authorize-post')
    expect(removed).not.toMatch(/focused-(remove|hold)-post/)
  })

  it.each([
    [{ status: 'loading' } as FocusedPostState, 'Loading the linked post'],
    [{ status: 'not_found' } as FocusedPostState, 'This post was not found'],
    [{ status: 'error' } as FocusedPostState, 'could not be loaded'],
  ])('%o: a plain line and NO action buttons', (state, text) => {
    const html = view(state)
    expect(html).toContain(text)
    expect(html).not.toMatch(/focused-(remove|hold|authorize)-post/)
    expect(html).not.toContain('<button disabled')
  })

  it('postActionsFor / applyPostAction / postStatusLabel agree with the RPCs', () => {
    expect(postActionsFor({ is_hidden: false, hidden_reason: null })).toEqual(['remove', 'hold'])
    expect(postActionsFor({ is_hidden: true, hidden_reason: 'hold_for_review' })).toEqual(['remove', 'authorize'])
    expect(postActionsFor({ is_hidden: true, hidden_reason: 'admin_removal' })).toEqual(['authorize'])
    expect(postActionsFor({ is_hidden: true, hidden_reason: 'auto_hidden' })).toEqual(['remove', 'authorize'])
    const p = post()
    expect(postStatusLabel(applyPostAction(p, 'remove'))).toBe('Removed')
    expect(postStatusLabel(applyPostAction(p, 'hold'))).toBe('Held for review')
    expect(postStatusLabel(applyPostAction(applyPostAction(p, 'hold'), 'authorize'))).toBe('Visible to members')
  })
})

describe('moderatePost — one privileged RPC per action', () => {
  function rpcClient(result: { data: unknown; error: { code?: string; message: string } | null }) {
    const calls: Array<{ fn: string; args: unknown; header?: [string, string] }> = []
    return {
      calls,
      client: {
        rpc: (fn: string, args: unknown) => {
          const call: (typeof calls)[number] = { fn, args }
          calls.push(call)
          const builder = {
            setHeader: (k: string, v: string) => ((call.header = [k, v]), builder),
            then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
          }
          return builder
        },
      } as never,
    }
  }

  it.each([
    ['remove', 'admin_remove_post'],
    ['hold', 'admin_hold_post'],
    ['authorize', 'admin_authorize_post'],
  ] as const)('%s -> %s(p_post_id) with an x-request-id header', async (action, fn) => {
    const r = rpcClient({ data: { success: true }, error: null })
    expect(await moderatePost(r.client, action, ID)).toEqual({ ok: true })
    expect(r.calls).toHaveLength(1)
    expect(r.calls[0]).toMatchObject({ fn, args: { p_post_id: ID } })
    expect(r.calls[0].header?.[0]).toBe('x-request-id')
  })

  it('a refusal: the queue\'s generic line, and one admin.denied row', async () => {
    const r = rpcClient({ data: null, error: { code: '42501', message: 'p3_denied:insufficient_tier' } })
    expect(await moderatePost(r.client, 'hold', ID)).toEqual({ ok: false, message: 'An error occurred' })
    expect(warns.filter(([n]) => n === 'admin.denied')).toHaveLength(1)
    expect(warns[0][1]).toMatchObject({ action: 'post.hold', code: '42501' })
  })
})

describe('one shared actions module (no second copy)', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  it.each([['./reports-queue.tsx'], ['./focused-post.tsx']])('%s acts through moderatePost and names no post RPC', (file) => {
    const src = read(file)
    expect(src).toMatch(/import \{[^}]*\bmoderatePost\b[^}]*\} from '\.\/post-moderation-actions'/)
    expect(src).toMatch(/moderatePost\(supabase, /)
    expect(src).not.toMatch(/admin_(remove|hold|authorize)_post|'admin\.post\./)
  })

  it('the post RPC names live only in post-moderation-actions.ts', () => {
    expect(read('./post-moderation-actions.ts').match(/'admin_(remove|hold|authorize)_post'/g)).toHaveLength(3)
  })
})

describe('a11y: one status region announces every step; focus and contrast', () => {
  it.each([
    [{ status: 'loading' } as FocusedPostState, 'Loading the linked post…'],
    [{ status: 'not_found' } as FocusedPostState, 'This post was not found. It may have been deleted.'],
    [{ status: 'error' } as FocusedPostState, 'The linked post could not be loaded. The reports queue below still works.'],
    [{ status: 'found', post: post() } as FocusedPostState, 'Status: Visible to members.'],
  ])('%o: exactly ONE role=status region, same element, text only changes', (state, text) => {
    expect(statusRegions(view(state))).toEqual([text])
  })

  it('after an action the region says what happened and the new status', () => {
    const removed = { status: 'found', post: applyPostAction(post(), 'remove') } as FocusedPostState
    expect(statusRegions(view(removed, { lastAction: 'remove' }))).toEqual(['Post removed. Status: Removed.'])
    expect(focusedPostStatusText({ status: 'found', post: applyPostAction(post(), 'hold') }, 'hold')).toBe('Post held for review. Status: Held for review.')
  })

  it('Remove is red-700 (6.4:1), not the 3.6:1 theme red', () => {
    expect(view({ status: 'found', post: post() })).toMatch(/<button[^>]*class="[^"]*bg-red-700[^"]*"[^>]*data-testid="focused-remove-post"/)
  })

  it('while an action runs, the buttons are aria-disabled (not disabled), so the pressed one keeps focus; clicks are ignored', () => {
    const calls: string[] = []
    const html = view({ status: 'found', post: post() }, { processing: 'hold' })
    expect(html).toMatch(/aria-disabled="true"[^>]*data-testid="focused-hold-post"/)
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*data-testid="focused-/)
    const el = FocusedPostView({ state: { status: 'found', post: post() }, processing: 'hold', error: null, onAction: (a) => calls.push(a), onDismiss: () => {} })
    const found = (el as { props: { children: unknown[] } }).props.children[2] as { type: (p: unknown) => unknown; props: unknown }
    const tree = found.type(found.props) as { props: { children: unknown[] } }
    const buttons = (tree.props.children[3] as { props: { children: Array<{ props: { onClick: () => void } }> } }).props.children
    buttons.forEach((b) => b.props.onClick())
    expect(calls).toEqual([])
  })
})

