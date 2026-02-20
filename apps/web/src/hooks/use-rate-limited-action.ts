// apps/web/src/hooks/use-rate-limited-action.ts
// Hook for applying rate limiting to user actions

import { useCallback, useState } from 'react'
import { rateLimiters } from '@/lib/security'

export type RateLimiterType = 'api' | 'formSubmit' | 'fileUpload' | 'auth'

interface UseRateLimitedActionOptions {
  limiterType: RateLimiterType
  identifier?: string // Optional identifier for per-user/per-resource limiting
  onRateLimited?: () => void
}

interface UseRateLimitedActionReturn {
  execute: <T>(action: () => Promise<T> | T) => Promise<T | null>
  isLimited: boolean
  remainingRequests: number
  reset: () => void
}

/**
 * Hook to enforce client-side rate limiting on actions
 *
 * @example
 * ```tsx
 * const { execute, isLimited } = useRateLimitedAction({ limiterType: 'formSubmit' })
 *
 * const handleSubmit = async () => {
 *   const result = await execute(async () => {
 *     return await submitForm(data)
 *   })
 *   if (result) {
 *     // Handle success
 *   }
 * }
 * ```
 */
export function useRateLimitedAction(
  options: UseRateLimitedActionOptions
): UseRateLimitedActionReturn {
  const { limiterType, identifier = 'default', onRateLimited } = options
  const [isLimited, setIsLimited] = useState(false)

  const limiter = rateLimiters[limiterType]
  const key = `${limiterType}:${identifier}`

  const remainingRequests = limiter.getRemainingRequests(key)

  const execute = useCallback(
    async <T,>(action: () => Promise<T> | T): Promise<T | null> => {
      if (!limiter.isAllowed(key)) {
        setIsLimited(true)
        onRateLimited?.()
        return null
      }

      setIsLimited(false)
      try {
        return await Promise.resolve(action())
      } catch (error) {
        throw error
      }
    },
    [limiter, key, onRateLimited]
  )

  const reset = useCallback(() => {
    limiter.reset(key)
    setIsLimited(false)
  }, [limiter, key])

  return {
    execute,
    isLimited,
    remainingRequests,
    reset,
  }
}
