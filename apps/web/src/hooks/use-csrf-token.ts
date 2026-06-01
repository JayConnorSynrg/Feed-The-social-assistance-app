// apps/web/src/hooks/use-csrf-token.ts
// Hook for managing CSRF tokens in forms

import { useEffect, useState } from 'react'
import { csrfToken } from '@/lib/security'

interface UseCsrfTokenReturn {
  token: string | null
  regenerate: () => void
  validate: (tokenToValidate: string) => boolean
}

/**
 * Hook to manage CSRF tokens for form submissions
 * Generates a token on mount and provides validation
 *
 * @example
 * ```tsx
 * const { token, validate } = useCsrfToken()
 *
 * const handleSubmit = (e) => {
 *   e.preventDefault()
 *   const formToken = e.currentTarget.csrf_token.value
 *   if (!validate(formToken)) {
 *     console.error('Invalid CSRF token')
 *     return
 *   }
 *   // Proceed with submission
 * }
 *
 * return (
 *   <form onSubmit={handleSubmit}>
 *     <input type="hidden" name="csrf_token" value={token || ''} />
 *     ...
 *   </form>
 * )
 * ```
 */
export function useCsrfToken(): UseCsrfTokenReturn {
  const [token, setToken] = useState<string | null>(null)

  const regenerate = () => {
    const newToken = csrfToken.generate()
    csrfToken.store(newToken)
    setToken(newToken)
  }

  useEffect(() => {
    // Read from localStorage (external system) to hydrate token state.
    const existingToken = csrfToken.get()
    if (existingToken) {
      // Syncing state from localStorage on mount — legitimate external-system read.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(existingToken)
    } else {
      // Generate new token if none exists
      regenerate()
    }
  }, [])

  const validate = (tokenToValidate: string): boolean => {
    return csrfToken.validate(tokenToValidate)
  }

  return {
    token,
    regenerate,
    validate,
  }
}
