// apps/web/src/app/(admin)/moderation/moderation-tab.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Moderation tab:
//   - Reports / Safety Alerts is a real tablist (role=tablist / tab, aria-selected, aria-controls) —
//     selection is not shown by colour alone (rendered with react-dom/server);
//   - L1: a post action in the reports queue makes the linked-post panel re-read (reloadKey), and an
//     action in the panel reloads the queue (its key) — neither shows a stale state of the same post;
//   - closing the linked post moves focus to the selected sub-tab;
//   - a safety-alert link opens on Safety Alerts.
// The wiring half runs ModerationTab on the mini hook runtime and reads its children's props.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/hooks/use-profile-locale', () => ({ useProfileLocale: () => 'en' }))

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn(), withMetric: vi.fn() }))

import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mount, findAll } from '@/test/mini-react'
import { ModerationTab } from './moderation-tab'
import { ReportsQueue } from './reports-queue'
import { FocusedPost } from './focused-post'
import { Tabs, TabsTrigger } from '@/components/ui/tabs'

const ID = '11111111-1111-4111-8111-111111111111'
let search = ''

beforeEach(() => {
  search = '?tab=moderation'
  vi.stubGlobal('window', { location: { search, pathname: '/moderation', hash: '' }, history: { state: null, replaceState: vi.fn() } })
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb())
})

describe('sub-tabs are a tablist (not colour alone)', () => {
  it('role=tablist with two role=tab; the selected one has aria-selected=true and controls its panel', () => {
    const html = renderToStaticMarkup(h(ModerationTab, { selectedOrgId: 'all' }))
    expect(html).toMatch(/role="tablist"[^>]*aria-label="Moderation"|aria-label="Moderation"[^>]*role="tablist"/)
    const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0])
    expect(tabs).toHaveLength(2)
    expect(tabs[0]).toMatch(/aria-selected="true"/)
    expect(tabs[0]).toMatch(/aria-controls="/)
    expect(tabs[1]).toMatch(/aria-selected="false"/)
    expect(tabs[1]).toMatch(/tabindex="-1"/)
    expect(html).toMatch(/>Reports<\/button>/)
    expect(html).toMatch(/>Safety Alerts<\/button>/)
  })
})

describe('the selected-tab underline is not clipped', () => {
  it('the tablist is as tall as its 44px tabs (h-9 overridden) and is not a scroll container', () => {
    const html = renderToStaticMarkup(h(ModerationTab, { selectedOrgId: 'all' }))
    const list = html.match(/<div[^>]*role="tablist"[^>]*>/)?.[0] ?? ''
    const cls = (list.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/)
    expect(cls).toContain('group-data-[orientation=horizontal]/tabs:h-auto')
    expect(cls).not.toContain('group-data-[orientation=horizontal]/tabs:h-9')
    expect(cls.filter((c) => /overflow/.test(c))).toEqual([])
    expect(html).toMatch(/<button[^>]*role="tab"[^>]*class="[^"]*min-h-\[44px\]/)
  })
})

describe('Moderation tab wiring', () => {
  const run = () => mount(() => ModerationTab({ selectedOrgId: 'all' }))
  const one = (tree: unknown, type: unknown) => {
    const found = findAll(tree, (el) => el.type === type)
    expect(found).toHaveLength(1)
    return found[0]
  }

  it('opens on Reports; a safety-alert link opens on Safety Alerts (the Tabs value)', () => {
    expect(one(run().tree(), Tabs).props.value).toBe('reports')
    ;(window.location as { search: string }).search = `?tab=moderation&focus=safety_alert:${ID}`
    expect(one(run().tree(), Tabs).props.value).toBe('safety')
  })

  it('L1: a queue action re-reads the linked post; a linked-post action reloads the queue', () => {
    const c = run()
    expect(one(c.tree(), FocusedPost).props.reloadKey).toBe(0)
    ;(one(c.tree(), ReportsQueue).props.onPostChanged as (id: string) => void)(ID)
    c.rerender()
    expect(one(c.tree(), FocusedPost).props.reloadKey).toBe(1)

    const queueKeyBefore = (one(c.tree(), ReportsQueue) as unknown as { key: string }).key
    ;(one(c.tree(), FocusedPost).props.onChanged as () => void)()
    c.rerender()
    expect((one(c.tree(), ReportsQueue) as unknown as { key: string }).key).not.toBe(queueKeyBefore)
  })

  it('closing the linked post focuses the selected sub-tab', () => {
    const c = run()
    const focus = { reports: vi.fn(), safety: vi.fn() }
    for (const t of findAll(c.tree(), (el) => el.type === TabsTrigger)) {
      ;(t.props.ref as (el: unknown) => void)({ focus: focus[t.props.value as 'reports' | 'safety'] })
    }
    ;(one(c.tree(), FocusedPost).props.onDismissed as () => void)()
    expect(focus.reports).toHaveBeenCalledTimes(1)
    expect(focus.safety).not.toHaveBeenCalled()
  })
})
