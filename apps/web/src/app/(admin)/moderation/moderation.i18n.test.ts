// apps/web/src/app/(admin)/moderation/moderation.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W3: an admin reads the Moderation tab, the People tab, the Community insights card and the
// admin error screens in their own language, with dates in their locale.
//   - Rendered: Korean text with lang="ko"; Arabic right-to-left; member-written text (post bodies,
//     report details, names) marked lang="" dir="auto" and never translated; the still-English
//     Safety Alerts panel and the model-written insights marked lang="en" dir="ltr".
//   - Label in Name, in the 14 locales: every named control's accessible name starts with the text on
//     screen.
//   - Behaviour unchanged: each moderation action, report dismissal and tier change sends the same
//     RPC, arguments, request-id header, withMetric row and log rows in every language; only the
//     words on screen differ.
//   - Diagnostics: each failure that now shows a translated sentence writes exactly one row with its
//     code (PostgREST code, HTTP status or error class) and never its message text.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as el, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const POST = '11111111-1111-4111-8111-111111111111'
const HELD = '22222222-2222-4222-8222-222222222222'

type Reply = { data: unknown; error: unknown }
const h = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ fn: string; args: unknown; header?: [string, string] }>,
  rpcReply: { data: { success: true }, error: null } as { data: unknown; error: unknown },
  rpcThrow: false,
  throwBeforeRpc: false,
  reportsError: null as unknown,
  reportsThrow: false,
  postsError: null as unknown,
  fetchMode: 'ok' as 'ok' | 'http500' | 'throw',
  metric: [] as Array<{ op: string; attrs: Record<string, unknown>; ok: boolean; error?: string }>,
  language: 'ko' as string | null,
  people: [{ id: 'p1', first_name: 'أمينة', username: 'amina', avatar_url: null, admin_tier: null, joined_at: null }],
  emptyQueue: false,
  // Hold the next admin_list_people answer until release() (a re-read in flight).
  holdList: false,
  release: null as null | (() => void),
  frames: [] as Array<() => void>,
  listError: false,
  focusSession: false,
  focusRow: null as unknown,
  reloadKey: 0,
  session: { focus: { kind: 'post', id: '11111111-1111-4111-8111-111111111111' }, resolve: () => {} },
}))

vi.mock('./use-admin-focus', () => ({ useAdminFocusSession: () => (h.focusSession ? h.session : null) }))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (op: string, attrs: Record<string, unknown>, fn: () => Promise<unknown>) => {
    try {
      const out = await fn()
      h.metric.push({ op, attrs, ok: true })
      return out
    } catch (e) {
      h.metric.push({ op, attrs, ok: false, error: (e as Error).name })
      throw e
    }
  },
}))

vi.mock('@/lib/privileged-action', async (orig) => {
  const real = await orig<typeof import('@/lib/privileged-action')>()
  return {
    ...real,
    privilegedRpc: (...a: Parameters<typeof real.privilegedRpc>) =>
      h.throwBeforeRpc ? Promise.reject(new RangeError('before any request')) : real.privilegedRpc(...a),
  }
})

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'admin' }, profile: h.language ? { preferred_language: h.language } : null }),
}))

function rpcBuilder(fn: string, args: unknown) {
  const call: { fn: string; args: unknown; header?: [string, string] } = { fn, args }
  h.rpcCalls.push(call)
  const b = {
    setHeader(k: string, v: string) {
      call.header = [k, v]
      return b
    },
    then(res: (v: Reply) => unknown, rej?: (e: unknown) => unknown) {
      if (fn === 'admin_list_people') {
        if (h.holdList) {
          h.holdList = false
          return new Promise<Reply>((r) => (h.release = () => r(h.listError ? { data: null, error: { code: '57014' } } : { data: h.people, error: null }))).then(res, rej)
        }
        return Promise.resolve({ data: h.people, error: null }).then(res, rej)
      }
      if (h.rpcThrow) return Promise.reject(new TypeError('Failed to fetch')).then(res, rej)
      return Promise.resolve(h.rpcReply).then(res, rej)
    },
  }
  return b
}

const client = {
  from: (table: string) => {
    const filters: Record<string, unknown> = {}
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'in', 'gte']) chain[m] = () => chain
    chain.eq = (c: string, v: unknown) => ((filters[c] = v), chain)
    chain.maybeSingle = () => ({ then: (res: (v: Reply) => unknown) => Promise.resolve({ data: h.focusRow, error: null }).then(res) })
    chain.then = (res: (v: Reply) => unknown, rej?: (e: unknown) => unknown) => {
      if (table === 'content_reports') {
        if (h.emptyQueue) return Promise.resolve({ data: [], error: null }).then(res, rej)
        if (h.reportsThrow) return Promise.reject(new TypeError('Failed to fetch "Amina"')).then(res, rej)
        if (h.reportsError) return Promise.resolve({ data: null, error: h.reportsError }).then(res, rej)
        return Promise.resolve({
          data: [
            { id: 'r1', reporter_id: 'u', content_type: 'post', content_id: POST, reason: 'spam', details: 'هذا المنشور مزعج', status: 'open', created_at: '2026-10-01T12:00:00Z' },
            { id: 'r2', reporter_id: 'v', content_type: 'post', content_id: POST, reason: 'legacy_reason', details: null, status: 'open', created_at: '2026-10-02T12:00:00Z' },
          ],
          error: null,
        }).then(res, rej)
      }
      if (table === 'posts' && filters.is_hidden === true && h.emptyQueue) return Promise.resolve({ data: [], error: null }).then(res, rej)
      if (table === 'posts' && filters.is_hidden === true)
        return Promise.resolve({
          data: [{ id: HELD, is_hidden: true, content: 'Held text by a member', created_at: '2026-09-30T12:00:00Z', hidden_at: '2026-10-03T12:00:00Z', hidden_reason: 'hold_for_review', user_id: 'b', version: 2 }],
          error: null,
        }).then(res, rej)
      if (table === 'posts' && h.postsError) return Promise.resolve({ data: null, error: h.postsError }).then(res, rej)
      if (table === 'posts')
        return Promise.resolve({ data: [{ id: POST, content: 'Buy now cheap', user_id: 'a', is_hidden: false, hidden_reason: null, version: 7, post_type: 'request' }], error: null }).then(res, rej)
      return Promise.resolve({ data: [], error: null }).then(res, rej)
    }
    return chain
  },
  rpc: rpcBuilder,
}
vi.mock('@/lib/supabase/client', () => ({ createClient: () => client }))

