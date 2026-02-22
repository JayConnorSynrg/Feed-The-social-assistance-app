'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error.message, error.digest)
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
      <div className="relative z-10 text-center space-y-4 bg-stone-50/95 backdrop-blur-sm border border-lime-200/60 rounded-2xl p-10 shadow-xl max-w-md w-full">
        <div className="text-4xl">🌾</div>
        <h2 className="text-2xl font-bold text-stone-800">Something went wrong</h2>
        <p className="text-stone-500 text-sm">
          An unexpected error occurred. Your data is safe — please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-stone-400 font-mono">ref: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <Button
            onClick={() => reset()}
            className="bg-lime-600 hover:bg-lime-700 text-white"
          >
            Try again
          </Button>
          <Button
            variant="outline"
            className="border-lime-300"
            onClick={() => (window.location.href = '/')}
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  )
}
