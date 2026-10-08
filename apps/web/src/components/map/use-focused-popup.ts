'use client'

// apps/web/src/components/map/use-focused-popup.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// A map marker's popup state, opened by a followed deep link (#map?focus=…, lib/map-focus.ts):
//  - a marker that mounts already focused (a cluster that splits at the focus zoom) opens at once;
//  - a marker already on the map opens when `focused` turns true.
// The second case adjusts state while rendering when the prop changes (React's documented
// alternative to a setState-in-effect); popupOnFocusChange is that decision, pure and tested.

import { useState } from 'react'
import { focusOpensPopup, popupOnFocusChange } from '@/lib/map-focus'

export function useFocusedPopup(focused: boolean | undefined) {
  const [showPopup, setShowPopup] = useState(() => focusOpensPopup(focused))
  const [seenFocused, setSeenFocused] = useState(focused)
  if (seenFocused !== focused) {
    setSeenFocused(focused)
    const next = popupOnFocusChange(seenFocused, focused, showPopup)
    if (next !== showPopup) setShowPopup(next)
  }
  return [showPopup, setShowPopup] as const
}
