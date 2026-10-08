// apps/web/src/components/map/marker-popup.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The marker popup is a named dialog that takes focus (role, name, tabIndex), Escape closes it, and
// closing hands focus back to the marker only when focus was inside the popup. Rendered with
// react-dom/server; the key and close logic is tested as plain functions.

import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  MarkerPopupDialog,
  closeMarkerPopup,
  focusPopupOnOpen,
  isInsidePopup,
  markerA11yRef,
  popupFocusTarget,
  popupKeyAction,
} from './marker-popup'

describe('MarkerPopupDialog', () => {
  const render = (props: { closeLabel?: string } = {}) =>
    renderToStaticMarkup(
      h(MarkerPopupDialog, { titleId: 't1', onClose: () => {}, ...props }, h('h3', { id: 't1' }, 'Riverside Pantry')),
    )

  it('is a dialog named by the popup title, focusable as a container', () => {
    const html = render()
    expect(html).toMatch(/^<div role="dialog" aria-labelledby="t1" tabindex="0"/)
    expect(html).toContain('<h3 id="t1">Riverside Pantry</h3>')
  })

  it('holds its own named Close button inside the dialog (Escape reaches it; Mapbox\'s × is off)', () => {
    const html = render()
    const inner = html.replace(/^<div role="dialog"[^>]*>/, '').replace(/<\/div>$/, '')
    expect(inner).toMatch(/^<button type="button" aria-label="Close"[^>]*>/)
    expect(inner).toMatch(/<svg[^>]*aria-hidden="true"/)
    expect(render({ closeLabel: 'Cerrar' })).toContain('aria-label="Cerrar"')
  })
})

describe('the Mapbox marker wrapper does not hide the button', () => {
  function fakeWrapper() {
    const attrs = new Map<string, string>([
      ['role', 'img'],
      ['aria-label', 'Map marker'],
      ['class', 'mapboxgl-marker'],
    ])
    return { attrs, removeAttribute: (name: string) => void attrs.delete(name) }
  }

  it('markerA11yRef strips role="img" and aria-label="Map marker", nothing else', () => {
    const element = fakeWrapper()
    markerA11yRef({ getElement: () => element as unknown as HTMLElement })
    expect([...element.attrs.keys()]).toEqual(['class'])
  })

  it('is safe on unmount (null) and when the marker has no element', () => {
    expect(() => markerA11yRef(null)).not.toThrow()
    expect(() => markerA11yRef({ getElement: () => undefined })).not.toThrow()
  })
})

describe('focus moves into the dialog once the popup is attached (onOpen)', () => {
  it('the target is the dialog container inside the popup', () => {
    const dialog = { focus: vi.fn() }
    const popupElement = { querySelector: (sel: string) => (sel === '[role="dialog"]' ? dialog : null) }
    expect(popupFocusTarget(popupElement as unknown as Element)).toBe(dialog)
    focusPopupOnOpen({ target: { getElement: () => popupElement as unknown as HTMLElement } })
    expect(dialog.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('no dialog (or no element) → nothing focused, no throw', () => {
    expect(popupFocusTarget({ querySelector: () => null } as unknown as Element)).toBeNull()
    expect(popupFocusTarget(undefined)).toBeNull()
    expect(() => focusPopupOnOpen({ target: { getElement: () => undefined } })).not.toThrow()
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
