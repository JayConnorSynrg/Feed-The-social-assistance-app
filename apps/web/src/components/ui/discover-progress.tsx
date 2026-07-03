'use client'

import { useEffect, useRef } from 'react'

const STATUS_LABELS = [
  'Searching sources…',
  'Verifying provenance…',
  'Geocoding addresses…',
]

interface DiscoverProgressProps {
  active: boolean
  durationMs?: number
}

/**
 * Animated progress bar for long-running discovery requests.
 * Drives 0→90% with ease-out while active, then snaps to 100% and hides.
 * Implemented via direct DOM mutation (no useState) to avoid cascading renders.
 */
export function DiscoverProgress({ active, durationMs = 30000 }: DiscoverProgressProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLParagraphElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const labelIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const labelIndexRef = useRef(0)

  useEffect(() => {
    const bar = barRef.current
    const label = labelRef.current
    const wrapper = wrapperRef.current
    if (!bar || !label || !wrapper) return

    if (active) {
      // Show wrapper, reset bar & label
      wrapper.style.display = 'block'
      bar.style.width = '0%'
      labelIndexRef.current = 0
      label.textContent = STATUS_LABELS[0]
      startRef.current = performance.now()

      // Animate 0→90% ease-out via rAF — no setState, pure DOM write
      const animate = (now: number) => {
        const elapsed = now - startRef.current
        const progress = Math.min(elapsed / durationMs, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        bar.style.width = `${eased * 90}%`
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate)
        }
      }
      rafRef.current = requestAnimationFrame(animate)

      // Cycle status label every 3s
      labelIntervalRef.current = setInterval(() => {
        labelIndexRef.current = (labelIndexRef.current + 1) % STATUS_LABELS.length
        if (label) label.textContent = STATUS_LABELS[labelIndexRef.current]
      }, 3000)
    } else {
      // Snap to 100%, then hide after 500ms
      cancelAnimationFrame(rafRef.current)
      clearInterval(labelIntervalRef.current)
      if (wrapper.style.display !== 'none') {
        bar.style.width = '100%'
        const timer = setTimeout(() => {
          wrapper.style.display = 'none'
          bar.style.width = '0%'
        }, 500)
        return () => clearTimeout(timer)
      }
    }

    return () => {
      cancelAnimationFrame(rafRef.current)
      clearInterval(labelIntervalRef.current)
    }
  }, [active, durationMs])

  return (
    <div ref={wrapperRef} className="space-y-1.5" style={{ display: 'none' }}>
      <div className="h-1.5 w-full rounded-full bg-stone-200 overflow-hidden">
        <div
          ref={barRef}
          className="h-full rounded-full bg-lime-500"
          style={{ width: '0%' }}
        />
      </div>
      <p ref={labelRef} className="text-xs text-stone-500 animate-pulse">
        {STATUS_LABELS[0]}
      </p>
    </div>
  )
}
