'use client'

// apps/web/src/components/map/marker-popup.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One popup behaviour for the resource, organization, business and safety-alert markers, whether a
// click or a followed deep link (#map?focus=…) opened it:
//  - the marker is a real <button> (keyboard-operable, aria-haspopup="dialog", aria-expanded), and
//    markerA11yRef strips the role="img" + aria-label="Map marker" Mapbox puts on every Marker
//    wrapper that lacks them (mapbox-gl 3.x Marker constructor) — an image may not contain a button;
//  - the popup content is a named dialog container (role="dialog", aria-labelledby the popup's
//    title, tabIndex 0) with its own named Close button inside it. The Popup is mounted with
//    closeButton={false} (Mapbox's × sits outside the dialog, where Escape cannot reach) and
//    focusAfterOpen={false} (Mapbox would focus its first focusable element unannounced);
//  - focus moves to the dialog from the Popup's onOpen, which Mapbox fires after the popup is
//    attached to the map — React mounts the portal content into a detached div first, so focusing
//    it from the content's own effect does nothing;
//  - Escape or Close returns focus to the marker button — only when focus was inside the popup, so
//    a popup removed by a re-cluster never pulls focus out of, say, the search box.

import { useCallback, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useFocusedPopup } from './use-focused-popup'

/** Visible focus for a marker button (lime-700 ring, as the rest of FEED). */
export const MARKER_BUTTON_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2'

/** A Marker ref callback: drop the role="img" and aria-label="Map marker" Mapbox adds to the
 *  marker's wrapper element, so the button inside is exposed as a button with its own name. */
export function markerA11yRef(marker: { getElement(): HTMLElement | undefined } | null): void {
  const element = marker?.getElement()
  if (!element) return
  element.removeAttribute('role')
  element.removeAttribute('aria-label')
}

/** The element to focus when a popup opens: its dialog container, or nothing. */
export function popupFocusTarget(popupElement: Pick<Element, 'querySelector'> | null | undefined): HTMLElement | null {
  return (popupElement?.querySelector('[role="dialog"]') as HTMLElement | null | undefined) ?? null
}

/** Popup onOpen (fires once the popup is attached): move focus into its dialog. */
export function focusPopupOnOpen(event: { target: { getElement(): HTMLElement | undefined } }): void {
  popupFocusTarget(event.target.getElement())?.focus({ preventScroll: true })
}

/** What a key pressed inside the popup dialog does. */
export function popupKeyAction(key: string): 'close' | null {
  return key === 'Escape' ? 'close' : null
}

/** Whether an element sits inside a Mapbox popup (the dialog or its × button). */
export function isInsidePopup(element: { closest?: (selector: string) => unknown } | null | undefined): boolean {
  return Boolean(element?.closest?.('.mapboxgl-popup'))
}

/** Close a popup; hand focus back to its marker only if focus was in the popup. */
export function closeMarkerPopup(opts: {
  setOpen: (open: boolean) => void
  trigger: { focus: (options?: FocusOptions) => void } | null
  focusWasInPopup: boolean
}): void {
  opts.setOpen(false)
  if (opts.focusWasInPopup) opts.trigger?.focus({ preventScroll: true })
}

/** A marker's popup: open state (click or deep-link focus), its trigger ref, title id and close. */
export function useMarkerPopup(focused: boolean | undefined) {
  const [open, setOpen] = useFocusedPopup(focused)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  // Where focus last went while the popup is open (Mapbox removes the popup, × included, before its
  // close event, so this is read from the last focusin rather than document.activeElement).
  const focusInPopupRef = useRef(false)
  useEffect(() => {
    if (!open) return
    const onFocusIn = (e: FocusEvent) => {
      focusInPopupRef.current = isInsidePopup(e.target as Element | null)
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [open])
  const close = useCallback(() => {
    closeMarkerPopup({ setOpen, trigger: triggerRef.current, focusWasInPopup: focusInPopupRef.current })
    focusInPopupRef.current = false
  }, [setOpen])
  return { open, setOpen, triggerRef, titleId, close, onPopupOpen: focusPopupOnOpen }
}

/** The popup content: a named dialog with its own Close button; Escape closes it. Focus is moved
 *  here by focusPopupOnOpen (the Popup's onOpen). */
export function MarkerPopupDialog({
  titleId,
  onClose,
  closeLabel = 'Close',
  className,
  children,
}: {
  titleId: string
  onClose: () => void
  /** The Close button's name (the markers' copy is English today). */
  closeLabel?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={0}
      className={`relative rounded-md pr-7 outline-none focus-visible:ring-2 focus-visible:ring-lime-700 ${className ?? ''}`}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (popupKeyAction(e.key) !== 'close') return
        e.stopPropagation()
        onClose()
      }}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute right-0 top-0 inline-flex h-6 w-6 items-center justify-center rounded text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      {children}
    </div>
  )
}
