// feed-shell.scroll.test.ts — owner ruling B for the card view: the Community Feed sub-tab scrolls
// with the whole card (region grows, card scroller pads its end); every other panel and sub-tab
// keeps the fixed-height region and its own inner scroll. Layout itself is measured in a browser
// (PR evidence); this pins the routing of that decision and the class wiring it drives.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('@/lib/logger', () => ({ logEvent: vi.fn(), logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { regionScrollsWithCard } from './feed-shell'

const shell = readFileSync(fileURLToPath(new URL('./feed-shell.tsx', import.meta.url)), 'utf8')
const panel = readFileSync(fileURLToPath(new URL('../panels/feed-panel.tsx', import.meta.url)), 'utf8')

describe('regionScrollsWithCard', () => {
  it('is true only for the Feed sub-tab of the Community panel', () => {
    expect(regionScrollsWithCard('feed', undefined)).toBe(true)
    expect(regionScrollsWithCard('feed', 'feed')).toBe(true)
  })

  it.each(['messages', 'events', 'businesses', 'organizations', 'petitions'])('is false for the %s sub-tab (owns its scroll)', (sub) => {
    expect(regionScrollsWithCard('feed', sub)).toBe(false)
  })

  it.each(['overview', 'chat', 'map', 'programs', 'settings', 'documents', 'wizard'] as const)('is false for the %s panel', (p) => {
    expect(regionScrollsWithCard(p, undefined)).toBe(false)
  })
})

describe('card-scroll class wiring', () => {
  it('the card scroller pads its end and the region grows only in card-scroll mode', () => {
    expect(shell).toContain("growsWithCard ? 'pb-6' : 'pb-0'")
    expect(shell).toContain("growsWithCard ? 'min-h-full' : 'h-full'")
    expect(shell).toContain('const growsWithCard = regionScrollsWithCard(activePanel, panelParams?.subtab)')
  })

  it('the feed list is not a second scroll container', () => {
    const start = panel.indexOf('id="feed-panel-feed"')
    expect(start).toBeGreaterThan(-1)
    const feedTab = panel.slice(start, panel.indexOf('<FeedLoadMore', start))
    expect(feedTab).toContain('<div className="flex-1 space-y-3">')
    expect(feedTab).not.toMatch(/overflow-y-(auto|scroll)/)
  })
})
