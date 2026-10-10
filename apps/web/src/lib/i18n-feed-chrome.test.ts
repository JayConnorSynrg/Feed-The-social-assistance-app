// apps/web/src/lib/i18n-feed-chrome.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// R1 invariant 4 — members see the feed's heading, ordering toggle, filters, sub-tabs, guest prompt
// and loading / empty / error / load-more states in their language, and never the server's text:
//   - parity: the 14 locales, the same keys, nothing empty, translated (not English copies);
//   - the rendered chrome follows the locale (es, ar) and states which filter / order is on;
//   - a failed read shows the translated sentence for its kind, whatever the server said;
//   - feed-panel.tsx: the panel root carries lang + dir, the tabs and prompt come from the
//     dictionary, no English chrome literal is left, and the raw error text path is gone.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { messages, type Locale } from './i18n'
import { feedChromeMessages, feedChromeT, type FeedChromeMessages } from './i18n-feed-chrome'
import { FeedHeader, FeedListStatus, FeedLoadMore, FeedStatusRegions, feedStatusAnnouncement, nextTabIndex } from '@/components/feed/feed-chrome'

const LOCALES = Object.keys(messages) as Locale[]
const EN_KEYS = Object.keys(feedChromeMessages.en).sort()
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

describe('feedChromeMessages parity', () => {
  it('covers exactly the 14 locales', () => {
    expect(LOCALES).toHaveLength(14)
    expect(Object.keys(feedChromeMessages).sort()).toEqual([...LOCALES].sort())
  })

  it.each(LOCALES)('%s: same keys, non-empty, same {placeholders}', (locale) => {
    const dict = feedChromeMessages[locale] as unknown as Record<string, string>
    expect(Object.keys(dict).sort()).toEqual(EN_KEYS)
    for (const key of EN_KEYS as Array<keyof FeedChromeMessages>) {
      expect(dict[key].trim(), `${locale}.${key}`).not.toBe('')
      expect(placeholders(dict[key]), `${locale}.${key}`).toEqual(placeholders(feedChromeMessages.en[key]))
    }
  })

  it.each(LOCALES)('%s: the empty-state title ends a sentence (announced right before its second line, so it needs the pause)', (locale) => {
    expect(feedChromeMessages[locale].emptyTitle).toMatch(/[.。።!?！？]$/)
  })

  it('every non-English locale is translated (not an English copy) for the sentences a member reads', () => {
    const sentences: Array<keyof FeedChromeMessages> = ['feedTitle', 'guestPrompt', 'loadTimeout', 'loadFailed', 'loadingPosts', 'emptyTitle', 'emptyBody', 'loadMore', 'sectionsAria', 'filtersAria']
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      for (const key of sentences) expect(feedChromeT(locale, key), `${locale}.${key}`).not.toBe(feedChromeMessages.en[key])
    }
  })
})

