'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useRateLimitedAction } from '@/hooks/use-rate-limited-action'
import { useCsrfToken } from '@/hooks/use-csrf-token'
import { usePasswordStrength } from '@/hooks/use-password-strength'
import { sanitizeInput } from '@/lib/security'
import { logger } from '@/lib/logger'

export default function SignupPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  // Security hooks
  const { token: csrfToken, validate: validateCsrf } = useCsrfToken()
  const passwordStrength = usePasswordStrength(password)
  const { execute: executeRateLimited, isLimited } = useRateLimitedAction({
    limiterType: 'auth',
    identifier: email || 'anonymous',
    onRateLimited: () => setError('Too many signup attempts. Please wait 15 minutes before trying again.'),
  })

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // SECURITY: Validate CSRF token before any auth action. The token is
    // generated on mount by useCsrfToken, stored in sessionStorage, and
    // embedded in the hidden <input name="csrf_token"> field. validateCsrf()
    // calls csrfToken.validate() in security.ts which compares the current
    // sessionStorage value against the form token — a mismatch indicates the
    // form was submitted by a cross-origin request or a forged page, not by
    // the legitimate session that generated the token.
    if (!validateCsrf(csrfToken || '')) {
      setError('Security validation failed. Please refresh the page and try again.')
      return
    }

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!passwordStrength.valid) {
      setError('Password does not meet security requirements')
      return
    }

    if (!acceptTerms) {
      setError('You must accept the terms of service')
      return
    }

    // Execute with rate limiting
    const result = await executeRateLimited(async () => {
      setLoading(true)
      const timer = logger.time('auth.signup')
      try {
        // Sanitize user input
        const sanitizedName = sanitizeInput(fullName)

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: sanitizedName,
            },
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
          },
        })

        if (error) throw error

        // Detect fake signup (user already exists) - Supabase returns user with empty identities
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError('An account with this email already exists. Please sign in instead.')
          return
        }

        timer.end({ step: 'email_signup' })

        // Check if Supabase auto-confirmed the user (mailer_autoconfirm is on)
        // When auto-confirmed, email_confirmed_at is set immediately and no email is sent
        if (data.user?.email_confirmed_at) {
          router.push('/onboarding')
          return
        }

        setSuccess(true)
      } catch (err: unknown) {
        if (
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.message.includes('signal'))
        ) {
          timer.end({ step: 'email_signup', aborted: true })
          setSuccess(true)
          return
        }
        timer.error(err, { step: 'email_signup' })
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    })

    if (!result) {
      setLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email) return
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
        },
      })

      if (error) throw error
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend confirmation email')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthSignup = async (provider: 'google' | 'apple') => {
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=/onboarding`,
        },
      })

      if (error) throw error
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: 'url(/images/wheat-field-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-lime-50/60 via-stone-50/40 to-lime-100/50" />

        <Card className="w-full max-w-md relative z-10 bg-stone-50/95 text-stone-800 backdrop-blur-sm border-lime-200/60 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-lime-800">Check Your Email</CardTitle>
            <CardDescription className="text-stone-600">
              We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click the link to verify your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div className="text-sm text-stone-500 space-y-2">
              <p>Didn&apos;t receive it? Check your spam/junk folder.</p>
              <p>Make sure <strong>{email}</strong> is correct.</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                className="border-lime-300 bg-white/90 hover:bg-lime-100 text-stone-700"
                onClick={handleResendConfirmation}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Resend Email'}
              </Button>
              <Button
                variant="ghost"
                className="text-stone-500 hover:text-stone-700"
                onClick={() => setSuccess(false)}
              >
                Use Different Email
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center text-sm pt-4">
            <div className="text-stone-500">
              Already have an account?{' '}
              <Link href="/login" className="text-lime-700 font-semibold hover:underline">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url(/images/wheat-field-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay for better readability - sage/olive tones */}
      <div className="absolute inset-0 bg-gradient-to-b from-lime-50/60 via-stone-50/40 to-lime-100/50" />

      <Card className="w-full max-w-md relative z-10 bg-stone-50/95 text-stone-800 backdrop-blur-sm border-lime-200/60 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-lime-800">Join FEED</CardTitle>
          <CardDescription className="text-stone-600">
            Create an account to access community resources and support
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 bg-lime-50/30 mx-4 rounded-lg p-4 -mt-2">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          {isLimited && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-3 rounded-md">
              Too many signup attempts. Please wait 15 minutes before trying again.
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            {/* CSRF Token */}
            <input type="hidden" name="csrf_token" value={csrfToken || ''} />
            <div className="space-y-2">
              <label htmlFor="fullName" className="text-sm font-medium text-stone-700">
                Full Name
              </label>
              <Input
                id="fullName"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                className="bg-white/90 border-lime-300 text-stone-900 placeholder:text-stone-400 focus:border-lime-600 focus:ring-lime-500/20"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-stone-700">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-white/90 border-lime-300 text-stone-900 placeholder:text-stone-400 focus:border-lime-600 focus:ring-lime-500/20"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-stone-700">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="At least 12 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={12}
                className="bg-white/90 border-lime-300 text-stone-900 placeholder:text-stone-400 focus:border-lime-600 focus:ring-lime-500/20"
              />
              {/* Password Strength Indicator */}
              {password && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${(passwordStrength.score / 6) * 100}%`,
                          backgroundColor: passwordStrength.color,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium" style={{ color: passwordStrength.color }}>
                      {passwordStrength.strength}
                    </span>
                  </div>
                  {passwordStrength.feedback.length > 0 && (
                    <ul className="text-xs text-stone-500 space-y-0.5 ml-1">
                      {passwordStrength.feedback.map((msg, i) => (
                        <li key={i}>• {msg}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-stone-700">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-white/90 border-lime-300 text-stone-900 placeholder:text-stone-400 focus:border-lime-600 focus:ring-lime-500/20"
              />
            </div>

            <div className="flex items-start space-x-2">
              <input
                id="terms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-lime-300"
                disabled={loading}
              />
              <label htmlFor="terms" className="text-sm text-stone-500">
                I agree to the{' '}
                <a href="#terms" className="text-lime-700 hover:underline" onClick={(e) => { e.preventDefault(); alert('Terms of Service coming soon.') }}>
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#privacy" className="text-lime-700 hover:underline" onClick={(e) => { e.preventDefault(); alert('Privacy Policy coming soon.') }}>
                  Privacy Policy
                </a>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
              disabled={loading || isLimited || (password.length > 0 && !passwordStrength.valid)}
            >
              {loading ? 'Creating account...' : isLimited ? 'Locked - Wait 15 minutes' : 'Create Account'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-lime-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-lime-50/80 px-2 text-stone-500">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="border-lime-300 bg-white/90 hover:bg-lime-100 text-stone-700"
              onClick={() => handleOAuthSignup('google')}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
            <Button
              variant="outline"
              className="border-lime-300 bg-white/90 hover:bg-lime-100 text-stone-700"
              onClick={() => handleOAuthSignup('apple')}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                />
              </svg>
              Apple
            </Button>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2 text-center text-sm pt-4">
          <div className="text-stone-500">
            Already have an account?{' '}
            <Link href="/login" className="text-lime-700 font-semibold underline hover:text-lime-900">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
