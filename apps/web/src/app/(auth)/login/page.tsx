'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useRateLimitedAction } from '@/hooks/use-rate-limited-action'
import { useCsrfToken } from '@/hooks/use-csrf-token'
import { MFAVerify } from '@/components/auth/mfa-verify'
import { mfaService } from '@/lib/mfa'
import { logPredefinedEvent } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'
  const oauthError = searchParams.get('error')
  const oauthDetail = searchParams.get('detail')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showMFA, setShowMFA] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)

  const supabase = createClient()

  // Security hooks
  const { token: csrfToken, validate: validateCsrf } = useCsrfToken()
  const { execute: executeRateLimited, isLimited, remainingRequests } = useRateLimitedAction({
    limiterType: 'auth',
    identifier: email || 'anonymous',
    onRateLimited: () => setError('Too many login attempts. Please wait 15 minutes before trying again.'),
  })

  const handleEmailLogin = async (e: React.FormEvent) => {
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

    // Execute with rate limiting
    const result = await executeRateLimited(async () => {
      setLoading(true)
      const timer = logger.time('auth.login')
      try {
        // 1. Check server-side account lockout BEFORE attempting login
        const lockoutCheck = await fetch('/api/auth/check-lockout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check', email }),
        })

        if (lockoutCheck.ok) {
          const lockoutData = await lockoutCheck.json()
          if (lockoutData.isLocked) {
            const minutes = lockoutData.lockedUntil
              ? Math.max(1, Math.ceil((new Date(lockoutData.lockedUntil).getTime() - Date.now()) / 60000))
              : 15
            setError(`Account temporarily locked. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`)
            setLoading(false)
            return
          }
        }

        // 2. Attempt login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        // 3. Record attempt result (success or failure) for audit and lockout tracking
        await fetch('/api/auth/check-lockout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'record_attempt',
            email,
            success: !error,
            failure_reason: error ? 'invalid_credentials' : undefined,
          }),
        }).catch(err => console.error('Failed to record login attempt:', err))

        if (error) {
          // Log failed login attempt
          logPredefinedEvent('AUTH_LOGIN_FAILED', {
            action: 'verify',
            details: { email, reason: 'invalid_credentials' },
          })
          throw error
        }

        // Log successful login
        logPredefinedEvent('AUTH_LOGIN_SUCCESS', {
          action: 'verify',
          details: { email, method: 'password' },
        })

        // 4. Check if MFA is required
        const factors = await mfaService.listFactors()
        const verifiedFactor = factors.find(f => f.status === 'verified')

        if (verifiedFactor) {
          // Check current assurance level
          const currentLevel = await mfaService.getAssuranceLevel()

          if (currentLevel === 'aal1') {
            // User has MFA but hasn't verified in this session
            logPredefinedEvent('AUTH_MFA_REQUIRED', {
              action: 'verify',
              resourceType: 'mfa_factor',
              resourceId: verifiedFactor.id,
            })
            setMfaFactorId(verifiedFactor.id)
            setShowMFA(true)
            setLoading(false)
            return
          }
        }

        // No MFA required or already verified
        timer.end({ step: 'email_login', email })
        router.push(redirectTo)
        router.refresh()
      } catch (err) {
        // Next.js aborts fetch during re-renders — treat abort as success
        if (
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.message.includes('signal'))
        ) {
          router.push(redirectTo)
          router.refresh()
          return
        }
        timer.error(err, { step: 'email_login' })
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    })

    if (!result) {
      setLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    setError(null)
    setLoading(true)

    const callbackRedirectTo = `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`
    logger.info('oauth.start', { provider, redirectTo: callbackRedirectTo })

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackRedirectTo,
        },
      })

      if (error) {
        logger.error('oauth.start.error', error, { provider })
        throw error
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  const handleMFASuccess = () => {
    router.push(redirectTo)
    router.refresh()
  }

  const handleMFABack = () => {
    setShowMFA(false)
    setMfaFactorId(null)
    setEmail('')
    setPassword('')
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
        {!showMFA ? (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-lime-800">Welcome to FEED</CardTitle>
              <CardDescription className="text-stone-600">
                Sign in to access resources and connect with your community
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 bg-lime-50/30 mx-4 rounded-lg p-4 -mt-2">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                  {error}
                </div>
              )}

              {oauthError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md space-y-1">
                  <p className="font-medium">
                    Sign-in failed
                    {oauthError === 'oauth_provider' && ' (provider rejected the request)'}
                    {oauthError === 'exchange_failed' && ' (session exchange failed)'}
                    {oauthError === 'no_code' && ' (no authorization code received)'}
                    {oauthError === 'no_session' && ' (session was not created)'}
                  </p>
                  {oauthDetail && (
                    <p className="text-xs text-red-600 break-words font-mono">{decodeURIComponent(oauthDetail)}</p>
                  )}
                </div>
              )}

              {isLimited && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-3 rounded-md">
                  Too many login attempts. Please wait 15 minutes before trying again.
                </div>
              )}

              {!isLimited && remainingRequests <= 2 && remainingRequests > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm p-3 rounded-md">
                  Warning: {remainingRequests} login attempt{remainingRequests === 1 ? '' : 's'} remaining before temporary lockout.
                </div>
              )}

              <form onSubmit={handleEmailLogin} className="space-y-4">
                {/* CSRF Token */}
                <input type="hidden" name="csrf_token" value={csrfToken || ''} />
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
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="bg-white/90 border-lime-300 text-stone-900 placeholder:text-stone-400 focus:border-lime-600 focus:ring-lime-500/20"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
                  disabled={loading || isLimited}
                >
                  {loading ? 'Signing in...' : isLimited ? 'Locked - Wait 15 minutes' : 'Sign In'}
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
                  onClick={() => handleOAuthLogin('google')}
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
                  onClick={() => handleOAuthLogin('apple')}
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
              <Link href="/forgot-password" className="text-stone-500 hover:text-lime-700">
                Forgot your password?
              </Link>
              <div className="text-stone-500">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-lime-700 font-semibold underline hover:text-lime-900">
                  Sign up
                </Link>
              </div>
            </CardFooter>
          </>
        ) : (
          <CardContent className="bg-lime-50/30 mx-4 rounded-lg p-4 mt-4">
            {mfaFactorId && (
              <MFAVerify
                factorId={mfaFactorId}
                onSuccess={handleMFASuccess}
                onBack={handleMFABack}
              />
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundImage: 'url(/images/wheat-field-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="bg-stone-50/90 p-6 rounded-lg animate-pulse text-stone-700">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
