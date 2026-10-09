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

import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { messages, type Locale } from './i18n'
import { feedChromeMessages, feedChromeT, type FeedChromeMessages } from './i18n-feed-chrome'
import { FeedHeader, FeedListStatus, FeedLoadMore } from '@/components/feed/feed-chrome'

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
    const timeout = renderToStaticMarkup(h(FeedListStatus, { state: { kind: 'error', error: 'timeout' }, locale: 'en', onRetry: () => {} }))
    expect(timeout).toMatch(/role="alert"[^>]*>Feed timed out — please check your connection and retry\.</)
    const failed = renderToStaticMarkup(h(FeedListStatus, { state: { kind: 'error', error: 'failed' }, locale: 'vi', onRetry: () => {} }))
    expect(failed).toContain('>Hiện không thể tải bảng tin. Hãy thử lại.</p>')
    expect(failed).toContain('>Thử lại</button>')
  })

  it('loading, empty and Load more', () => {
    expect(renderToStaticMarkup(h(FeedListStatus, { state: { kind: 'loading' }, locale: 'fr', onRetry: () => {} }))).toContain('Chargement des publications…')
    const empty = renderToStaticMarkup(h(FeedListStatus, { state: { kind: 'empty' }, locale: 'ko', onRetry: () => {} }))
    expect(empty).toContain('표시할 게시물이 없습니다')
    expect(empty).toContain('가장 먼저 무언가를 공유해 보세요!')
    expect(renderToStaticMarkup(h(FeedLoadMore, { locale: 'pt', loading: false, onLoadMore: () => {} }))).toContain('>Carregar mais publicações</button>')
    expect(renderToStaticMarkup(h(FeedLoadMore, { locale: 'pt', loading: true, onLoadMore: () => {} }))).toContain('Carregando…')
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

  it('a change from an event card menu is announced in one polite region under the heading', () => {
    expect(panel).toMatch(/<p role="status" aria-live="polite" className="sr-only" data-testid="feed-status">\s*\{feedNotice\}\s*<\/p>/)
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
})