import { mount, findAll } from '@/test/mini-react'
import { logger } from '@/lib/logger'
import { messages, type Locale } from '@/lib/i18n'
import { dateTimeFormatter, formatDate } from '@/lib/i18n-intl'
import { browserTimeZone } from '@/lib/event-time'
import { reportReasonLabel } from '@/lib/i18n-feed-card'
import { adminShellT } from '@/lib/i18n-admin-shell'
import { POSTS_WITH_REPORTS, REPORT_COUNT, THEME_POSTS, adminModerationT, moderationActionLabel, moderationCount } from '@/lib/i18n-admin-moderation'
import { adminPeopleT, denialText, grantOptionLabel } from '@/lib/i18n-admin-people'
import { markupText } from '@/test/markup-text'
import { TabsContent, TabsList, TabsTrigger, Tabs } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ReportsQueue, focusAfterRemoval } from './reports-queue'
import { FocusedPost, FocusedPostView, type FocusedPostRow } from './focused-post'
import { moderatePost, type PostModerationAction } from './post-moderation-actions'
import { ModerationTab } from './moderation-tab'
import { PeopleTab } from './people-tab'
import { CommunitySummarySection } from './community-summary-section'
import AdminError from '../error'
import AdminNotFound from '../not-found'

const LOCALES = Object.keys(messages) as Locale[]
const warn = () => vi.mocked(logger.warn).mock.calls
const html = (node: unknown) => renderToStaticMarkup(node as ReactElement)

beforeEach(() => {
  h.rpcCalls.length = 0
  h.metric.length = 0
  h.rpcReply = { data: { success: true }, error: null }
  h.rpcThrow = false
  h.throwBeforeRpc = false
  h.reportsError = null
  h.reportsThrow = false
  h.postsError = null
  h.fetchMode = 'ok'
  h.language = 'ko'
  h.emptyQueue = false
  h.holdList = false
  h.release = null
  h.frames.length = 0
  h.listError = false
  h.focusSession = false
  h.focusRow = null
  h.reloadKey = 0
  vi.mocked(logger.warn).mockClear()
  vi.mocked(logger.info).mockClear()
  vi.stubGlobal('window', { location: { search: '' } })
  vi.stubGlobal('requestAnimationFrame', (f: () => void) => (h.frames.push(f), 0))
  vi.stubGlobal('fetch', async () => {
    if (h.fetchMode === 'throw') throw new TypeError('Failed to fetch')
    if (h.fetchMode === 'http500') return { ok: false, status: 500, json: async () => ({ error: 'AI service unavailable for Amina' }) }
    return { ok: true, status: 200, json: async () => ({ themes: [{ type: 'request', label: 'Food needs', summary: 'Members ask for food.', count: 1200 }] }) }
  })
})

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** A run's calls with the random request id replaced, so two runs compare byte for byte. */
function record() {
  const rid = (v: unknown) => (typeof v === 'string' ? 'RID' : v)
  return JSON.parse(
    JSON.stringify({
      rpc: h.rpcCalls.map((c) => ({ ...c, header: c.header ? [c.header[0], rid(c.header[1])] : undefined })),
      metric: h.metric.map((m) => ({ ...m, attrs: { ...m.attrs, request_id: rid(m.attrs.request_id) } })),
      warn: warn().map(([name, attrs]) => [name, { ...(attrs as Record<string, unknown>), request_id: rid((attrs as Record<string, unknown>)?.request_id) }]),
      info: vi.mocked(logger.info).mock.calls.map(([name, attrs]) => [name, { ...(attrs as Record<string, unknown>), request_id: rid((attrs as Record<string, unknown>)?.request_id) }]),
    }),
  )
}
function resetCalls() {
  h.rpcCalls.length = 0
  h.metric.length = 0
  vi.mocked(logger.warn).mockClear()
  vi.mocked(logger.info).mockClear()
}

async function openQueue(locale: Locale) {
  const c = mount(() => ReportsQueue({ locale }))
  let tree = await c.flush()
  const chevron = findAll(tree, (e) => e.props.variant === 'ghost')[0]
  const closed = { expanded: chevron.props['aria-expanded'], name: chevron.props['aria-label'] }
  ;(chevron.props.onClick as () => void)()
  tree = c.rerender()
  return { c, tree, closed }
}

const FOUND: FocusedPostRow = {
  id: POST,
  user_id: 'a',
  content: 'نص كتبه عضو',
  post_type: 'update',
  created_at: '2026-10-01T12:00:00Z',
  is_hidden: false,
  hidden_reason: null,
  hidden_at: null,
  version: 3,
  author: { first_name: 'Nguyễn' },
}
const focusedHtml = (locale: Locale, extra: Record<string, unknown> = {}) =>
  html(el(FocusedPostView, { state: { status: 'found', post: FOUND }, processing: null, error: null, onAction: () => {}, onDismiss: () => {}, locale, ...extra }))

// ---------------------------------------------------------------------------------------------
// Rendered in the admin's language
// ---------------------------------------------------------------------------------------------

