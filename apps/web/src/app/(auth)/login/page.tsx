'use client'

// apps/web/src/app/(auth)/login/page.tsx
// Sign in, in the visitor's language: useProfileLocale() — before any profile, the locale the root
// layout resolved from the feed_locale cookie, else Accept-Language (lib/request-locale.ts) — with
// lang/dir on the card's root. The headings and labels shared with lib/i18n.ts come from t(); the
// rest from lib/i18n-auth.ts. A failure line is chosen from the error's code, never its text, and
// Supabase's own text is never shown. The Supabase calls, redirects, redirectTo validation and the
// step-up flow are the same in every language.

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useRateLimitedAction } from '@/hooks/use-rate-limited-action'
import { useCsrfToken } from '@/hooks/use-csrf-token'
import { MFAVerify } from '@/components/auth/mfa-verify'
import { TurnstileWidget, type TurnstileWidgetHandle } from '@/components/auth/turnstile-widget'
import { mfaService } from '@/lib/mfa'
import { logPredefinedEvent } from '@/lib/audit-logger'
import { logger } from '@/lib/logger'
import { safeRelativePath } from '@/lib/safe-redirect'
import { requiresMfa } from '@/lib/mfa-routes'
import { t, dir } from '@/lib/i18n'
import { authT, authCount, ATTEMPTS_REMAINING, LOCKED_MINUTES, oauthErrorKey, signInFailureKey, type AuthKey } from '@/lib/i18n-auth'
import { failureCode } from '@/lib/failure-code'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { cn } from '@/lib/utils'
import { afterLayout, announce, AnnouncementText, clearAnnouncement, NO_ANNOUNCEMENT, type Announcement } from '@/app/(admin)/moderation/row-focus'

