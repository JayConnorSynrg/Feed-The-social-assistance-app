'use client'

// apps/web/src/components/map/use-focused-popup.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A map marker's popup state, opened by a followed deep link (#map?focus=…, lib/map-focus.ts):
//  - a marker that mounts already focused (a cluster that splits at the focus zoom) opens at once;
//  - a marker already on the map opens when `focused` turns true.
// The prop change is applied while rendering (React's documented alternative to setState in an
// effect) through the pure reducer popupStateFor; `setOpen` is the click / close path.

import { useCallback, useState } from 'react'
import { initialPopupState, popupStateFor } from '@/lib/map-focus'

export function useFocusedPopup(focused: boolean | undefined) {
  const [state, setState] = useState(() => initialPopupState(focused))
  const next = popupStateFor(state, focused)
  if (next !== state) setState(next)
  const setOpen = useCallback((open: boolean) => setState((s) => (s.open === open ? s : { ...s, open })), [])
  return [next.open, setOpen] as const
}
