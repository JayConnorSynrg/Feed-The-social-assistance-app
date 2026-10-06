// apps/web/src/app/(admin)/moderation/org/org-overview.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// After "Try again" on the org Overview, focus lands on the section heading once the reload settles
// (the button it was on is gone); the first load never moves focus. The heading is rendered in
// every state so it is always there to receive focus.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { focusAfterRetry, OrgOverviewView } from './org-overview'
import { fakeEl, asEl } from '@/lib/__tests__/fake-dom'

describe('focus after "Try again"', () => {
  it('first load: focus stays where it is', () => {
    const heading = fakeEl('h2', { tabindex: '-1' })
    expect(focusAfterRetry({ current: false }, 'ready', asEl(heading))).toBe(false)
    expect(heading.focusCalls).toHaveLength(0)
  })

  it('retry still loading: waits; once settled (ready or error): focuses the heading once', () => {
    for (const settled of ['ready', 'error'] as const) {
      const heading = fakeEl('h2', { tabindex: '-1' })
      const pending = { current: true }
      expect(focusAfterRetry(pending, 'loading', asEl(heading))).toBe(false)
      expect(heading.focusCalls).toHaveLength(0)
      expect(focusAfterRetry(pending, settled, asEl(heading))).toBe(true)
      expect(focusAfterRetry(pending, settled, asEl(heading))).toBe(false)
      expect(heading.focusCalls).toHaveLength(1)
    }
  })

  it('the focusable heading is present in every state', () => {
    for (const state of ['loading', 'ready', 'error'] as const) {
      const html = renderToStaticMarkup(
        h(OrgOverviewView, {
          state,
          counts: state === 'ready' ? { members: 1, activeEvents: 2, upcomingDates: 3, checkinsLast30Days: 4 } : null,
          onRetry: () => {},
        })
      )
      expect(html, state).toMatch(/<h2 id="org-overview-heading" tabindex="-1"[^>]*>This organization at a glance<\/h2>/)
      // English-only section: marked so it reads left-to-right inside a right-to-left page.
      expect(html, state).toMatch(/^<section lang="en" dir="ltr"/)
    }
  })
})
