// apps/web/src/lib/badge-view.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Unit tests for deriveBadgeView — the pure render-decision model shared by the
// public profile page and the Settings → Profile own-badges surface. This is the
// logic that decides whether the section shows public badges, the owner-only
// private section, or the empty state. The repo's vitest runs in the `node`
// environment with no testing-library, so the render decisions are asserted at
// this logic layer (matching engagement-badges.test.ts); the rendered DOM is
// browser-verified separately.

import { describe, it, expect } from 'vitest'
import { deriveBadgeView, type BadgeSummary } from './engagement-badges'

const PUBLIC: BadgeSummary = {
  families: { food: { level: 2 } },
  badges: { helper: { level: 1 } },
}
const PRIVATE: BadgeSummary = {
  families: { housing: { count: 3, level: 1 } },
}

describe('deriveBadgeView', () => {
  it('renders public badges and the owner-only private section for the owner', () => {
    const view = deriveBadgeView(PUBLIC, PRIVATE, true)

    // Public badges are surfaced.
    expect(view.publicBadges.map((b) => b.key).sort()).toEqual(['food', 'helper'])
    expect(view.showEmptyState).toBe(false)

    // Private section renders (the "Private — only you can see this" label).
    expect(view.showPrivateSection).toBe(true)
    expect(view.privateBadges.map((b) => b.key)).toEqual(['housing'])
  })

  it('renders the empty state and no private section when both summaries are null', () => {
    const view = deriveBadgeView(null, null, true)

    expect(view.publicBadges).toEqual([])
    expect(view.privateBadges).toEqual([])
    expect(view.showEmptyState).toBe(true)
    expect(view.showPrivateSection).toBe(false)
  })

  it('never surfaces private badges to a non-owner', () => {
    const view = deriveBadgeView(PUBLIC, PRIVATE, false)

    expect(view.publicBadges.length).toBe(2)
    // isOwnProfile=false → private list is always empty and hidden.
    expect(view.privateBadges).toEqual([])
    expect(view.showPrivateSection).toBe(false)
  })

  it('hides the private section for the owner when there are no private badges', () => {
    const view = deriveBadgeView(PUBLIC, null, true)

    expect(view.showEmptyState).toBe(false)
    expect(view.showPrivateSection).toBe(false)
    expect(view.privateBadges).toEqual([])
  })
})