/** The input classes of this page: 3:1 border, readable placeholder. */
const INPUT = 'bg-white/90 border-stone-500 text-stone-900 placeholder:text-stone-600 focus:border-lime-700 focus:ring-lime-500/20'
/** A busy or unavailable button keeps focus (aria-disabled) and reads as unavailable in solid colours. */
const UNAVAILABLE = 'bg-stone-200 text-stone-700 hover:bg-stone-200 cursor-not-allowed'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Open-redirect guard: sanitize at read time so every router.push(redirectTo)
  // and the propagated OAuth callback URL use a safe same-origin path (CWE-601).
  const redirectTo = safeRelativePath(searchParams.get('redirectTo'), '/')
  // Step-up: the proxy sends a signed-in session with an unverified factor here from an admin route.
  const isStepUp = searchParams.get('step') === 'mfa'
  // The callback's error code; its `detail` (the provider's or Supabase's own text) is not shown.
  const oauthError = searchParams.get('error')

  const locale = useProfileLocale()
  const a = (key: AuthKey) => authT(locale, key)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // The one alert region's text (always mounted while the form shows; one node per failure).
  const [alertLine, setAlert] = useState<Announcement>(NO_ANNOUNCEMENT)
  const setError = (text: string | null) => (text ? announce(setAlert, text) : clearAnnouncement(setAlert))
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [showMFA, setShowMFA] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  // Turnstile CAPTCHA token — undefined when no site key is set (no-op).
  const [captchaToken, setCaptchaToken] = useState<string>()
  const turnstileRef = useRef<TurnstileWidgetHandle>(null)

  const supabase = createClient()

  // Step-up (/login?step=mfa): show the code prompt for the signed-in session's verified factor,
  // once. A session that is already aal2 goes straight on; with no verified factor (signed out),
  // the sign-in form shows as usual.
  const stepUpChecked = useRef(false)
  useEffect(() => {
    if (!isStepUp || stepUpChecked.current) return
    stepUpChecked.current = true
    void (async () => {
      const verifiedFactor = (await mfaService.listFactors()).find((f) => f.status === 'verified')
      if (!verifiedFactor) return
      if ((await mfaService.getAssuranceLevel()) === 'aal2') {
        router.replace(redirectTo)
        return
      }
      setMfaFactorId(verifiedFactor.id)
      setShowMFA(true)
    })()
  }, [isStepUp, redirectTo, router])

  // Security hooks
  const { token: csrfToken, validate: validateCsrf } = useCsrfToken()
  const { execute: executeRateLimited, isLimited, remainingRequests } = useRateLimitedAction({
    limiterType: 'auth',
    identifier: email || 'anonymous',
    onRateLimited: () => setError(a('loginRateLimited')),
  })

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    // The submit button is aria-disabled (not disabled) while busy or locked: a press does nothing.
    if (loading || isLimited) return
    setError(null)

    // SECURITY: Validate CSRF token before any auth action. The token is
    // generated on mount by useCsrfToken, stored in sessionStorage, and
    // embedded in the hidden <input name="csrf_token"> field. validateCsrf()
    // calls csrfToken.validate() in security.ts which compares the current
    // sessionStorage value against the form token — a mismatch indicates the
    // form was submitted by a cross-origin request or a forged page, not by
    // the legitimate session that generated the token.
    if (!validateCsrf(csrfToken || '')) {
      setError(a('securityCheckFailed'))
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
            setError(authCount(LOCKED_MINUTES, minutes, locale))
            setLoading(false)
            return
          }
        }

        // Capture whether a guest/anonymous session is currently active. A
        // password sign-in replaces it, but we verify below that the browser
        // client ends on the real session so no guest token lingers behind the
        // new credentials.
        const { data: { session: priorSession } } = await supabase.auth.getSession()
        const priorWasAnonymous =
          (priorSession?.user as unknown as { is_anonymous?: boolean } | undefined)?.is_anonymous ?? false

        // 2. Attempt login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken },
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
          // AUTH_LOGIN_FAILED is now captured server-side in check-lockout/route.ts
          // (service-role insert avoids the anon RLS 42501 that silently dropped it here)
          throw error
        }

        // A prior guest session has been replaced by this authenticated
        // sign-in. Refresh once to guarantee the browser client holds the real
        // session and no anonymous token lingers behind the new credentials.
        if (priorWasAnonymous) {
          await supabase.auth.refreshSession()
        }

        // Log successful login
        // The audit row carries the method only; the actor is the signed-in user (no email: the
        // audit log is admin-readable).
        logPredefinedEvent('AUTH_LOGIN_SUCCESS', {
          action: 'verify',
          details: { method: 'password' },
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
        timer.end({ step: 'email_login' })
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
        // A refused password sign-in is recorded server-side (check-lockout record_attempt); the line
        // shown comes from the error's code.
        setError(a(signInFailureKey(failureCode(err))))
      } finally {
        setLoading(false)
        // Turnstile tokens are single-use — reset so any retry gets a fresh one.
        turnstileRef.current?.reset()
        setCaptchaToken(undefined)
      }
    })

    if (!result) {
      setLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    if (loading) return
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
        // Code only: the provider's message is neither stored nor shown.
        logger.error('oauth.start.error', { code: failureCode(error) }, { provider })
        throw error
      }
    } catch {
      setError(a('oauthStartFailed'))
      setLoading(false)
    }
  }

  // Admin routes need an aal2 session. A backup code is checked by the app and does not raise the
  // session to aal2, so for an admin destination the backup-code option is hidden (a code would be
  // consumed and still refused) and navigation waits for aal2. A refusal is returned to MFAVerify,
  // which shows it in its one alert region.
  const destinationNeedsAal2 = requiresMfa(redirectTo.split(/[?#]/)[0])
  const handleMFASuccess = async (): Promise<string | null> => {
    if (destinationNeedsAal2 && (await mfaService.getAssuranceLevel()) !== 'aal2') {
      return a('mfaCodeNeeded')
    }
    router.push(redirectTo)
    router.refresh()
    return null
  }

  const handleMFABack = () => {
    setShowMFA(false)
    setMfaFactorId(null)
    setEmail('')
    setPassword('')
    // The code prompt is gone: focus goes to the email field of the sign-in form that replaces it.
    afterLayout(() => document.getElementById('email')?.focus())
  }

  const handleGuestAccess = async () => {
    if (loading || guestLoading) return
    setError(null)
    setGuestLoading(true)
    try {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      router.push('/')
      router.refresh()
    } catch (err: unknown) {
      // Next.js aborts fetch during re-renders — treat abort as success
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        router.push('/')
        router.refresh()
        return
      }
      logger.warn('auth.guest.failed', { code: failureCode(err), step: 'login' })
      setError(a('guestFailed'))
    } finally {
      setGuestLoading(false)
    }
  }

  return (
    <div
      lang={locale}
      dir={dir(locale)}
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
              <CardTitle className="text-2xl font-bold text-lime-800">{t(locale, 'welcome')}</CardTitle>
              <CardDescription className="text-stone-700">
                {t(locale, 'signInSubtitle')}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 bg-lime-50/30 mx-4 rounded-lg p-4 -mt-2">
              {/* One alert region, always mounted; each failure inserts a new node. */}
              <div role="alert" className={alertLine.text ? 'bg-red-50 border border-red-700 text-red-800 text-sm p-3 rounded-md' : undefined}>
                <AnnouncementText announcement={alertLine} />
              </div>

              {/* The callback's error code (the provider's own text in `detail` is not shown). */}
              {oauthError && (
                <div className="bg-red-50 border border-red-700 text-red-800 text-sm p-3 rounded-md">
                  <p className="font-medium">{a(oauthErrorKey(oauthError))}</p>
                </div>
              )}

              {isLimited && (
                <div className="bg-amber-50 border border-amber-700 text-amber-800 text-sm p-3 rounded-md">
                  {a('loginRateLimited')}
                </div>
              )}

              <p role="status" className={!isLimited && remainingRequests <= 2 && remainingRequests > 0 ? 'bg-yellow-50 border border-yellow-700 text-yellow-800 text-sm p-3 rounded-md' : undefined}>
                {!isLimited && remainingRequests <= 2 && remainingRequests > 0 ? authCount(ATTEMPTS_REMAINING, remainingRequests, locale) : null}
              </p>

              <form onSubmit={handleEmailLogin} className="space-y-4">
                {/* CSRF Token */}
                <input type="hidden" name="csrf_token" value={csrfToken || ''} />
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-stone-800">
                    {t(locale, 'emailLabel')}
                  </label>
                  <Input
                    id="email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-required="true"
                    readOnly={loading}
                    className={INPUT}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-stone-800">
                    {t(locale, 'passwordLabel')}
                  </label>
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    aria-required="true"
                    readOnly={loading}
                    className={INPUT}
                  />
                </div>

                <TurnstileWidget
                  ref={turnstileRef}
                  onVerify={setCaptchaToken}
                  onExpireOrError={() => setCaptchaToken(undefined)}
                />

                <Button
                  type="submit"
                  className={cn('w-full h-auto min-h-9 whitespace-normal bg-green-700 hover:bg-green-800 text-white font-medium', isLimited && UNAVAILABLE)}
                  aria-disabled={loading || isLimited}
                >
                  {loading ? a('signingIn') : isLimited ? a('lockedWait') : t(locale, 'signIn')}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-lime-300" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-lime-50 px-2 text-stone-700">
                    {a('orContinueWith')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="border-stone-500 bg-white/90 hover:bg-lime-100 text-stone-800"
                  onClick={() => handleOAuthLogin('google')}
                  aria-disabled={loading}
                >
                  <svg aria-hidden="true" className="me-2 h-4 w-4" viewBox="0 0 24 24">
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
                  className="border-stone-500 bg-white/90 hover:bg-lime-100 text-stone-800"
                  onClick={() => handleOAuthLogin('apple')}
                  aria-disabled={loading}
                >
                  <svg aria-hidden="true" className="me-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                    />
                  </svg>
                  Apple
                </Button>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-3 text-center text-sm pt-4">
              {/* Find Help Now — guest access, no account required */}
              <div className="w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-auto min-h-9 whitespace-normal border-lime-700 bg-lime-50 hover:bg-lime-100 text-lime-800 font-semibold py-2.5"
                  onClick={handleGuestAccess}
                  aria-disabled={loading || guestLoading}
                  data-testid="guest-access-btn"
                >
                  <Eye aria-hidden="true" className="me-2 h-4 w-4" />
                  {guestLoading ? a('opening') : t(locale, 'findHelpNow')}
                </Button>
                <p className="text-xs text-stone-700 mt-1">{a('guestHint')}</p>
              </div>

              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-stone-300" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-stone-50 px-2 text-stone-700">{a('orSignIn')}</span>
                </div>
              </div>

              <Link href="/forgot-password" className="inline-flex min-h-6 items-center text-stone-700 underline hover:text-lime-800">
                {t(locale, 'forgotPassword')}
              </Link>
              <div className="text-stone-700">
                {t(locale, 'noAccountText')}{' '}
                <Link href="/signup" className="text-lime-800 underline font-medium">
                  {t(locale, 'signUpLabel')}
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
                allowBackupCode={!destinationNeedsAal2}
              />
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}

function LoginLoading() {
  const locale = useProfileLocale()
  return (
    <div
      lang={locale}
      dir={dir(locale)}
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundImage: 'url(/images/wheat-field-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div role="status" className="bg-stone-50/90 p-6 rounded-lg animate-pulse text-stone-800">{authT(locale, 'loading')}</div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  )
}
