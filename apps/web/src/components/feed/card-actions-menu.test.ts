// apps/web/src/components/feed/card-actions-menu.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// R1 invariant 3 — the ⋯ card menu primitive (Release 2 reuses it on post cards), rendered with
// react-dom/server (an open menu is rendered without its portal, as orgs-section.org-admin.test.ts):
//   - a WAI-ARIA menu button: aria-haspopup="menu", aria-expanded, the caller's accessible name,
//     a 32×32 target, nothing at all when no section has an item;
//   - items are role="menuitem"; sections are separated, empty ones dropped; a destructive item says
//     so in red-700 text; an unavailable item stays reachable by arrow keys (aria-disabled, never
//     Radix `disabled`) and its reason is part of its name; a link item IS the menu item;
//   - the portalled content carries lang, the root dir (wiring, the portal does not render here).

import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DropdownMenu as Menu } from 'radix-ui'
import {
  CardActionsMenu,
  CardMenuItems,
  CARD_MENU_DESTRUCTIVE_CLASS,
  CARD_MENU_ITEM_CLASS,
  CARD_MENU_TRIGGER_CLASS,
  hasMenuItems,
  type CardMenuSection,
} from './card-actions-menu'

const noop = () => {}
const SECTIONS: CardMenuSection[] = [
  { id: 'main', items: [{ kind: 'action', id: 'edit', label: 'Edit', onSelect: noop, testId: 'm-edit' }] },
  { id: 'empty', items: [] },
  { id: 'links', items: [{ kind: 'link', id: 'admin', element: h('a', { href: '/moderation', 'data-testid': 'm-link' }, 'Edit in admin') }] },
  {
    id: 'danger',
    items: [
      { kind: 'action', id: 'delete', label: 'Delete', onSelect: noop, destructive: true, testId: 'm-delete' },
      { kind: 'unavailable', id: 'cancel', label: 'Cancel date', reason: 'This date has ended.', testId: 'm-cancel' },
    ],
  },
]

function openMenu(sections: CardMenuSection[]) {
  return renderToStaticMarkup(
    h(Menu.Root, { open: true, modal: false }, h(Menu.Trigger, null, 'More'), h(Menu.Content, null, h(CardMenuItems, { sections }))),
  )
}
const tagOf = (html: string, testId: string) => html.match(new RegExp(`<[a-z]+ [^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? ''

describe('the ⋯ trigger', () => {
  it('a menu button named by the caller, 32×32, closed until used', () => {
    const html = renderToStaticMarkup(h(CardActionsMenu, { sections: SECTIONS, triggerLabel: 'Manage event: Pantry', locale: 'en', testId: 'menu' }))
    const button = tagOf(html, 'menu')
    expect(button).toMatch(/^<button type="button"/)
    expect(button).toMatch(/aria-haspopup="menu"/)
    expect(button).toMatch(/aria-expanded="false"/)
    expect(button).toMatch(/aria-label="Manage event: Pantry"/)
    expect(CARD_MENU_TRIGGER_CLASS.split(' ')).toEqual(expect.arrayContaining(['h-8', 'w-8']))
    // The icon is decorative; the name comes from aria-label.
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/)
  })

  it('busy: says so and shows a spinner', () => {
    const html = renderToStaticMarkup(h(CardActionsMenu, { sections: SECTIONS, triggerLabel: 'x', locale: 'en', testId: 'menu', busy: true }))
    expect(tagOf(html, 'menu')).toMatch(/aria-busy="true"/)
    expect(html).toContain('animate-spin')
  })

  it('nothing to offer: no button at all', () => {
    expect(hasMenuItems([{ id: 'a', items: [] }])).toBe(false)
    expect(renderToStaticMarkup(h(CardActionsMenu, { sections: [{ id: 'a', items: [] }], triggerLabel: 'x', locale: 'en' }))).toBe('')
  })
})

describe('the open menu', () => {
  const html = openMenu(SECTIONS)

  it('every item is a menuitem; the empty section is dropped and the others are separated', () => {
    expect(html.match(/role="menuitem"/g)).toHaveLength(4)
    // main | links | danger → 2 separators (the empty section adds none).
    expect(html.match(/role="separator"/g)).toHaveLength(2)
  })

  it('a destructive item reads as such in text and red-700 (6.4:1 on white), not red alone', () => {
    const del = tagOf(html, 'm-delete')
    expect(del).toContain(CARD_MENU_DESTRUCTIVE_CLASS)
    expect(CARD_MENU_DESTRUCTIVE_CLASS).toMatch(/\btext-red-700\b/)
    expect(html).toMatch(/data-testid="m-delete"[^>]*>(<[^>]+>)*Delete/)
  })

  it('an unavailable item stays reachable (aria-disabled, not data-disabled) and carries its reason', () => {
    const cancel = tagOf(html, 'm-cancel')
    expect(cancel).toMatch(/role="menuitem"/)
    expect(cancel).toMatch(/aria-disabled="true"/)
    expect(cancel).not.toMatch(/data-disabled/)
    const body = html.slice(html.indexOf('data-testid="m-cancel"'))
    expect(body.slice(0, body.indexOf('</div>'))).toContain('This date has ended.')
  })

  it('a link item IS the menu item: the <a> carries role="menuitem" and the item class', () => {
    const a = tagOf(html, 'm-link')
    expect(a).toMatch(/^<a /)
    expect(a).toMatch(/role="menuitem"/)
    expect(a).toContain(CARD_MENU_ITEM_CLASS)
  })

  it('items are at least 36px tall (WCAG 2.5.8) with a visible brand focus ring', () => {
    for (const cls of [CARD_MENU_ITEM_CLASS, CARD_MENU_DESTRUCTIVE_CLASS]) {
      expect(cls.split(' ')).toEqual(expect.arrayContaining(['min-h-9', 'data-[highlighted]:ring-2', 'data-[highlighted]:ring-brand']))
    }
  })
})

describe('an event menu without its admin item has no stray separator', () => {
  it('manage | danger only: exactly one separator', async () => {
    const { eventMenuSections } = await import('@/components/events/event-card-admin-menu')
    const { eventMenuEntries } = await import('./event-card-menu')
    const viewer = { status: 'ready' as const, tier: 'platform_admin' as const, adminOrgIds: null }
    const event = { eventId: 'not-a-uuid', orgId: 'org', title: 'Pantry', cancelledShown: null, status: 'upcoming', endsAt: '2099-01-01T00:00:00Z' }
    const sections = eventMenuSections({
      entries: eventMenuEntries(event, viewer, 0),
      event,
      locale: 'en',
      source: 'feed_event_menu',
      onEdit: noop,
      onAddDates: noop,
      onCancelDate: noop,
    })
    const html = openMenu(sections)
    expect(html.match(/role="separator"/g)).toHaveLength(1)
    expect(html.match(/role="menuitem"/g)).toHaveLength(3)
  })
})

describe('wiring the node renderer cannot show (the portal)', () => {
  const src = readFileSync(fileURLToPath(new URL('./card-actions-menu.tsx', import.meta.url)), 'utf8')
  it('the root takes the locale direction, the portalled content its language', () => {
    expect(src).toMatch(/<Menu\.Root dir=\{dir\(locale\)\}/)
    expect(src).toMatch(/<Menu\.Content\s+lang=\{locale\}/)
    expect(src).toMatch(/<Menu\.Portal>/)
  })
})
