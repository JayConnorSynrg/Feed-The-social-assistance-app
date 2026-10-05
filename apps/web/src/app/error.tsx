'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Move focus to the heading so screen-reader and keyboard users land on the
  // fallback instead of a now-removed element.
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    logger.error('app.error.boundary', error, { digest: error.digest ?? null, surface: 'app' })
  }, [error])

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url(/images/wheat-field-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-lime-50/60 via-stone-50/40 to-lime-100/50" />
      <div className="relative z-10 text-center space-y-4 bg-stone-50/95 text-stone-800 backdrop-blur-sm border border-lime-200/60 rounded-2xl p-10 shadow-xl max-w-md w-full">
        <div className="text-4xl" aria-hidden="true">🌾</div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold text-stone-800 rounded focus:outline-none focus:ring-2 focus:ring-lime-700 focus:ring-offset-2"
        >
          Something went wrong
        </h1>
        <p className="text-stone-500 text-sm">
          An unexpected error occurred. Your data is safe — please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-stone-500 font-mono">ref: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <Button
            onClick={() => reset()}
            className="bg-lime-700 hover:bg-lime-800 text-white"
          >
            Try again
          </Button>
          <Button asChild variant="outline" className="border-lime-300">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
