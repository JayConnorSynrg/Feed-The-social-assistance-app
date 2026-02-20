// apps/web/src/hooks/use-password-strength.ts
// Hook for real-time password strength validation

import { useMemo } from 'react'
import { validatePasswordStrength } from '@/lib/security'

interface UsePasswordStrengthReturn {
  valid: boolean
  score: number
  feedback: string[]
  strength: 'weak' | 'fair' | 'good' | 'strong'
  color: string
}

/**
 * Hook to validate password strength in real-time
 * Returns validation status, score, feedback, and visual indicators
 *
 * @example
 * ```tsx
 * const [password, setPassword] = useState('')
 * const { valid, strength, feedback, color } = usePasswordStrength(password)
 *
 * return (
 *   <div>
 *     <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
 *     <div style={{ color }}>Strength: {strength}</div>
 *     {feedback.map(msg => <div key={msg}>{msg}</div>)}
 *   </div>
 * )
 * ```
 */
export function usePasswordStrength(password: string): UsePasswordStrengthReturn {
  return useMemo(() => {
    if (!password) {
      return {
        valid: false,
        score: 0,
        feedback: [],
        strength: 'weak' as const,
        color: '#9ca3af', // gray-400
      }
    }

    const result = validatePasswordStrength(password)

    // Determine strength label based on score
    let strength: 'weak' | 'fair' | 'good' | 'strong'
    let color: string

    if (result.score < 3) {
      strength = 'weak'
      color = '#ef4444' // red-500
    } else if (result.score < 4) {
      strength = 'fair'
      color = '#f97316' // orange-500
    } else if (result.score < 5) {
      strength = 'good'
      color = '#eab308' // yellow-500
    } else {
      strength = 'strong'
      color = '#22c55e' // green-500
    }

    return {
      valid: result.valid,
      score: result.score,
      feedback: result.feedback,
      strength,
      color,
    }
  }, [password])
}