describe('the chrome renders in the viewer language', () => {
  const header = (locale: Locale) =>
    renderToStaticMarkup(h(FeedHeader, { activeFilter: 'mine', onFilterChange: () => {}, rankMode: 'recent', onRankModeChange: () => {}, locale }))

  it('es: heading, ordering and filters; the active filter and order are announced as pressed', () => {
    const html = header('es')
    expect(html).toContain('>Publicaciones de la comunidad</h2>')
    expect(html).toContain('aria-label="Orden de las publicaciones"')
    expect(html).toContain('aria-label="Filtrar publicaciones"')
    expect(html).toMatch(/aria-pressed="true"[^>]*data-testid="feed-filter-mine"[^>]*>Mis publicaciones</)
    expect(html).toMatch(/aria-pressed="false"[^>]*data-testid="feed-filter-all"[^>]*>Todas</)
    expect(html).toMatch(/aria-pressed="true"[^>]*data-testid="feed-rankmode-recent"[^>]*>Recientes</)
    expect(html).not.toMatch(/>(All|Following|My Posts|Announcements|Ranked|Recent|Community Feed)</)
  })

  it('ar: Arabic copy (the panel root sets dir="rtl")', () => {
    expect(header('ar')).toContain('>منشورات المجتمع</h2>')
  })

  it('a timeout and any other failure each read as their translated sentence, with Retry', () => {
    const timeout = renderToStaticMarkup(h(FeedListStatus, { state: { kind: 'error', error: 'timeout' }, locale: 'en', onRetry: () => {}, focusTitle: () => {} }))
    expect(timeout).toMatch(/role="alert"[^>]*>Feed timed out — please check your connection and retry\.</)
    const failed = renderToStaticMarkup(h(FeedListStatus, { state: { kind: 'error', error: 'failed' }, locale: 'vi', onRetry: () => {}, focusTitle: () => {} }))
    expect(failed).toContain('>Hiện không thể tải bảng tin. Hãy thử lại.</p>')
    expect(failed).toContain('>Thử lại</button>')
  })

  it('loading, empty and Load more', () => {
    expect(renderToStaticMarkup(h(FeedListStatus, { state: { kind: 'loading' }, locale: 'fr', onRetry: () => {}, focusTitle: () => {} }))).toContain('Chargement des publications…')
    const empty = renderToStaticMarkup(h(FeedListStatus, { state: { kind: 'empty' }, locale: 'ko', onRetry: () => {}, focusTitle: () => {} }))
    expect(empty).toContain('표시할 게시물이 없습니다')
    expect(empty).toContain('가장 먼저 무언가를 공유해 보세요!')
    expect(renderToStaticMarkup(h(FeedLoadMore, { locale: 'pt', loading: false, onLoadMore: () => {} }))).toContain('>Carregar mais publicações</button>')
    expect(renderToStaticMarkup(h(FeedLoadMore, { locale: 'pt', loading: true, onLoadMore: () => {} }))).toContain('Carregando…')
  })
})

