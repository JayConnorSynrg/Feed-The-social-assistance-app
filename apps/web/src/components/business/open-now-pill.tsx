'use client'

// apps/web/src/components/business/open-now-pill.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Display-only open/closed pill for the W3 public business profile. All the midnight-crossing math
// lives in the pure computeOpenNow/formatOpenNow helpers (business.ts, unit-tested); this component
// only supplies "now" as a minute-of-week computed in the VIEWER's local zone and re-renders the
// label. There is no stored tz column, so this is best-effort for a local audience (accepted design
// residual).
//
// It reads the client-only value through useSyncExternalStore rather than a setState-in-effect: the
// SERVER snapshot (and the hydration render) is a stable EMPTY, so SSR and the first client render
// agree (no hydration mismatch); after hydration React subscribes and re-reads the CLIENT snapshot,
// which computes from the viewer's local Date. A minute interval refreshes the label; its setState
// path is React's own store-notification (deferred), not a synchronous effect write. Renders nothing
// when there are no usable hours.

import { useMemo, useSyncExternalStore } from 'react'
import { Clock } from 'lucide-react'
import { computeOpenNow, formatOpenNow, type BusinessHours } from '@/lib/business'

interface Snapshot {
  label: string | null
  isOpen: boolean
}

// Stable reference used for the server snapshot AND the "no usable hours" case, so getSnapshot never
// returns a fresh object that would loop useSyncExternalStore.
const EMPTY: Snapshot = { label: null, isOpen: false }

function createOpenNowStore(hours: BusinessHours[]) {
  let snapshot: Snapshot = EMPTY

  const compute = (): Snapshot => {
    if (!hours || hours.length === 0) return EMPTY
    const now = new Date()
    // Minute-of-week in the viewer's local zone: getDay() 0=Sunday matches day_of_week.
    const minuteOfWeek = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes()
    const state = computeOpenNow(hours, minuteOfWeek)
    return { label: formatOpenNow(state), isOpen: !!state && state.open }
  }

  return {
    // React re-reads getSnapshot right after subscribe(), so computing here makes the first
    // post-hydration render show the fresh, locally-computed label without any effect setState.
    subscribe(onStoreChange: () => void) {
      snapshot = compute()
      const timer = setInterval(() => {
        const next = compute()
        if (next.label !== snapshot.label || next.isOpen !== snapshot.isOpen) {
          snapshot = next
          onStoreChange()
        }
      }, 60_000)
      return () => clearInterval(timer)
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY,
  }
}

export function OpenNowPill({ hours }: { hours: BusinessHours[] }) {
  const store = useMemo(() => createOpenNowStore(hours), [hours])
  const { label, isOpen } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )

  if (!label) return null

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
        isOpen ? 'bg-lime-100 text-lime-800' : 'bg-stone-100 text-stone-600'
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}
