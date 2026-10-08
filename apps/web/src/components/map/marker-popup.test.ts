// apps/web/src/components/map/marker-popup.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The marker popup is a named dialog that takes focus (role, name, tabIndex), Escape closes it, and
// closing hands focus back to the marker only when focus was inside the popup. Rendered with
// react-dom/server; the key and close logic is tested as plain functions.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkerPopupDialog, closeMarkerPopup, isInsidePopup, popupKeyAction } from './marker-popup'

describe('MarkerPopupDialog', () => {
  it('is a dialog named by the popup title, focusable as a container', () => {
    const html = renderToStaticMarkup(
      h(MarkerPopupDialog, { titleId: 't1', onClose: () => {} }, h('h3', { id: 't1' }, 'Riverside Pantry')),
    )
    expect(html).toMatch(/^<div role="dialog" aria-labelledby="t1" tabindex="0"/)
    expect(html).toContain('<h3 id="t1">Riverside Pantry</h3>')
  })
})

describe('popup keys and close', () => {
  it('Escape closes; other keys do nothing', () => {
    expect(popupKeyAction('Escape')).toBe('close')
    for (const key of ['Enter', ' ', 'Tab', 'Esc', 'ArrowDown']) expect(popupKeyAction(key), key).toBeNull()
  })

  it('closing returns focus to the marker when focus was in the popup', () => {
    const setOpen = vi.fn()
    const trigger = { focus: vi.fn() }
    closeMarkerPopup({ setOpen, trigger, focusWasInPopup: true })
    expect(setOpen).toHaveBeenCalledWith(false)
    expect(trigger.focus).toHaveBeenCalledTimes(1)
  })

  it('a popup closed while focus is elsewhere (a re-cluster) leaves focus where it is', () => {
    const setOpen = vi.fn()
    const trigger = { focus: vi.fn() }
    closeMarkerPopup({ setOpen, trigger, focusWasInPopup: false })
    expect(setOpen).toHaveBeenCalledWith(false)
    expect(trigger.focus).not.toHaveBeenCalled()
  })

  it('isInsidePopup: an element inside .mapboxgl-popup (dialog or ×) counts; anything else does not', () => {
    expect(isInsidePopup({ closest: (sel: string) => (sel === '.mapboxgl-popup' ? {} : null) })).toBe(true)
    expect(isInsidePopup({ closest: () => null })).toBe(false)
    expect(isInsidePopup(null)).toBe(false)
  })
})