describe('announcements and keyboard (a11y fix round)', () => {
  const g = globalThis as unknown as { requestAnimationFrame?: unknown }
  afterEach(() => {
    delete g.requestAnimationFrame
  })
  type El = { type: unknown; props: Record<string, unknown> }
  const find = (node: unknown, type: string): El[] => {
    const out: El[] = []
    const walk = (n: unknown) => {
      if (Array.isArray(n)) return n.forEach(walk)
      const el = n as El | null
      if (!el || typeof el !== 'object' || !el.props) return
      if (el.type === type) out.push(el)
      walk(el.props.children)
    }
    walk(node)
    return out
  }

  it('the feed status region says the list is loading / empty; nothing for an error (its alert speaks)', () => {
    const say = (s: Partial<{ loading: boolean; error: boolean; empty: boolean }>, locale: Locale = 'en') =>
      feedStatusAnnouncement({ loading: false, error: false, empty: false, ...s }, locale)
    expect(say({ loading: true, empty: true })).toBe('Loading posts…')
    // The empty state is announced whole: its title and its second line.
    expect(say({ empty: true })).toBe('No posts to show. Be the first to share something!')
    expect(say({ empty: true }, 'es')).toBe('No hay publicaciones para mostrar. ¡Sé la primera persona en compartir algo!')
    expect(say({ error: true, empty: true, loading: true })).toBe('')
    expect(say({})).toBe('')
  })

  describe('the list status and the card notice are two regions — neither hides the other', () => {
    const regions = (p: Partial<{ ready: boolean; loading: boolean; error: boolean; empty: boolean; notice: string }>, locale: Locale = 'en') => {
      const html = renderToStaticMarkup(
        h(FeedStatusRegions, { ready: true, loading: false, error: false, empty: false, notice: '', locale, ...p }),
      )
      const text = (id: string) => html.match(new RegExp(`<p role="status" aria-live="polite" class="sr-only" data-testid="${id}">([^<]*)</p>`))?.[1]
      return { status: text('feed-status'), notice: text('feed-card-notice') }
    }

    it('"Changes saved.", then a filter that leaves nothing: the list region says the empty sentence, the notice region keeps the notice', () => {
      const r = regions({ empty: true, notice: 'Changes saved.' })
      expect(r).toEqual({ status: 'No posts to show. Be the first to share something!', notice: 'Changes saved.' })
      expect(r.status).not.toContain('Changes saved.')
    })

    it('a first-page reload right after a save: the list region says loading, the notice region is untouched', () => {
      expect(regions({ loading: true, empty: true, notice: 'Changes saved.' })).toEqual({ status: 'Loading posts…', notice: 'Changes saved.' })
    })

    it('both regions wait for the settled language (empty until ready)', () => {
      expect(regions({ ready: false, loading: true, notice: 'Changes saved.' })).toEqual({ status: '', notice: '' })
    })
  })

  it('the visible loading / empty copy is hidden from assistive tech (announced once, by the region)', () => {
    for (const kind of ['loading', 'empty'] as const) {
      const html = renderToStaticMarkup(h(FeedListStatus, { state: { kind }, locale: 'en', onRetry: () => {}, focusTitle: () => {} }))
      expect(html).toMatch(/^<div aria-hidden="true"/)
    }
    expect(renderToStaticMarkup(h(FeedListStatus, { state: { kind: 'error', error: 'failed' }, locale: 'en', onRetry: () => {}, focusTitle: () => {} }))).not.toMatch(/aria-hidden="true" class="text-center/)
  })

  it('Retry reads the feed again and moves focus to the feed title', () => {
    g.requestAnimationFrame = (cb: () => void) => cb()
    const calls: string[] = []
    const tree = FeedListStatus({ state: { kind: 'error', error: 'failed' }, locale: 'en', onRetry: () => calls.push('retry'), focusTitle: () => calls.push('focus title') })
    ;(find(tree, 'button')[0].props.onClick as () => void)()
    expect(calls).toEqual(['retry', 'focus title'])
  })

  it('Load more stays focusable while busy (aria-disabled, not disabled) and ignores activation until the page loads', () => {
    const onLoadMore = vi.fn()
    const busy = find(FeedLoadMore({ locale: 'en', loading: true, onLoadMore }), 'button')[0]
    expect(busy.props.disabled).toBeUndefined()
    expect(busy.props['aria-disabled']).toBe(true)
    ;(busy.props.onClick as () => void)()
    expect(onLoadMore).not.toHaveBeenCalled()
    const idle = find(FeedLoadMore({ locale: 'en', loading: false, onLoadMore }), 'button')[0]
    expect(idle.props['aria-disabled']).toBeUndefined()
    ;(idle.props.onClick as () => void)()
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('sub-tab arrow keys follow the reading direction: Arabic swaps Left / Right', () => {
    expect(nextTabIndex('ArrowRight', 0, 6, 'en')).toBe(1)
    expect(nextTabIndex('ArrowLeft', 0, 6, 'en')).toBe(5)
    expect(nextTabIndex('ArrowLeft', 0, 6, 'ar')).toBe(1)
    expect(nextTabIndex('ArrowRight', 0, 6, 'ar')).toBe(5)
    expect(nextTabIndex('ArrowLeft', 5, 6, 'ar')).toBe(0)
    expect(nextTabIndex('Home', 3, 6, 'ar')).toBe(0)
    expect(nextTabIndex('End', 3, 6, 'en')).toBe(5)
    expect(nextTabIndex('Tab', 3, 6, 'en')).toBeNull()
  })
})

describe('feed-panel.tsx wiring', () => {
  const src = readFileSync(fileURLToPath(new URL('../components/panels/feed-panel.tsx', import.meta.url)), 'utf8')
  const start = src.indexOf('export function FeedPanel(')
  const panel = src.slice(start)

  it('no server text reaches the member: a failed read stores only its kind', () => {
    // Both reads (Recent and Ranked) keep only the kind; the server text goes to the log, never the screen.
    expect(panel.match(/const msg: FeedLoadError = isTimeout \? 'timeout' : 'failed'/g)).toHaveLength(2)
    expect(panel).not.toMatch(/\bmsg\b[^\n]*serializedMsg/)
    expect(panel).not.toMatch(/:\s*serializedMsg\s*$/m)
    expect(panel).not.toMatch(/setError\((serializedMsg|getErrorMessage|err)/)
    expect(panel).toContain('useState<FeedLoadError | null>(null)')
  })

  it('the panel renders both status regions with its raw state (the notice is never cut by a load)', () => {
    expect(panel).toMatch(/<FeedStatusRegions\s+ready=\{announceReady\}\s+loading=\{loading\}\s+error=\{error !== null\}\s+empty=\{feedItems\.length === 0\}\s+notice=\{feedNotice\}\s+locale=\{locale\}\s*\/>/)
    expect(src.match(/\bfeedNotice\b/g)).toHaveLength(2)
    expect(panel).toContain('nextTabIndex(e.key, currentIdx, tabs.length, locale)')
    expect(panel).toContain('focusTitle={focusFeedTitle}')
    expect(panel).toContain('<EventsPanel onEventChanged={syncFeedEventCard} />')
    // The region speaks only once the viewer's language has settled (feed-chrome.test.ts).
    expect(panel).toContain('const announceReady = useFeedAnnounceReady(feedLocaleSettled({ authLoading, user, profileSettled }))')
    // Fallback wiring check: the feed hands its cards the hook's handler as is (the hook is never
    // given the feed's reload — hooks/use-feed-event-cards.test.ts proves what that handler reads).
    expect(panel).toMatch(/<EventCard\b[\s\S]{0,1200}onManaged=\{handleEventManaged\}\s*\/>/)
    expect(panel).toContain('} = useFeedEventCards({')
    // Not re-bindable: the handler is only destructured from the hook and handed to the cards, and
    // profileSettled only destructured from useAuth() and passed to the gate.
    expect(src.match(/\bhandleEventManaged\b/g)).toHaveLength(2)
    expect(panel).toMatch(/\n\s+handleEventManaged,\n[\s\S]{0,80}\} = useFeedEventCards\(\{/)
    expect(src.match(/\bprofileSettled\b/g)).toHaveLength(2)
    expect(panel).toMatch(/const \{ user, profileSettled, [^}]*\} = useAuth\(\)/)
    expect(src).not.toMatch(/\b(const|let|var)\s+profileSettled\b|\bprofileSettled\s*=[^=]/)
  })

  it('the panel root carries the viewer language and direction', () => {
    expect(panel).toContain('<div lang={locale} dir={dir(locale)} className="h-full flex flex-col">')
  })

  it('tabs, their list name and the guest prompt come from the dictionary', () => {
    for (const key of ['tabFeed', 'tabEvents', 'tabBusinesses', 'tabOrganizations', 'tabPetitions', 'tabMessages']) {
      expect(panel).toContain(`{feedChromeT(locale, '${key}')}`)
    }
    expect(panel).toContain("aria-label={feedChromeT(locale, 'sectionsAria')}")
    expect(panel).toContain("<CreateAccountPrompt message={feedChromeT(locale, 'guestPrompt')} linkLabel={feedChromeT(locale, 'createAccount')} />")
  })

  it('no English chrome literal is left in the panel', () => {
    for (const literal of ['>Community Feed<', 'Community sections', "'Load more posts'", 'Loading posts', 'No posts to show', 'Be the first to share', 'Feed timed out', "load the feed right now", 'Create a free account to post']) {
      expect(src, literal).not.toContain(literal)
    }
    for (const tab of ['Feed', 'Events', 'Businesses', 'Organizations', 'Petitions', 'Messages']) {
      expect(panel, tab).not.toMatch(new RegExp(`>\\s*${tab}\\s*</button>`))
    }
  })

  it('sub-tabs not translated yet are marked English (so the root language never mislabels them)', () => {
    for (const id of ['messages', 'businesses', 'organizations', 'petitions']) {
      expect(panel).toMatch(new RegExp(`id="feed-panel-${id}"[\\s\\S]{0,200}lang="en"\\s+dir="ltr"`))
    }
  })

  it('inside the Feed tab, every part not translated yet is marked English, left-to-right', () => {
    // The composer, the safety strip, the follow-error banner and each post card (its Report button
    // and relative time included) — the translated chrome around them keeps the viewer language.
    expect(panel).toMatch(/<div lang="en" dir="ltr" data-testid="feed-composer-region">\s*<CreatePostCard\b/)
    expect(panel).toMatch(/<div lang="en" dir="ltr" data-testid="feed-safety-region">\s*<SafetyStrip\b/)
    expect(panel).toMatch(/<m\.div key=\{post\.id\} data-testid=\{`post-\$\{post\.id\}`\} lang="en" dir="ltr"[^>]*>\s*<PostCard\b/)
    expect(panel).toMatch(/role="alert"[\s\S]{0,120}lang="en"\s+dir="ltr"[\s\S]{0,160}\{followError\}/)
    // ...and nothing in the Feed tab renders them outside those marks.
    expect(panel.match(/<CreatePostCard\b/g)).toHaveLength(1)
    expect(panel.match(/<SafetyStrip\b/g)).toHaveLength(1)
    expect(panel.match(/<PostCard\b/g)).toHaveLength(1)
  })
})
