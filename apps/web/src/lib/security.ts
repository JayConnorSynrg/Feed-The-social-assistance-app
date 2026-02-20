// apps/web/src/lib/security.ts
// Security utilities and validation helpers

/**
 * Input sanitization for user-generated content
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * URL validation - prevents javascript: and data: URLs
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Validate file upload
 */
export interface FileValidationResult {
  valid: boolean
  error?: string
}

export function validateFileUpload(
  file: File,
  options: {
    maxSizeMB?: number
    allowedTypes?: string[]
    allowedExtensions?: string[]
  } = {}
): FileValidationResult {
  const {
    maxSizeMB = 10,
    allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
  } = options

  // Check file size
  const maxBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxBytes) {
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` }
  }

  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type ${file.type} is not allowed` }
  }

  // Check extension
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !allowedExtensions.includes(extension)) {
    return { valid: false, error: `File extension .${extension} is not allowed` }
  }

  return { valid: true }
}

/**
 * Rate limiter for client-side actions
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor(windowMs: number = 60000, maxRequests: number = 20) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
  }

  isAllowed(key: string): boolean {
    const now = Date.now()
    const windowStart = now - this.windowMs

    const timestamps = this.requests.get(key) || []
    const recentTimestamps = timestamps.filter(t => t > windowStart)

    if (recentTimestamps.length >= this.maxRequests) {
      return false
    }

    recentTimestamps.push(now)
    this.requests.set(key, recentTimestamps)
    return true
  }

  reset(key: string): void {
    this.requests.delete(key)
  }

  getRemainingRequests(key: string): number {
    const now = Date.now()
    const windowStart = now - this.windowMs

    const timestamps = this.requests.get(key) || []
    const recentTimestamps = timestamps.filter(t => t > windowStart)

    return Math.max(0, this.maxRequests - recentTimestamps.length)
  }
}

export const rateLimiters = {
  // API calls: 20 per minute
  api: new RateLimiter(60000, 20),

  // Form submissions: 5 per minute
  formSubmit: new RateLimiter(60000, 5),

  // File uploads: 10 per minute
  fileUpload: new RateLimiter(60000, 10),

  // Auth attempts: 5 per 15 minutes
  auth: new RateLimiter(15 * 60000, 5),
}

/**
 * CSRF token management
 */
export const csrfToken = {
  generate(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  },

  store(token: string): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('csrf_token', token)
    }
  },

  get(): string | null {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('csrf_token')
    }
    return null
  },

  validate(token: string): boolean {
    const stored = this.get()
    return stored !== null && stored === token
  },
}

/**
 * Content Security Policy helpers
 */
export const csp = {
  // Nonce for inline scripts (should be generated server-side)
  getNonce(): string | null {
    if (typeof document !== 'undefined') {
      const meta = document.querySelector('meta[name="csp-nonce"]')
      return meta?.getAttribute('content') || null
    }
    return null
  },
}

/**
 * Secure cookie helpers
 */
export const secureCookie = {
  set(name: string, value: string, days: number = 7): void {
    if (typeof document === 'undefined') return

    const date = new Date()
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)

    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/; SameSite=Strict${secure}`
  },

  get(name: string): string | null {
    if (typeof document === 'undefined') return null

    const cookies = document.cookie.split('; ')
    for (const cookie of cookies) {
      const [cookieName, cookieValue] = cookie.split('=')
      if (cookieName === name) {
        return decodeURIComponent(cookieValue)
      }
    }
    return null
  },

  delete(name: string): void {
    if (typeof document === 'undefined') return
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  },
}

/**
 * Password strength validator (Client-side)
 * Note: Server-side validation via /validate-password Edge Function is authoritative
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  score: number
  feedback: string[]
} {
  const feedback: string[] = []
  let score = 0

  // Government-grade minimum: 12 characters (upgraded from 8)
  if (password.length >= 12) score++
  else feedback.push('Password must be at least 12 characters')

  if (password.length >= 16) score++

  if (/[a-z]/.test(password)) score++
  else feedback.push('Add lowercase letters')

  if (/[A-Z]/.test(password)) score++
  else feedback.push('Add uppercase letters')

  if (/[0-9]/.test(password)) score++
  else feedback.push('Add numbers')

  if (/[^a-zA-Z0-9]/.test(password)) score++
  else feedback.push('Add special characters (!@#$%^&*)')

  // Check for common patterns
  const commonPatterns = ['123456', 'password', 'qwerty', 'abc123', '12345678']
  if (commonPatterns.some(p => password.toLowerCase().includes(p))) {
    score = Math.max(0, score - 2)
    feedback.push('Avoid common password patterns')
  }

  return {
    valid: score >= 4 && password.length >= 12,
    score,
    feedback,
  }
}

/**
 * Server-side password validation via Edge Function
 * Use this for final validation before account creation/password changes
 */
export async function validatePasswordServer(
  password: string,
  email?: string,
  username?: string
): Promise<{
  valid: boolean
  score: number
  strength: string
  feedback: string[]
}> {
  const response = await fetch('/api/auth/validate-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, email, username }),
  })

  if (!response.ok) {
    throw new Error('Password validation failed')
  }

  return response.json()
}

/**
 * Sensitive data masking
 */
export function maskSensitiveData(data: string, type: 'email' | 'phone' | 'ssn' | 'card'): string {
  switch (type) {
    case 'email': {
      const [local, domain] = data.split('@')
      if (!domain) return '***'
      const maskedLocal = local.length > 2
        ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
        : '*'.repeat(local.length)
      return `${maskedLocal}@${domain}`
    }
    case 'phone':
      return data.replace(/(\d{3})(\d{3})(\d{4})/, '***-***-$3')
    case 'ssn':
      return data.replace(/(\d{3})(\d{2})(\d{4})/, '***-**-$3')
    case 'card':
      return '**** **** **** ' + data.slice(-4)
    default:
      return '***'
  }
}

/**
 * Security audit checklist (for documentation)
 */
export const SECURITY_AUDIT_CHECKLIST = {
  authentication: [
    'Passwords hashed with bcrypt/argon2 (server-side)',
    'Session tokens are cryptographically random',
    'Session expiration is enforced',
    'Password reset tokens expire after use',
    'Rate limiting on auth endpoints',
    'Account lockout after failed attempts',
  ],
  authorization: [
    'Row Level Security (RLS) enabled on all tables',
    'Server validates user permissions',
    'API routes check authentication',
    'Sensitive actions require re-authentication',
  ],
  dataProtection: [
    'HTTPS enforced everywhere',
    'Sensitive data encrypted at rest',
    'API keys stored in environment variables only',
    'No secrets in client-side code',
    'PII masked in logs',
  ],
  inputValidation: [
    'All user input sanitized',
    'File uploads validated (type, size)',
    'SQL injection prevented (parameterized queries)',
    'XSS prevented (content sanitization)',
    'CSRF protection implemented',
  ],
  headers: [
    'Content-Security-Policy configured',
    'X-Frame-Options: DENY',
    'X-Content-Type-Options: nosniff',
    'Strict-Transport-Security enabled',
    'Referrer-Policy configured',
  ],
  thirdParty: [
    'Dependencies audited for vulnerabilities',
    'OAuth providers configured correctly',
    'API keys have minimal permissions',
    'External services use HTTPS',
  ],
} as const
