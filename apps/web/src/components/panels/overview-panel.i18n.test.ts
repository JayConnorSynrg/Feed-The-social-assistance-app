// apps/web/src/components/panels/overview-panel.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A member whose language is set reads Home (the Overview panel) in that language:
//   - the welcome line (the member's own name keeps its own direction), the date, the seven quick
//     actions, recent activity and reminders; the panel marked with the language, Arabic rtl;
//   - the date is Intl's for a language with data and FEED's own words for Haitian Creole;
//   - Label in Name: each quick action is named by its visible title first;
//   - an activity line puts the post's own words in their own element, and its age is in the
//     member's language; a failed read shows the member's sentence, never the raw server text.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const { state } = vi.hoisted(() => ({
  state: { language: 'ko', posts: [] as unknown[], likes: [] as unknown[], fail: null as Error | null },
}))
// Stable objects, as the real hook and client are (the panel's read effect depends on them).
const { me, client } = vi.hoisted(() => ({ me: { id: 'me' }, client: { current: null as unknown } }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: me, profile: { preferred_language: state.language } }) }))
vi.mock('@/lib/supabase/client', () => {
  const chain = (table: string) => {
    const result = () => (state.fail ? Promise.reject(state.fail) : Promise.resolve({ data: table === 'posts' ? state.posts : state.likes }))
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order']) q[m] = () => q
    // .limit() is awaited directly (likes) or after .abortSignal() (posts).
    // The result is made only when awaited, so an unused branch leaves no unhandled rejection.
    q.limit = () => ({ then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => result().then(ok, ko), abortSignal: () => result() })
    return q
  }
  client.current = { from: chain }
  return { createClient: () => client.current }
})
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn() }))
vi.mock('@/lib/event-time', async (orig) => ({ ...(await orig<object>()), browserTimeZone: () => 'America/New_York' }))

import { mount, findAll } from '@/test/mini-react'
import { messages, type Locale } from '@/lib/i18n'
import { overviewT } from '@/lib/i18n-overview'
import { relativeAge } from '@/lib/relative-age'
import { OverviewPanel } from './overview-panel'

const LOCALES = Object.keys(messages) as Locale[]
const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim()
const NOW = new Date('2026-10-08T16:00:00Z') // a Thursday in New York

function html(language: string, userName?: string) {
  state.language = language
  return renderToStaticMarkup(h(OverviewPanel, { userName }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  Object.assign(state, { posts: [], likes: [], fail: null })
})
afterEach(() => vi.useRealTimers())

describe('Home in the member’s language', () => {
  it('Korean: welcome, quick actions, sections; marked ko; the name keeps its own direction', () => {
    const out = html('ko', 'مريم')
    expect(out.startsWith('<div lang="ko" dir="ltr"')).toBe(true)
    expect(out).toContain('다시 오신 것을 환영합니다, <bdi lang="" dir="auto">مريم</bdi>님!')
    for (const key of ['quickActions', 'findResourcesTitle', 'applyBody', 'recentActivity', 'upcomingReminders', 'noReminders', 'loadingActivity'] as const) {
      expect(out).toContain(overviewT('ko', key))
    }
    expect(out).not.toContain('lang="en"')
    expect(out).not.toMatch(/Welcome back|Quick Actions|Recent Activity/)
  })

  it('without a name, the welcome greets in the member’s own word for "friend"', () => {
    expect(html('es')).toContain('¡Hola de nuevo, amigo!')
  })

  it('the date: Intl for Korean, FEED’s own words for Haitian Creole', () => {
    expect(html('ko')).toContain('2026년 10월 8일 목요일')
    const ht = html('ht')
    expect(ht).toMatch(/jedi/)
    expect(ht).toMatch(/oktòb/)
    expect(ht).not.toMatch(/Thursday|October/)
  })

  it('Arabic: right-to-left', () => {
    expect(html('ar').startsWith('<div lang="ar" dir="rtl"')).toBe(true)
  })

  it.each(LOCALES)('%s: Label in Name — each quick action is named by its title first', (locale) => {
    const out = html(locale)
    const cards = [...out.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)]
    expect(cards).toHaveLength(7)
    const titles = ['findResourcesTitle', 'assistantTitle', 'programsTitle', 'wizardTitle', 'applicationsTitle', 'documentsTitle', 'applyTitle'] as const
    cards.forEach(([, attrs, inner], i) => {
      expect(attrs).not.toMatch(/aria-label=/)
      expect(strip(inner).startsWith(strip(overviewT(locale, titles[i])))).toBe(true)
    })
  })
})

describe('recent activity', () => {
  async function items(language: string) {
    state.language = language
    const m = mount(() => OverviewPanel({}))
    await m.flush()
    return findAll(m.tree(), (el) => typeof el.type === 'function' && (el.type as { name?: string }).name === 'RecentActivityItem')
  }

  it('Korean: the post’s words in their own element, the age in Korean', async () => {
    state.posts = [{ id: 'p1', content: 'شكرا للجميع', created_at: '2026-10-08T15:55:00Z' }]
    state.likes = [{ post_id: 'p2', created_at: '2026-10-08T13:00:00Z', post: null }]
    const [posted, liked] = await items('ko')
    const a = renderToStaticMarkup(posted as ReactElement)
    expect(a).toContain('게시함: “<bdi lang="" dir="auto">شكرا للجميع</bdi>”')
    expect(a).toContain(relativeAge('2026-10-08T15:55:00Z', 'ko'))
    expect(renderToStaticMarkup(liked as ReactElement)).toContain(overviewT('ko', 'activityLikedPost'))
  })

  it('a failed read shows the member’s sentence, not the server’s text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    state.fail = new Error('permission denied for table posts')
    state.language = 'fr'
    const m = mount(() => OverviewPanel({}))
    await m.flush()
    const alerts = findAll(m.tree(), (el) => el.props.role === 'alert')
    expect(alerts).toHaveLength(1)
    expect(alerts[0].props.children).toBe(overviewT('fr', 'activityFailed'))
  })
})
