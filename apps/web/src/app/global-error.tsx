'use client'

// apps/web/src/app/global-error.tsx
// Root-level error boundary. Next.js renders this in place of the root layout
// when an error is thrown during the root render, so it must provide its own
// <html> and <body> elements.

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('global-error.boundary', error, { digest: error.digest })
  }, [error])

  return (
    <html lang="en" className="light">
      <body
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/images/wheat-field-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-lime-50/60 via-stone-50/40 to-lime-100/50" />
        <div className="relative z-10 text-center space-y-4 bg-stone-50/95 text-stone-800 backdrop-blur-sm border border-lime-200/60 rounded-2xl p-10 shadow-xl max-w-md w-full">
          <div className="text-4xl">🌾</div>
          <h2 className="text-2xl font-bold text-stone-800">Something went wrong</h2>
          <p className="text-stone-500 text-sm">
            An unexpected error occurred. Your data is safe — please try again.
          </p>
          {error.digest && (
            <p className="text-xs text-stone-400 font-mono">ref: {error.digest}</p>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => reset()}
              className="rounded-md bg-lime-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-lime-700"
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="rounded-md border border-lime-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-lime-50"
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
