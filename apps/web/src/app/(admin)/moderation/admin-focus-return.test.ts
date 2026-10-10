// apps/web/src/app/(admin)/moderation/admin-focus-return.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Focus never drops to <body> when something an "Edit in admin" link opened goes away:
//   - the resource edit dialog closes: its row's Edit button when listed, else the active tab trigger
//     (Radix's own return-to-trigger is prevented — a link-opened dialog has none);
//   - Dismiss on the "opened nothing" line: focus moves to the active tab trigger BEFORE the button
//     removes itself.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const { buttons } = vi.hoisted(() => ({ buttons: [] as Array<{ onClick?: () => void }> }))
vi.mock('@/components/ui/button', async () => {
  const { createElement } = await vi.importActual<typeof import('react')>('react')
  return {
    Button: (props: { onClick?: () => void; children?: string }) => {
      buttons.push(props)
      return createElement('button', null, props.children)
    },
  }
})
import { activeAdminTabTrigger, restoreFocusAfterResourceEdit, RESOURCE_EDIT_BUTTON_ATTR } from './admin-focus-return'
import { AdminFocusNoticeLine, dismissNotice } from './admin-focus-notice'

const ID = '11111111-1111-4111-8111-111111111111'
const TAB = '[role="tab"][aria-selected="true"]'
const doc = (present: Record<string, { focus: () => void }>) => ({ querySelector: (s: string) => present[s] ?? null })

describe('restoreFocusAfterResourceEdit', () => {
  it('listed resource: prevents Radix default and focuses its row Edit button', () => {
    const row = { focus: vi.fn() }
    const tab = { focus: vi.fn() }
    const event = { preventDefault: vi.fn() }
    restoreFocusAfterResourceEdit(event, ID, doc({ [`[${RESOURCE_EDIT_BUTTON_ATTR}="${ID}"]`]: row, [TAB]: tab }))
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(row.focus).toHaveBeenCalledTimes(1)
    expect(tab.focus).not.toHaveBeenCalled()
  })
  it('not listed (or no resource): the active admin tab trigger', () => {
    const tab = { focus: vi.fn() }
    restoreFocusAfterResourceEdit({ preventDefault: vi.fn() }, ID, doc({ [TAB]: tab }))
    restoreFocusAfterResourceEdit({ preventDefault: vi.fn() }, null, doc({ [TAB]: tab }))
    expect(tab.focus).toHaveBeenCalledTimes(2)
  })
  it('activeAdminTabTrigger reads the selected Radix tab', () => {
    const tab = { focus: vi.fn() }
    expect(activeAdminTabTrigger(doc({ [TAB]: tab }))).toBe(tab)
  })
})

describe('dismissNotice', () => {
  it('focuses the active tab trigger, then dismisses', () => {
    const order: string[] = []
    const tab = { focus: () => order.push('focus') }
    dismissNotice(() => order.push('dismiss'), doc({ [TAB]: tab }))
    expect(order).toEqual(['focus', 'dismiss'])
  })
})

describe('AdminFocusNoticeLine Dismiss (wiring)', () => {
  it('its Dismiss button moves focus to the active tab trigger, then clears the notice', () => {
    const tab = { focus: vi.fn() }
    ;(globalThis as unknown as { document: unknown }).document = doc({ [TAB]: tab })
    const onDismiss = vi.fn()
    buttons.length = 0
    renderToStaticMarkup(h(AdminFocusNoticeLine, { notice: 'not_found', kind: 'resource', onDismiss }))
    expect(buttons).toHaveLength(1)
    buttons[0].onClick!()
    expect(tab.focus).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