describe('the reports queue in Korean', () => {
  it('counts, reasons, actions, dates and headings read in Korean; no English label is left', async () => {
    const { tree } = await openQueue('ko')
    const out = html(tree)
    const text = markupText(out)
    expect(text).toContain(moderationCount(POSTS_WITH_REPORTS, 1, 'ko'))
    expect(text).toContain(moderationCount(REPORT_COUNT, 2, 'ko'))
    expect(text).toContain(reportReasonLabel('spam', 'ko'))
    expect(text).toContain(moderationActionLabel('remove', 'ko'))
    expect(text).toContain(moderationActionLabel('hold', 'ko'))
    expect(text).toContain(adminModerationT('ko', 'actionDismiss'))
    expect(text).toContain(adminModerationT('ko', 'heldTitle'))
    expect(text).toContain(moderationActionLabel('authorize', 'ko'))
    expect(text).toContain(adminModerationT('ko', 'statusHeld'))
    expect(text).toContain('2026년')
    expect(text).toContain(formatDate('2026-10-03T12:00:00Z', 'ko', browserTimeZone()))
    expect(text).toContain(
      dateTimeFormatter('ko', browserTimeZone(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date('2026-10-01T12:00:00Z')),
    )
    for (const english of ['Remove Post', 'Hold for Review', 'Authorize Post', 'Dismiss', 'Removed & Held Posts', 'with open reports', 'Spam', 'View post']) {
      expect(text).not.toContain(english)
    }
  })

  it('member-written text keeps its own language and direction; an unknown reason code is marked English', async () => {
    const { tree } = await openQueue('ko')
    const out = html(tree)
    expect(out).toMatch(/<[a-z]+ [^>]*lang="" dir="auto"[^>]*>Buy now cheap</)
    expect(out).toMatch(/<p lang="" dir="auto"[^>]*>هذا المنشور مزعج<\/p>/)
    expect(out).toMatch(/<p lang="" dir="auto"[^>]*>Held text by a member<\/p>/)
    expect(out).toContain('<span lang="en" dir="ltr">legacy_reason</span>')
    expect(out).not.toMatch(/lang="ko"[^>]*>Buy now cheap/)
  })

  it('the chevron keeps one name, says whether it is expanded, and names the region it controls', async () => {
    const { tree, closed } = await openQueue('ko')
    expect(closed).toEqual({ expanded: false, name: adminModerationT('ko', 'reportDetails') })
    const open = findAll(tree, (e) => e.props.variant === 'ghost')[0]
    expect(open.props['aria-expanded']).toBe(true)
    expect(open.props['aria-label']).toBe(adminModerationT('ko', 'reportDetails'))
    expect(open.props['aria-controls']).toBe(`reports-${POST}`)
    expect(findAll(tree, (e) => e.props.id === `reports-${POST}`)).toHaveLength(1)
  })

  it('English stays as before', async () => {
    const { tree } = await openQueue('en')
    const text = markupText(html(tree))
    expect(text).toContain('1 post with open reports')
    expect(text).toContain('2 reports')
    expect(text).toContain('Remove Post')
    expect(text).toContain('Authorize Post')
  })
})

describe('the linked post', () => {
  it('Korean: heading, status, actions and date in Korean, marked ko; the post and author keep their own', () => {
    const out = focusedHtml('ko')
    expect(out).toMatch(/<section[^>]*lang="ko" dir="ltr"/)
    const text = markupText(out)
    expect(text).toContain(adminModerationT('ko', 'focusTitle'))
    expect(text).toContain(adminModerationT('ko', 'statusVisible'))
    expect(text).toContain(moderationActionLabel('remove', 'ko'))
    expect(text).toContain('2026년')
    expect(out).toMatch(/<p lang="" dir="auto"[^>]*>نص كتبه عضو<\/p>/)
    expect(out).toContain('<span lang="" dir="auto">Nguyễn</span>')
  })

  it('Arabic: right-to-left', () => {
    expect(focusedHtml('ar')).toMatch(/<section[^>]*lang="ar" dir="rtl"/)
  })

  it('Haitian Creole: the date uses FEED’s own month words, not English', () => {
    const text = markupText(focusedHtml('ht'))
    expect(text).toContain(formatDate('2026-10-01T12:00:00Z', 'ht', browserTimeZone()))
    expect(text).toContain('okt')
    expect(text).not.toContain('Oct')
  })
})

describe('the moderation sub-tabs', () => {
  it('Korean: tab list named by the shell’s word, triggers in Korean; the Safety Alerts panel still marked English', async () => {
    const c = mount(() => ModerationTab({ selectedOrgId: 'all', locale: 'ko' }))
    const tree = await c.flush()
    expect(findAll(tree, (e) => e.type === TabsList)[0].props['aria-label']).toBe(adminShellT('ko', 'tabModeration'))
    const labels = findAll(tree, (e) => e.type === TabsTrigger).map((t) => t.props.children)
    expect(labels).toEqual([adminModerationT('ko', 'subtabReports'), adminModerationT('ko', 'subtabSafety')])
    const panels = findAll(tree, (e) => e.type === TabsContent)
    const safety = panels.find((p) => p.props.value === 'safety')!
    const reports = panels.find((p) => p.props.value === 'reports')!
    expect([safety.props.lang, safety.props.dir]).toEqual(['en', 'ltr'])
    expect(reports.props.lang).toBeUndefined()
  })

  it('Arabic: arrow keys follow reading direction', async () => {
    const c = mount(() => ModerationTab({ selectedOrgId: 'all', locale: 'ar' }))
    const tree = await c.flush()
    expect(findAll(tree, (e) => e.type === Tabs)[0].props.dir).toBe('rtl')
  })
})

describe('the People tab', () => {
  async function openPeople(locale: Locale) {
    const c = mount(() => PeopleTab({ viewerTier: 'platform_admin', isFounder: true, locale }))
    let tree = await c.flush()
    const select = findAll(tree, (e) => e.type === 'select')[0]
    ;(select.props.onChange as (e: unknown) => void)({ target: { value: 'community_moderator' } })
    tree = c.rerender()
    return { c, tree }
  }

  it('Korean: search, headers, tier options and the confirmation in Korean; the name keeps its own', async () => {
    const { tree } = await openPeople('ko')
    const text = markupText(html(tree))
    for (const k of ['search', 'colPerson', 'colTier', 'colSetTier', 'change'] as const) expect(text).toContain(adminPeopleT('ko', k))
    expect(html(tree)).toMatch(/<span lang="" dir="auto">أمينة<\/span>/)
    const content = findAll(tree, (e) => e.type === DialogContent)[0]
    expect([content.props.lang, content.props.dir, content.props.closeLabel]).toEqual(['ko', 'ltr', adminPeopleT('ko', 'close')])
    const description = markupText(html(el('p', null, findAll(tree, (e) => e.type === DialogDescription)[0].props.children as never)))
    expect(description).toContain('أمينة')
    expect(description).toContain(adminPeopleT('ko', 'reasonRequired'))
    expect(description).not.toMatch(/Grant|Revoke/)
  })

  it('Arabic: the confirmation dialog, a portal, is right-to-left itself; the name is bold in its own direction', async () => {
    const { tree } = await openPeople('ar')
    const content = findAll(tree, (e) => e.type === DialogContent)[0]
    expect([content.props.lang, content.props.dir]).toEqual(['ar', 'rtl'])
    const out = html(el('p', null, findAll(tree, (e) => e.type === DialogDescription)[0].props.children as never))
    expect(out).toContain('<strong lang="" dir="auto">أمينة</strong>')
  })
})

describe('the Community insights card', () => {
  async function generate(locale: Locale) {
    const c = mount(() => CommunitySummarySection({ locale }))
    let tree = c.tree()
    const button = findAll(tree, (e) => e.type === 'button')[0]
    ;(button.props.onClick as () => void)()
    tree = await c.flush()
    return html(tree)
  }

  it('Korean: marked ko; the model-written themes marked English; count and time in Korean', async () => {
    const out = await generate('ko')
    expect(out).toMatch(/^<div lang="ko" dir="ltr"/)
    expect(out).toContain('<span lang="en" dir="ltr" class="rounded-full bg-lime-100')
    expect(out).toContain('<p lang="en" dir="ltr" class="text-sm text-stone-700">Members ask for food.</p>')
    const text = markupText(out)
    expect(text).toContain(moderationCount(THEME_POSTS, 1200, 'ko'))
    expect(text).toContain(adminModerationT('ko', 'insightsTitle'))
    expect(text).toContain(adminModerationT('ko', 'insightsRefresh'))
    expect(text).toMatch(/마지막 업데이트: (오전|오후)/)
  })
})

describe('the admin error screens', () => {
  it('Korean error card: lang="ko", Korean title and Try again', () => {
    h.language = 'ko'
    const out = html(el(AdminError, { error: Object.assign(new Error('x'), { digest: 'd1' }), reset: () => {} }))
    expect(out).toMatch(/lang="ko" dir="ltr"/)
    expect(markupText(out)).toContain(adminModerationT('ko', 'errorTitle'))
    expect(markupText(out)).toContain('참조: d1')
    expect(markupText(out)).toContain(messages.ko.tryAgain)
  })

  it('Arabic not-found card is right-to-left', () => {
    h.language = 'ar'
    const out = html(el(AdminNotFound))
    expect(out).toMatch(/lang="ar" dir="rtl"/)
    expect(markupText(out)).toContain(adminModerationT('ar', 'notFoundTitle'))
  })
})

describe('contrast on the lines this wave touched', () => {
  // stone-300 / 400 text and lime-600 button fills are under 4.5:1 on white (stone-500 is 4.8:1 on
  // white, used only there); the theme's destructive red is 3.6:1 (post-moderation-actions.ts).
  const LOW = /\btext-stone-(300|400)\b|\bbg-lime-600\b|\btext-destructive\b|\btext-red-600\b|placeholder:text-stone-400/

  it('People, the reports queue (with its failure line) and the insights card use 4.5:1 colours', async () => {
    const people = mount(() => PeopleTab({ viewerTier: 'platform_admin', isFounder: true, locale: 'ko' }))
    const peopleHtml = html(await people.flush())
    const queue = (await openQueue('ko')).tree
    h.reportsError = { code: '42501', message: 'denied' }
    const failed = await mount(() => ReportsQueue({ locale: 'ko' })).flush()
    const card = mount(() => CommunitySummarySection({ locale: 'ko' }))
    for (const out of [peopleHtml, html(queue), html(failed), html(card.tree())]) expect(out).not.toMatch(LOW)
  })
})

// ---------------------------------------------------------------------------------------------
// Label in Name, 14 locales
// ---------------------------------------------------------------------------------------------

describe('Label in Name', () => {
  it.each(LOCALES)('%s: the linked post — View post link, action buttons, close button', (l) => {
    const out = focusedHtml(l)
    const link = /<a [^>]*aria-label="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(out)!
    expect(markupText(link[1]).startsWith(markupText(link[2]))).toBe(true)
    expect(markupText(link[2])).toBe(adminModerationT(l, 'viewPost'))
    // The action buttons are named by their visible words (no aria-label overrides them).
    for (const action of ['remove', 'hold'] as PostModerationAction[]) {
      const button = new RegExp(`<button[^>]*data-testid="focused-${action}-post"[^>]*>`).exec(out)![0]
      expect(button).not.toContain('aria-label')
    }
    expect(out).toContain(`aria-label="${adminModerationT(l, 'focusClose')}"`)
  })

  it.each(LOCALES)('%s: People — the search and reason boxes are named by their visible labels; the select by its column', async (l) => {
    const c = mount(() => PeopleTab({ viewerTier: 'platform_admin', isFounder: true, locale: l }))
    const tree = await c.flush()
    // A visible <label for> each box (it stays when typing starts); no placeholder stands in for it.
    for (const [type, key] of [['input', 'searchLabel'], ['textarea', 'reasonLabel']] as const) {
      const box = findAll(tree, (e) => e.type === type)[0]
      const label = findAll(tree, (e) => e.type === 'label' && e.props.htmlFor === box.props.id)
      expect(label, type).toHaveLength(1)
      expect(label[0].props.children).toBe(adminPeopleT(l, key))
      expect(box.props.placeholder).toBeUndefined()
      expect(box.props['aria-label']).toBeUndefined()
    }
    const header = markupText(html(findAll(tree, (e) => e.props.children === adminPeopleT(l, 'colSetTier'))[0]))
    const select = findAll(tree, (e) => e.type === 'select')[0]
    expect(String(select.props['aria-label']).startsWith(header)).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------
// Behaviour unchanged: the same calls in every language
// ---------------------------------------------------------------------------------------------

const REPLIES: Record<string, () => void> = {
  ok: () => {},
  conflict: () => (h.rpcReply = { data: null, error: { code: 'PT409', message: 'post_version_conflict', details: '{"current_version":8,"needs_review":true}' } }),
  gone: () => (h.rpcReply = { data: null, error: { code: 'PT404', message: 'post_deleted' } }),
  self: () => (h.rpcReply = { data: null, error: { code: '42501', message: 'self_moderation_refused' } }),
  refused: () => (h.rpcReply = { data: null, error: { code: '42501', message: 'p3_denied:insufficient_tier' } }),
  network: () => (h.rpcThrow = true),
}

describe('the moderation calls are the same in every language', () => {
  it('Remove (ok) sends exactly what develop sends: the RPC, its arguments, the header and the rows', async () => {
    await moderatePost(client as never, 'remove', POST, 7, 'ko')
    expect(record()).toEqual({
      rpc: [{ fn: 'admin_remove_post', args: { p_post_id: POST, p_expected_version: 7 }, header: ['x-request-id', 'RID'] }],
      metric: [{ op: 'admin.post.remove', attrs: { action: 'post.remove', target_id: POST, request_id: 'RID' }, ok: true }],
      warn: [],
      info: [],
    })
  })

  it.each((['remove', 'hold', 'authorize'] as const).flatMap((a) => Object.keys(REPLIES).map((r) => [a, r] as const)))(
    '%s / %s: every locale makes the same calls and gets the same outcome as English, in its own words',
    async (action, reply) => {
      REPLIES[reply]()
      const en = await moderatePost(client as never, action, POST, 7, 'en')
      const baseline = record()
      expect(baseline.rpc).toHaveLength(1)
      for (const l of LOCALES) {
        resetCalls()
        const r = await moderatePost(client as never, action, POST, 7, l)
        expect(record(), l).toEqual(baseline)
        const flags = { ...r, message: undefined }
        const enFlags = { ...en, message: undefined }
        expect(flags, l).toEqual(enFlags)
        if (!r.ok) {
          const key = reply === 'conflict' ? 'failConflict' : reply === 'gone' ? 'failGone' : reply === 'self' ? 'failSelf' : 'errorGeneric'
          expect(r.message, l).toBe(adminModerationT(l, key))
        }
      }
    },
  )

  it('Dismiss in the queue sends the same admin_resolve_report call in Korean, Arabic and English', async () => {
    const runs = []
    for (const l of ['en', 'ko', 'ar'] as Locale[]) {
      const { c, tree } = await openQueue(l)
      resetCalls()
      ;(findAll(tree, (e) => e.props['data-testid'] === 'dismiss-report-r1')[0].props.onClick as () => void)()
      await c.flush()
      runs.push(record())
    }
    expect(runs[0].rpc).toEqual([{ fn: 'admin_resolve_report', args: { p_report_id: 'r1', p_action: 'dismiss', p_expected_version: 7 }, header: ['x-request-id', 'RID'] }])
    expect(runs[1]).toEqual(runs[0])
    expect(runs[2]).toEqual(runs[0])
  })

  it('a tier change sends the same admin_set_tier call and admin.tier.set row in Korean and English', async () => {
    h.rpcReply = { data: { ok: true }, error: null }
    const runs = []
    for (const l of ['en', 'ko'] as Locale[]) {
      const c = mount(() => PeopleTab({ viewerTier: 'platform_admin', isFounder: true, locale: l }))
      let tree = await c.flush()
      ;(findAll(tree, (e) => e.type === 'select')[0].props.onChange as (e: unknown) => void)({ target: { value: 'community_moderator' } })
      tree = c.rerender()
      ;(findAll(tree, (e) => e.type === 'textarea')[0].props.onChange as (e: unknown) => void)({ target: { value: 'Trusted helper' } })
      tree = c.rerender()
      resetCalls()
      const apply = findAll(tree, (e) => e.props['data-testid'] === 'people-apply')[0]
      ;(apply.props.onClick as () => void)()
      await c.flush()
      runs.push(record())
    }
    expect(runs[0].rpc[0]).toEqual({ fn: 'admin_set_tier', args: { p_target: 'p1', p_tier: 'community_moderator', p_reason: 'Trusted helper' }, header: ['x-request-id', 'RID'] })
    expect(runs[0].info.filter(([n]: [string]) => n === 'admin.tier.set')).toHaveLength(1)
    expect(runs[1]).toEqual(runs[0])
  })
})

// ---------------------------------------------------------------------------------------------
// Diagnostics: one row per failure, code only
// ---------------------------------------------------------------------------------------------

const loggedText = () => JSON.stringify(warn())

describe('each failure that shows a translated line writes exactly one row with its code', () => {
  it('the reports read is refused: one admin.reports.load_failed with the PostgREST code, no message', async () => {
    h.reportsError = { code: '42501', message: 'permission denied near "Amina"' }
    const c = mount(() => ReportsQueue({ locale: 'ko' }))
    const tree = await c.flush()
    expect(warn()).toEqual([['admin.reports.load_failed', { code: '42501' }]])
    expect(loggedText()).not.toContain('Amina')
    expect(markupText(html(tree))).toContain(adminModerationT('ko', 'loadFailed'))
  })

  it('the reports read throws: the row carries the error class', async () => {
    h.reportsThrow = true
    const c = mount(() => ReportsQueue({ locale: 'ko' }))
    await c.flush()
    expect(warn()).toEqual([['admin.reports.load_failed', { code: 'TypeError' }]])
    expect(loggedText()).not.toContain('Amina')
  })

  it('a moderation call fails on the network: withMetric’s one error row and admin.denied — nothing added', async () => {
    h.rpcThrow = true
    const r = await moderatePost(client as never, 'hold', POST, 7, 'ko')
    expect(r).toEqual({ ok: false, message: adminModerationT('ko', 'errorGeneric') })
    expect(h.metric).toEqual([expect.objectContaining({ op: 'admin.post.hold', ok: false, error: 'TypeError' })])
    expect(warn()).toEqual([['admin.denied', { action: 'post.hold', code: 'unknown', request_id: expect.any(String) }]])
  })

  it('the call throws before any request exists: one admin.denied with the error class', async () => {
    h.throwBeforeRpc = true
    const r = await moderatePost(client as never, 'remove', POST, 7, 'ko')
    expect(r).toEqual({ ok: false, message: adminModerationT('ko', 'errorGeneric') })
    expect(h.metric).toEqual([])
    expect(warn()).toEqual([['admin.denied', { action: 'post.remove', code: 'RangeError' }]])
  })

  async function insights() {
    const c = mount(() => CommunitySummarySection({ locale: 'ko' }))
    ;(findAll(c.tree(), (e) => e.type === 'button')[0].props.onClick as () => void)()
    return markupText(html(await c.flush()))
  }

  it('insights — the posts read is refused: the PostgREST code', async () => {
    h.postsError = { code: 'PGRST301', message: 'JWT expired for Amina' }
    const text = await insights()
    expect(warn()).toEqual([['admin.community.insights_failed', { code: 'PGRST301' }]])
    expect(loggedText()).not.toContain('Amina')
    expect(text).toContain(adminModerationT('ko', 'insightsFailed'))
  })

  it('insights — the route answers 500: code http with the status; its reply is neither shown nor logged', async () => {
    h.fetchMode = 'http500'
    const text = await insights()
    expect(warn()).toEqual([['admin.community.insights_failed', { code: 'http', status: 500 }]])
    expect(loggedText()).not.toContain('Amina')
    expect(text).not.toContain('Amina')
  })

  it('insights — the request throws: the error class', async () => {
    h.fetchMode = 'throw'
    await insights()
    expect(warn()).toEqual([['admin.community.insights_failed', { code: 'TypeError' }]])
  })
})

// ---------------------------------------------------------------------------------------------
// Keyboard and screen reader: never lose your place, always hear the result (PR #254 fix round)
// ---------------------------------------------------------------------------------------------

const runFrames = () => {
  const frames = h.frames.splice(0)
  for (const f of frames) f()
}
const byTestId = (tree: unknown, id: string) => findAll(tree, (e) => e.props['data-testid'] === id)
const textOf = (tree: unknown, id: string) => byTestId(tree, id)[0]?.props.children

describe('the People tab keeps the admin’s place (B1, B2, H2)', () => {
  async function openDialog(locale: Locale = 'ko') {
    const c = mount(() => PeopleTab({ viewerTier: 'platform_admin', isFounder: true, locale }))
    let tree = await c.flush()
    ;(findAll(tree, (e) => e.type === 'select')[0].props.onChange as (e: unknown) => void)({ target: { value: 'community_moderator' } })
    tree = c.rerender()
    return { c, tree }
  }
  const type = (c: ReturnType<typeof mount>, text: string) => {
    ;(findAll(c.tree(), (e) => e.type === 'textarea')[0].props.onChange as (e: unknown) => void)({ target: { value: text } })
    return c.rerender()
  }
  const apply = (tree: unknown) => (byTestId(tree, 'people-apply')[0].props.onClick as () => void)()

  it('the loading line is the first load’s only: during the re-read after a change the rows stay', async () => {
    const first = mount(() => PeopleTab({ viewerTier: 'platform_admin', isFounder: true, locale: 'ko' }))
    expect(textOf(first.tree(), 'people-status')).toBe(adminPeopleT('ko', 'loading'))
    h.rpcReply = { data: { ok: true }, error: null }
    const { c } = await openDialog()
    let tree = type(c, 'Trusted helper')
    h.holdList = true
    apply(tree)
    tree = await c.flush()
    expect(h.release).not.toBeNull() // the re-read is in flight…
    expect(findAll(tree, (e) => e.type === 'select')).toHaveLength(1) // …and the row is still there
    expect(textOf(tree, 'people-status')).not.toBe(adminPeopleT('ko', 'loading'))
    h.release!()
    tree = await c.flush()
    expect(findAll(tree, (e) => e.type === 'select')).toHaveLength(1)
  })

  it('a successful change announces "Tier updated" in the always-mounted status, and focus returns to the row’s select', async () => {
    h.rpcReply = { data: { ok: true }, error: null }
    const { c } = await openDialog()
    let tree = type(c, 'Trusted helper')
    const status = byTestId(tree, 'people-status')
    expect(status).toHaveLength(1)
    expect(status[0].props.role).toBe('status')
    const select = { focus: vi.fn() }
    ;(findAll(tree, (e) => e.type === 'select')[0].props.ref as (n: unknown) => void)(select)
    apply(tree)
    tree = await c.flush()
    const content = findAll(tree, (e) => e.type === DialogContent)[0]
    const preventDefault = vi.fn()
    ;(content.props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault })
    expect(select.focus).toHaveBeenCalledTimes(1)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(textOf(c.rerender(), 'people-status')).toBe(adminPeopleT('ko', 'tierUpdated'))
  })

  it('Cancel also returns focus to the row’s select', async () => {
    const { c, tree } = await openDialog()
    const select = { focus: vi.fn() }
    ;(findAll(tree, (e) => e.type === 'select')[0].props.ref as (n: unknown) => void)(select)
    ;(findAll(tree, (e) => e.type === 'button' && e.props.children === adminPeopleT('ko', 'cancel'))[0].props.onClick as () => void)()
    const after = c.rerender()
    ;(findAll(after, (e) => e.type === DialogContent)[0].props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault: () => {} })
    expect(select.focus).toHaveBeenCalledTimes(1)
  })

  it('a refusal shows inside the open dialog, in its always-mounted alert; the dialog stays open', async () => {
    h.rpcReply = { data: { ok: false, code: 'self' }, error: null }
    const { c } = await openDialog()
    let tree = type(c, 'Trusted helper')
    const before = byTestId(tree, 'people-dialog-alert')
    expect(before).toHaveLength(1)
    expect([before[0].props.role, before[0].props.children]).toEqual(['alert', ''])
    apply(tree)
    tree = await c.flush()
    expect(findAll(tree, (e) => e.type === Dialog)[0].props.open).toBe(true)
    const content = findAll(tree, (e) => e.type === DialogContent)[0]
    const alert = byTestId(content, 'people-dialog-alert')
    expect(alert).toHaveLength(1)
    expect(alert[0].props.children).toBe(denialText('self', 'ko'))
    // No other alert on the tab carries it.
    expect(findAll(tree, (e) => e.props.role === 'alert' && e.props['data-testid'] !== 'people-dialog-alert' && e.props.children !== '')).toHaveLength(0)
  })

  it('a failed call shows its line in the same alert', async () => {
    h.rpcReply = { data: null, error: { code: '500', message: 'boom' } }
    const { c } = await openDialog()
    const tree = type(c, 'x')
    apply(tree)
    expect(textOf(await c.flush(), 'people-dialog-alert')).toBe(adminPeopleT('ko', 'changeFailed'))
  })

  it('the reason is required (required + aria-required) and Apply stays focusable (aria-disabled, no disabled)', async () => {
    const { tree } = await openDialog()
    const reason = findAll(tree, (e) => e.type === 'textarea')[0]
    expect([reason.props.required, reason.props['aria-required']]).toEqual([true, 'true'])
    const button = byTestId(tree, 'people-apply')[0]
    expect(button.props.disabled).toBeUndefined()
    expect(button.props['aria-disabled']).toBe(true)
  })

  it('the search box, tier select and reason box have 3:1 borders (stone-500)', async () => {
    const { tree } = await openDialog()
    for (const type of ['input', 'select', 'textarea']) {
      expect(String(findAll(tree, (e) => e.type === type)[0].props.className), type).toMatch(/\bborder-stone-500\b/)
    }
  })

  it('a whitespace reason keeps Apply inactive and makes no RPC', async () => {
    const { c } = await openDialog()
    const tree = type(c, '   \n ')
    expect(byTestId(tree, 'people-apply')[0].props['aria-disabled']).toBe(true)
    resetCalls()
    apply(tree)
    await c.flush()
    expect(h.rpcCalls.filter((r) => r.fn === 'admin_set_tier')).toHaveLength(0)
  })

  it('two quick presses of Apply send one admin_set_tier', async () => {
    h.rpcReply = { data: { ok: true }, error: null }
    const { c } = await openDialog()
    const tree = type(c, 'Trusted helper')
    resetCalls()
    apply(tree)
    apply(tree)
    await c.flush()
    expect(h.rpcCalls.filter((r) => r.fn === 'admin_set_tier')).toHaveLength(1)
  })

  it('the dialog keeps its text while it closes (the last pending action)', async () => {
    h.rpcReply = { data: { ok: true }, error: null }
    const { c } = await openDialog()
    let tree = type(c, 'Trusted helper')
    apply(tree)
    tree = await c.flush()
    expect(findAll(tree, (e) => e.type === Dialog)[0].props.open).toBe(false)
    expect(findAll(tree, (e) => e.type === DialogTitle)[0].props.children).toBe(grantOptionLabel({ value: 'community_moderator', label: '' }, 'ko'))
  })
})

describe('the reports queue keeps the admin’s place (B3, H1)', () => {
  it('next place to stand: the card stays, the next card, the Removed & Held heading, or the empty heading', () => {
    const g = (id: string, ...reports: string[]) => ({ content_id: id, reports: reports.map((r) => ({ id: r })) })
    expect(focusAfterRemoval([g('a', 'r1', 'r2')], [], { report: 'r1', group: 'a' })).toEqual({ kind: 'toggle', id: 'a' })
    expect(focusAfterRemoval([g('a', 'r1'), g('b', 'r2')], [], { report: 'r1', group: 'a' })).toEqual({ kind: 'toggle', id: 'b' })
    expect(focusAfterRemoval([g('a', 'r1'), g('b', 'r2')], [], { group: 'a' })).toEqual({ kind: 'toggle', id: 'b' })
    expect(focusAfterRemoval([g('a', 'r1'), g('b', 'r2')], [], { group: 'b' })).toEqual({ kind: 'held' })
    expect(focusAfterRemoval([g('a', 'r1')], ['h1'], { group: 'a' })).toEqual({ kind: 'held' })
    expect(focusAfterRemoval([g('a', 'r1')], [], { group: 'a' })).toEqual({ kind: 'empty' })
    expect(focusAfterRemoval([], ['h1', 'h2'], { held: 'h1' })).toEqual({ kind: 'held' })
    expect(focusAfterRemoval([], ['h1'], { held: 'h1' })).toEqual({ kind: 'empty' })
  })

  it('Dismiss → the card’s toggle; Remove → Removed & Held heading; Authorize the last → empty heading; each result announced', async () => {
    const { c, tree: t0 } = await openQueue('ko')
    const status0 = byTestId(t0, 'reports-queue-status')
    expect(status0).toHaveLength(1)
    expect(status0[0].props.role).toBe('status')
    const toggle = { focus: vi.fn() }
    ;(byTestId(t0, `toggle-reports-${POST}`)[0].props.ref as (n: unknown) => void)(toggle)

    ;(byTestId(t0, 'dismiss-report-r1')[0].props.onClick as () => void)()
    let tree = await c.flush()
    runFrames()
    expect(toggle.focus).toHaveBeenCalledTimes(1)
    expect(textOf(tree, 'reports-queue-status')).toBe(adminModerationT('ko', 'doneDismiss'))

    const held = { focus: vi.fn() }
    ;(byTestId(tree, 'reports-queue-held-heading')[0].props.ref as { current: unknown }).current = held
    ;(byTestId(tree, `remove-post-${POST}`)[0].props.onClick as () => void)()
    tree = await c.flush()
    runFrames()
    expect(held.focus).toHaveBeenCalledTimes(1)
    expect(textOf(tree, 'reports-queue-status')).toBe(adminModerationT('ko', 'doneRemove'))

    ;(byTestId(tree, `authorize-post-${HELD}`)[0].props.onClick as () => void)()
    tree = await c.flush()
    const empty = { focus: vi.fn() }
    ;(byTestId(tree, 'reports-queue-empty-heading')[0].props.ref as { current: unknown }).current = empty
    runFrames()
    expect(empty.focus).toHaveBeenCalledTimes(1)
    expect(byTestId(tree, 'reports-queue-empty-heading')[0].props.tabIndex).toBe(-1)
    // The same status region, still mounted in the empty state, carries the last result.
    expect(textOf(tree, 'reports-queue-status')).toBe(adminModerationT('ko', 'doneAuthorize'))
  })

  it('one status and one alert in every state', async () => {
    const loading = mount(() => ReportsQueue({ locale: 'ko' })).tree()
    const full = (await openQueue('ko')).tree
    h.emptyQueue = true
    const empty = await mount(() => ReportsQueue({ locale: 'ko' })).flush()
    for (const tree of [loading, full, empty]) {
      expect(findAll(tree, (e) => e.props.role === 'status')).toHaveLength(1)
      expect(findAll(tree, (e) => e.props.role === 'alert')).toHaveLength(1)
    }
    expect(textOf(loading, 'reports-queue-status')).toBe(adminModerationT('ko', 'loadingReports'))
  })

  it('an empty, successful read shows the empty heading and an empty alert', async () => {
    h.emptyQueue = true
    const tree = await mount(() => ReportsQueue({ locale: 'ko' })).flush()
    expect(markupText(html(tree))).toContain(adminModerationT('ko', 'emptyTitle'))
    expect(textOf(tree, 'reports-queue-error')).toBe('')
  })

  it('a refused action keeps the row and says why in the alert; nothing is announced as done', async () => {
    h.rpcReply = { data: null, error: { code: '42501', message: 'denied' } }
    const { c, tree: t0 } = await openQueue('ko')
    ;(byTestId(t0, `remove-post-${POST}`)[0].props.onClick as () => void)()
    const tree = await c.flush()
    runFrames()
    expect(textOf(tree, 'reports-queue-error')).toBe(adminModerationT('ko', 'errorGeneric'))
    expect(textOf(tree, 'reports-queue-status')).toBe('')
    expect(byTestId(tree, `remove-post-${POST}`)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------------------------
// Round 2 (PR #254): "Tier updated" once, after close AND re-read; a queue-driven re-read leaves
// the linked post's status still; each card toggle is described by its post
// ---------------------------------------------------------------------------------------------

describe('"Tier updated" is announced once, after the dialog has closed and the re-read has finished', () => {
  async function grant() {
    h.rpcReply = { data: { ok: true }, error: null }
    const c = mount(() => PeopleTab({ viewerTier: 'platform_admin', isFounder: true, locale: 'ko' }))
    let tree = await c.flush()
    ;(findAll(tree, (e) => e.type === 'select')[0].props.onChange as (e: unknown) => void)({ target: { value: 'community_moderator' } })
    tree = c.rerender()
    ;(findAll(tree, (e) => e.type === 'textarea')[0].props.onChange as (e: unknown) => void)({ target: { value: 'Trusted helper' } })
    tree = c.rerender()
    h.holdList = true
    ;(byTestId(tree, 'people-apply')[0].props.onClick as () => void)()
    tree = await c.flush()
    expect(h.release).not.toBeNull()
    return c
  }
  const closeDone = (c: ReturnType<typeof mount>) =>
    (findAll(c.tree(), (e) => e.type === DialogContent)[0].props.onCloseAutoFocus as (e: unknown) => void)({ preventDefault: () => {} })
  /** Every distinct text the status region showed, in order (one entry per change). */
  function watchStatus(c: ReturnType<typeof mount>) {
    const seen: string[] = []
    const look = () => {
      const t = String(textOf(c.tree(), 'people-status') ?? '')
      if (t !== (seen.at(-1) ?? '')) seen.push(t)
    }
    return { seen, look }
  }
  const updated = adminPeopleT('ko', 'tierUpdated')

  it('the re-read finishes first, then the dialog closes: announced once, at the close', async () => {
    const c = await grant()
    const { seen, look } = watchStatus(c)
    look()
    h.release!()
    await c.flush()
    look()
    expect(textOf(c.tree(), 'people-status')).toBe('') // re-read done, dialog still closing: silent
    closeDone(c)
    c.rerender()
    look()
    await c.flush()
    look()
    expect(seen.filter((t) => t === updated)).toHaveLength(1)
    expect(textOf(c.tree(), 'people-status')).toBe(updated)
  })

  it('the dialog closes first, then the re-read finishes: announced once, at the re-read', async () => {
    const c = await grant()
    const { seen, look } = watchStatus(c)
    closeDone(c)
    c.rerender()
    look()
    expect(textOf(c.tree(), 'people-status')).toBe('') // closed, list still re-reading: silent
    h.release!()
    await c.flush()
    look()
    // A second close event (Radix may fire focus handling again) announces nothing new.
    closeDone(c)
    c.rerender()
    look()
    expect(seen.filter((t) => t === updated)).toHaveLength(1)
    expect(textOf(c.tree(), 'people-status')).toBe(updated)
  })

  it('after one announced grant, opening and cancelling the dialog again announces nothing (the grant is spent)', async () => {
    const c = await grant()
    h.release!()
    await c.flush()
    closeDone(c)
    expect(textOf(c.rerender(), 'people-status')).toBe(updated)
    ;(findAll(c.tree(), (e) => e.type === 'select')[0].props.onChange as (e: unknown) => void)({ target: { value: 'community_moderator' } })
    expect(textOf(c.rerender(), 'people-status')).toBe('')
    ;(findAll(c.tree(), (e) => e.type === 'button' && e.props.children === adminPeopleT('ko', 'cancel'))[0].props.onClick as () => void)()
    c.rerender()
    closeDone(c)
    expect(textOf(c.rerender(), 'people-status')).toBe('')
  })

  it('a Cancel close never announces', async () => {
    const c = mount(() => PeopleTab({ viewerTier: 'platform_admin', isFounder: true, locale: 'ko' }))
    let tree = await c.flush()
    ;(findAll(tree, (e) => e.type === 'select')[0].props.onChange as (e: unknown) => void)({ target: { value: 'community_moderator' } })
    tree = c.rerender()
    ;(findAll(tree, (e) => e.type === 'button' && e.props.children === adminPeopleT('ko', 'cancel'))[0].props.onClick as () => void)()
    c.rerender()
    closeDone(c)
    expect(textOf(c.rerender(), 'people-status')).toBe('')
  })

  it('a failed re-read after a successful grant keeps the rows (the select survives) and still announces once', async () => {
    const c = await grant()
    h.listError = true // the held re-read answers with an error
    closeDone(c)
    h.release!()
    await c.flush()
    const tree = c.tree()
    expect(findAll(tree, (e) => e.type === 'select')).toHaveLength(1)
    expect(textOf(tree, 'people-status')).toBe(updated)
    expect(warn()).toContainEqual(['admin.people.list_failed', { code: '57014' }])
  })
})

describe('a re-read the queue triggers leaves the linked post’s status region still', () => {
  it('after its own Remove the panel says so; a later queue-driven re-read does not change that text', async () => {
    h.focusSession = true
    h.focusRow = { ...FOUND, author: null }
    const c = mount(() => FocusedPost({ reloadKey: h.reloadKey, locale: 'ko' }))
    let tree = await c.flush()
    const status = () => markupText(html(c.tree()).match(/<p role="status"[^>]*>([\s\S]*?)<\/p>/)![1])
    expect(status()).toContain(adminModerationT('ko', 'statusVisible'))
    ;((tree as ReactElement<{ onAction: (a: PostModerationAction) => void }>).props.onAction)('remove')
    tree = await c.flush()
    const afterAction = status()
    expect(afterAction).toContain(adminModerationT('ko', 'doneRemove'))
    // The queue below acted on another post: the panel re-reads (its post comes back held).
    h.focusRow = { ...FOUND, author: null, is_hidden: true, hidden_reason: 'hold_for_review' }
    h.reloadKey += 1
    c.rerender()
    await c.flush()
    expect(status()).toBe(afterAction)
    // Its actions follow the re-read post (a held post offers Authorize).
    expect(html(c.tree())).toContain('data-testid="focused-authorize-post"')
  })
})

describe('each card’s Report details toggle is described by its post', () => {
  it('aria-describedby names the card’s excerpt, which exists', async () => {
    const { tree } = await openQueue('ko')
    const toggle = byTestId(tree, `toggle-reports-${POST}`)[0]
    expect(toggle.props['aria-describedby']).toBe(`report-excerpt-${POST}`)
    expect(findAll(tree, (e) => e.props.id === `report-excerpt-${POST}`)).toHaveLength(1)
  })
})
