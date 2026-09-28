'use client'

// apps/web/src/components/business/open-now-pill.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Display-only open/closed pill for the W3 public business profile. All the midnight-crossing math
// lives in the pure computeOpenNow/formatOpenNow helpers (business.ts, unit-tested); this component
// only supplies "now" as a minute-of-week computed in the VIEWER's local zone and re-renders the
// label. There is no stored tz column, so this is best-effort for a local audience (accepted design
// residual). It renders nothing until mounted (so server/client never disagree) and nothing at all
// when there are no usable hours.

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { computeOpenNow, formatOpenNow, type BusinessHours } from '@/lib/business'

export function OpenNowPill({ hours }: { hours: BusinessHours[] }) {
  const [label, setLabel] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!hours || hours.length === 0) {
      setLabel(null)
      return
    }
    const compute = () => {
      const now = new Date()
      // Minute-of-week in the viewer's local zone: getDay() 0=Sunday matches day_of_week.
      const minuteOfWeek = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes()
      const state = computeOpenNow(hours, minuteOfWeek)
      setLabel(formatOpenNow(state))
      setIsOpen(!!state && state.open)
    }
    compute()
    // Refresh each minute so the label stays honest without a heavy timer.
    const timer = setInterval(compute, 60_000)
    return () => clearInterval(timer)
  }, [hours])

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
