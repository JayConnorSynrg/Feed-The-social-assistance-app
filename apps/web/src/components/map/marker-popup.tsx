'use client'

// apps/web/src/components/map/marker-popup.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One popup behaviour for the resource, organization, business and safety-alert markers, whether a
// click or a followed deep link (#map?focus=…) opened it:
//  - the marker is a real <button> (keyboard-operable, aria-haspopup="dialog", aria-expanded);
//  - the popup content is a named dialog container (role="dialog", aria-labelledby the popup's
//    title, tabIndex 0) that takes focus when it opens — the Popup is mounted with
//    focusAfterOpen={false}, because Mapbox would otherwise focus its × button (the first focusable
//    element) with no announcement;
//  - Escape on the dialog closes it; closing by Escape or × returns focus to the marker button —
//    only when focus was inside the popup, so a popup removed by a re-cluster never pulls focus out
//    of, say, the search box.

import { useCallback, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useFocusedPopup } from './use-focused-popup'

/** Visible focus for a marker button (lime-700 ring, as the rest of FEED). */
export const MARKER_BUTTON_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2'

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
  return { open, setOpen, triggerRef, titleId, close }
}

/** The popup content: a named dialog that takes focus on open and closes on Escape. */
export function MarkerPopupDialog({
  titleId,
  onClose,
  className,
  children,
}: {
  titleId: string
  onClose: () => void
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={0}
      className={`rounded-md outline-none focus-visible:ring-2 focus-visible:ring-lime-700 ${className ?? ''}`}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (popupKeyAction(e.key) !== 'close') return
        e.stopPropagation()
        onClose()
      }}
    >
      {children}
    </div>
  )
}
