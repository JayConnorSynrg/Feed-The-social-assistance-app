// apps/web/src/components/admin/member-view-link.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The shared "View …" control (I2, I5). Rendered with react-dom/server (no DOM in this suite):
//   - visible  -> one <a> to the member URL, in the reused "feed-preview" tab, with no rel
//                 noopener/noreferrer (either forces a new tab per click) and an accessible name that
//                 starts with the visible label, then the item name;
//   - hidden   -> the reason text and no <a> at all.
// A click persists exactly one admin.nav.member_view row with kind/source/view only — no ids.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const { events } = vi.hoisted(() => ({ events: [] as Array<{ name: string; attrs: Record<string, unknown> }> }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => events.push({ name, attrs }),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import { MemberViewLink, type MemberViewLinkProps } from './member-view-link'

const ID = '11111111-1111-4111-8111-111111111111'
const base: MemberViewLinkProps = {
  to: { kind: 'organization', id: ID },
  visibility: { visible: true },
  label: 'View public page',
  itemName: 'Riverside Pantry',
  source: 'orgs_section',
}

beforeEach(() => {
  events.length = 0
})

describe('MemberViewLink — visible', () => {
  it('renders one link to the member page in the reused feed-preview tab, without rel noopener/noreferrer', () => {
    const html = renderToStaticMarkup(h(MemberViewLink, base))
    const anchors = html.match(/<a [^>]*>/g) ?? []
    expect(anchors).toHaveLength(1)
    expect(anchors[0]).toContain(`href="/s/organization/${ID}"`)
    expect(anchors[0]).toContain('target="feed-preview"')
    expect(anchors[0]).not.toMatch(/rel=/)
  })

  it('accessible name starts with the visible label, then the item name; the preview-tab notice describes it', () => {
    const html = renderToStaticMarkup(h(MemberViewLink, base))
    expect(html).toContain('aria-label="View public page: Riverside Pantry"')
    const describedBy = html.match(/aria-describedby="([^"]+)"/)![1]
    expect(html).toContain(`<span id="${describedBy}" class="sr-only"> (opens in the feed preview tab)</span>`)
    expect(html).toMatch(/>View public page<span/)
  })

  it('the notice follows the viewer locale', () => {
    const html = renderToStaticMarkup(h(MemberViewLink, { ...base, locale: 'es', label: 'Ver página pública' }))
    expect(html).toContain('(se abre en la pestaña de vista previa del feed)')
  })

  it('a business routes to /s/business, never /s/organization', () => {
    const html = renderToStaticMarkup(h(MemberViewLink, { ...base, to: { kind: 'business', id: ID } }))
    expect(html).toContain(`href="/s/business/${ID}"`)
    expect(html).not.toContain('/s/organization/')
  })
})

describe('MemberViewLink — not visible to members', () => {
  it('renders the reason text and no link', () => {
    const html = renderToStaticMarkup(h(MemberViewLink, { ...base, visibility: { visible: false, reason: 'inactive' } }))
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('href=')
    expect(html).toContain('Inactive — hidden from members')
  })

  it('each reason renders its own text', () => {
    const html = renderToStaticMarkup(
      h(MemberViewLink, { ...base, to: { kind: 'post', id: ID }, visibility: { visible: false, reason: 'hidden' } })
    )
    expect(html).toBe('<span class="inline-flex min-h-6 items-center text-xs text-stone-500">Hidden from members</span>')
  })
})

describe('MemberViewLink — logging (I5)', () => {
  // Capture the element MemberViewLink returns (called inside a component render, so its hooks run
  // legally), then fire its handlers as the browser would.
  function renderedAnchor(props: MemberViewLinkProps): ReactElement<Record<string, (e: unknown) => void>> {
    let el: ReactElement | null = null
    function Probe() {
      el = MemberViewLink(props) as ReactElement
      return el
    }
    renderToStaticMarkup(h(Probe))
    return el as unknown as ReactElement<Record<string, (e: unknown) => void>>
  }

  it('one click writes exactly one admin.nav.member_view row with kind/source/view and no ids', () => {
    const a = renderedAnchor({ ...base, to: { kind: 'profile', username: 'ann' }, source: 'people' })
    a.props.onClick({})
    expect(events).toEqual([{ name: 'admin.nav.member_view', attrs: { kind: 'profile', source: 'people', view: 'page' } }])
  })

  it('a middle click (no click event) also writes exactly one row; a right click writes none', () => {
    const a = renderedAnchor(base)
    a.props.onAuxClick({ button: 2 })
    expect(events).toHaveLength(0)
    a.props.onAuxClick({ button: 1 })
    expect(events).toEqual([{ name: 'admin.nav.member_view', attrs: { kind: 'organization', source: 'orgs_section', view: 'page' } }])
  })

  it("a wrapping menu item's own onClick still runs (asChild composition)", () => {
    const outer = vi.fn()
    const a = renderedAnchor({ ...base, onClick: outer })
    a.props.onClick({})
    expect(outer).toHaveBeenCalledTimes(1)
    expect(events).toHaveLength(1)
  })
})
