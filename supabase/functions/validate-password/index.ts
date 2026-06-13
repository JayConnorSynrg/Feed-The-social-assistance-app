// Password Validation Edge Function
// Server-side password strength validation and common password checking
// POST /validate-password with { password, email?, username? }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

// Top 100 most common passwords (subset for demo - production should use larger list)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567', 'letmein',
  'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine', 'ashley', 'bailey',
  'passw0rd', 'shadow', '123123', '654321', 'superman', 'qazwsx', 'michael', 'football',
  'welcome', 'jesus', 'ninja', 'mustang', 'password1', '123456789', 'adobe123', 'admin',
  'princess', 'solo', 'azerty', 'photoshop', '1234', 'pussy', '12345', 'password123',
  'whatever', 'donald', 'login', 'batman', 'starwars', 'summer', 'ashley', 'hottie',
  'loveme', 'zaq1zaq1', 'password1', 'qwertyuiop', 'welcome123', 'solo', 'jordan23',
  'freedom', 'liverpool', 'password12', 'testing', 'charlie', 'secret', 'soccer',
  'matrix', 'samsung', 'hunter', 'pepper', 'michael1', 'football1', 'ranger', 'iloveyou1',
  'tigger', 'access', 'harley', 'whatever', 'trustno1', 'jordanl23', 'password2',
  'password!', 'password@', 'password#', 'passw0rd!', 'p@ssw0rd', 'admin123', 'root',
  'toor', 'administrator', 'guest', 'oracle', 'postgres', 'mysql', 'user', 'test',
])

interface ValidatePasswordRequest {
  password: string
  email?: string
  username?: string
}

interface ValidationResult {
  valid: boolean
  score: number // 0-6
  strength: string // weak, fair, good, strong
  feedback: string[]
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin, 'validate-password')

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body: ValidatePasswordRequest = await req.json()
    const { password, email, username } = body

    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = validatePassword(password, email, username)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Password validation error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Validate password strength with government-grade requirements
 */
function validatePassword(
  password: string,
  email?: string,
  username?: string
): ValidationResult {
  const feedback: string[] = []
  let score = 0

  // 1. Length requirements (minimum 12 for government-grade)
  if (password.length >= 12) {
    score++
  } else if (password.length >= 8) {
    feedback.push('Password should be at least 12 characters for enhanced security')
  } else {
    feedback.push('Password must be at least 12 characters')
  }

  // Bonus for extra length
  if (password.length >= 16) {
    score++
  }

  // 2. Lowercase letters
  if (/[a-z]/.test(password)) {
    score++
  } else {
    feedback.push('Add lowercase letters (a-z)')
  }

  // 3. Uppercase letters
  if (/[A-Z]/.test(password)) {
    score++
  } else {
    feedback.push('Add uppercase letters (A-Z)')
  }

  // 4. Numbers
  if (/[0-9]/.test(password)) {
    score++
  } else {
    feedback.push('Add numbers (0-9)')
  }

  // 5. Special characters
  if (/[^a-zA-Z0-9]/.test(password)) {
    score++
  } else {
    feedback.push('Add special characters (!@#$%^&*)')
  }

  // 6. Check against common passwords
  const lowerPassword = password.toLowerCase()
  if (COMMON_PASSWORDS.has(lowerPassword)) {
    score = Math.max(0, score - 3)
    feedback.push('This is a commonly used password - choose something more unique')
  }

  // 7. Check for patterns
  if (/(\w)\1{2,}/.test(password)) {
    // Repeated characters (e.g., "aaa", "111")
    score = Math.max(0, score - 1)
    feedback.push('Avoid repeating characters')
  }

  if (/^[0-9]+$/.test(password)) {
    // Only numbers
    score = Math.max(0, score - 2)
    feedback.push('Avoid using only numbers')
  }

  if (/^[a-zA-Z]+$/.test(password)) {
    // Only letters
    score = Math.max(0, score - 1)
    feedback.push('Include numbers and special characters')
  }

  // Sequential patterns
  const sequences = [
    '012345', '123456', '234567', '345678', '456789',
    'abcdef', 'bcdefg', 'cdefgh', 'defghi', 'efghij',
    'qwerty', 'asdfgh', 'zxcvbn'
  ]
  if (sequences.some(seq => lowerPassword.includes(seq))) {
    score = Math.max(0, score - 2)
    feedback.push('Avoid sequential patterns (123, abc, qwerty)')
  }

  // 8. Similarity to email/username
  if (email) {
    const emailLocal = email.split('@')[0].toLowerCase()
    if (lowerPassword.includes(emailLocal) || emailLocal.includes(lowerPassword)) {
      score = Math.max(0, score - 2)
      feedback.push('Password should not be similar to your email')
    }
  }

  if (username) {
    const lowerUsername = username.toLowerCase()
    if (lowerPassword.includes(lowerUsername) || lowerUsername.includes(lowerPassword)) {
      score = Math.max(0, score - 2)
      feedback.push('Password should not be similar to your username')
    }
  }

  // Calculate strength label
  let strength: string
  if (score <= 2) {
    strength = 'weak'
  } else if (score <= 3) {
    strength = 'fair'
  } else if (score <= 4) {
    strength = 'good'
  } else {
    strength = 'strong'
  }

  // Government-grade requirement: minimum score of 4 with 12+ characters
  const valid = score >= 4 && password.length >= 12

  if (!valid && feedback.length === 0) {
    feedback.push('Password does not meet minimum security requirements')
  }

  return {
    valid,
    score,
    strength,
    feedback,
  }
}
