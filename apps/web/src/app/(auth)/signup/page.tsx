'use client'

// apps/web/src/app/(auth)/signup/page.tsx
// Sign up, in the visitor's language (useProfileLocale: the feed_locale cookie, else
// Accept-Language), with lang/dir on the card's root; words from lib/i18n.ts t() and
// lib/i18n-auth.ts. A failure line comes from the error's code, never its text; a failed sign-up,
// resend or guest start writes one auth.signup.failed / auth.guest.failed row with the code only.
// The Terms of Service / Privacy Policy row stays English (lang="en") until the legal pages exist.
// The Supabase calls, their arguments and every redirect are the same in every language.

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useRateLimitedAction } from '@/hooks/use-rate-limited-action'
import { useCsrfToken } from '@/hooks/use-csrf-token'
import { usePasswordStrength } from '@/hooks/use-password-strength'
import { TurnstileWidget, type TurnstileWidgetHandle } from '@/components/auth/turnstile-widget'
import { sanitizeInput } from '@/lib/security'
import { logger } from '@/lib/logger'
import { t, dir } from '@/lib/i18n'
import { authT, passwordFeedbackKey, passwordTooLong, signUpFailureKey, strengthKey, type AuthKey } from '@/lib/i18n-auth'
import { formatMessage, splitMessage } from '@/lib/format-message'
import { failureCode } from '@/lib/failure-code'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { cn } from '@/lib/utils'
import { announce, AnnouncementText, clearAnnouncement, NO_ANNOUNCEMENT, type Announcement } from '@/app/(admin)/moderation/row-focus'

/** The input classes of this page: 3:1 border, readable placeholder. */
const INPUT = 'bg-white/90 border-stone-500 text-stone-900 placeholder:text-stone-600 focus:border-lime-700 focus:ring-lime-500/20'
/** A busy or unavailable button keeps focus (aria-disabled) and reads as unavailable in solid colours. */
const UNAVAILABLE = 'bg-stone-200 text-stone-700 hover:bg-stone-200 cursor-not-allowed'

/** "We've sent a link to {email}…": the address kept whole, left to right, inside the sentence. */
function WithEmail({ template, email }: { template: string; email: string }) {
  const [before, after] = splitMessage(template, 'email')
  return (
    <>
      {before}
      <strong dir="ltr">{email}</strong>
      {after}
    </>
  )
}

export default function SignupPage() {
  const router = useRouter()
  const locale = useProfileLocale()
  const a = (key: AuthKey) => authT(locale, key)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  // The one alert region's text (always mounted on each view; one node per failure).
  const [alertLine, setAlert] = useState<Announcement>(NO_ANNOUNCEMENT)
  const setError = (text: string | null) => (text ? announce(setAlert, text) : clearAnnouncement(setAlert))
  // "Check your email": a resend that worked is said in its own always-mounted status line.
  const [resendStatus, setResendStatus] = useState<Announcement>(NO_ANNOUNCEMENT)
  const [success, setSuccess] = useState(false)
  // The view switches (form ↔ "Check your email"): focus goes to the new view's heading.
  const checkEmailRef = useRef<HTMLHeadingElement>(null)
  const shownView = useRef(success)
  useEffect(() => {
    if (shownView.current === success) return
    shownView.current = success
    if (success) checkEmailRef.current?.focus()
    else document.getElementById('email')?.focus()
  }, [success])
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  // Turnstile CAPTCHA token — undefined when no site key is set (no-op).
  const [captchaToken, setCaptchaToken] = useState<string>()
  const turnstileRef = useRef<TurnstileWidgetHandle>(null)

  const supabase = createClient()

  // Security hooks
  const { token: csrfToken, validate: validateCsrf } = useCsrfToken()
  const passwordStrength = usePasswordStrength(password)
  const { execute: executeRateLimited, isLimited } = useRateLimitedAction({
    limiterType: 'auth',
    identifier: email || 'anonymous',
    onRateLimited: () => setError(a('signupRateLimited')),
  })

  const handleSignup = async (e: React.FormEvent) => {
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

    // Validation
    if (password !== confirmPassword) {
      setError(a('passwordsMismatch'))
      return
    }

    // The limit is in bytes (UTF-8), checked before any call.
    if (passwordTooLong(password)) {
      setError(a('passwordTooLong'))
      return
    }

    if (!passwordStrength.valid) {
      setError(a('passwordTooWeak'))
      return
    }

    if (!acceptTerms) {
      setError(a('acceptTermsRequired'))
      return
    }

    // Execute with rate limiting
    const result = await executeRateLimited(async () => {
      setLoading(true)
      const timer = logger.time('auth.signup')
      try {
        // Sanitize user input. First name is public + immutable; last name is
        // private (reveals only inside a conversation, sourcer→seeker). full_name
        // is composed for back-compat with existing surfaces.
        const sanitizedFirst = sanitizeInput(firstName)
        const sanitizedLast = sanitizeInput(lastName)
        const sanitizedFull = [sanitizedFirst, sanitizedLast]
          .filter(Boolean)
          .join(' ')
          .trim()

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken,
            data: {
              first_name: sanitizedFirst,
              last_name: sanitizedLast,
              full_name: sanitizedFull,
            },
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
          },
        })

        if (error) throw error

        // Detect fake signup (user already exists) - Supabase returns user with empty identities
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          logger.warn('auth.signup.failed', { code: 'user_already_exists', step: 'signup' })
          setError(a('accountExists'))
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
        const code = failureCode(err)
        logger.warn('auth.signup.failed', { code, step: 'signup' })
        setError(a(signUpFailureKey(code, 'signupFailed', passwordTooLong(password))))
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

  const handleResendConfirmation = async () => {
    if (!email || loading) return
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          captchaToken,
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
        },
      })

      if (error) throw error
      setError(null)
      announce(setResendStatus, a('resendSent'))
    } catch (err) {
      const code = failureCode(err)
      logger.warn('auth.signup.failed', { code, step: 'resend' })
      setError(a(signUpFailureKey(code, 'resendFailed')))
    } finally {
      setLoading(false)
      // Turnstile tokens are single-use — reset so any retry gets a fresh one.
      turnstileRef.current?.reset()
      setCaptchaToken(undefined)
    }
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
      logger.warn('auth.guest.failed', { code: failureCode(err), step: 'signup' })
      setError(a('guestFailed'))
    } finally {
      setGuestLoading(false)
    }
  }

  const handleOAuthSignup = async (provider: 'google' | 'apple') => {
    if (loading) return
    setError(null)
    setLoading(true)

    const callbackRedirectTo = `${window.location.origin}/auth/callback?redirectTo=/onboarding`
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

  if (success) {
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
        <div className="absolute inset-0 bg-gradient-to-b from-lime-50/60 via-stone-50/40 to-lime-100/50" />

        <Card className="w-full max-w-md relative z-10 bg-stone-50/95 text-stone-800 backdrop-blur-sm border-lime-200/60 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-lime-800">
              <span ref={checkEmailRef} tabIndex={-1} className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-700">{a('checkEmailTitle')}</span>
            </CardTitle>
            <CardDescription className="text-stone-700 break-words">
              <WithEmail template={a('checkEmailSent')} email={email} />
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div role="alert" className={alertLine.text ? 'bg-red-50 border border-red-700 text-red-800 text-sm p-3 rounded-md' : undefined}>
              <AnnouncementText announcement={alertLine} />
            </div>
            <p role="status" className="text-sm text-green-800">
              <AnnouncementText announcement={resendStatus} />
            </p>
            <div className="text-sm text-stone-700 space-y-2 break-words">
              <p>{a('checkSpam')}</p>
              <p><WithEmail template={a('confirmEmailCorrect')} email={email} /></p>
            </div>
            <TurnstileWidget
              ref={turnstileRef}
              onVerify={setCaptchaToken}
              onExpireOrError={() => setCaptchaToken(undefined)}
            />
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                className="border-stone-500 bg-white/90 hover:bg-lime-100 text-stone-800"
                onClick={handleResendConfirmation}
                aria-disabled={loading}
              >
                {loading ? a('sending') : a('resendEmail')}
              </Button>
              <Button
                variant="ghost"
                className="text-stone-700 hover:text-stone-900"
                onClick={() => setSuccess(false)}
              >
                {a('useDifferentEmail')}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center text-sm pt-4">
            <div className="text-stone-700">
              {a('haveAccount')}{' '}
              <Link href="/login" className="text-lime-800 font-semibold underline">
                {t(locale, 'signIn')}
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    )
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
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-lime-800">{a('joinTitle')}</CardTitle>
          <CardDescription className="text-stone-700">
            {a('joinSubtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 bg-lime-50/30 mx-4 rounded-lg p-4 -mt-2">
          {/* One alert region, always mounted; each failure inserts a new node. */}
          <div role="alert" className={alertLine.text ? 'bg-red-50 border border-red-700 text-red-800 text-sm p-3 rounded-md' : undefined}>
            <AnnouncementText announcement={alertLine} />
          </div>

          {isLimited && (
            <div className="bg-amber-50 border border-amber-700 text-amber-800 text-sm p-3 rounded-md">
              {a('signupRateLimited')}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            {/* CSRF Token */}
            <input type="hidden" name="csrf_token" value={csrfToken || ''} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2 min-w-0">
                <label htmlFor="firstName" className="block text-sm font-medium text-stone-800">
                  {a('firstName')}
                </label>
                <Input
                  id="firstName"
                  type="text"
                  dir="auto"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  aria-required="true"
                  aria-describedby="firstName-hint"
                  readOnly={loading}
                  className={INPUT}
                />
                <p id="firstName-hint" className="text-xs text-stone-700">{a('firstNameHint')}</p>
              </div>
              <div className="space-y-2 min-w-0">
                <label htmlFor="lastName" className="block text-sm font-medium text-stone-800">
                  {a('lastName')}
                </label>
                <Input
                  id="lastName"
                  type="text"
                  dir="auto"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  aria-describedby="lastName-hint"
                  readOnly={loading}
                  className={INPUT}
                />
                <p id="lastName-hint" className="text-xs text-stone-700">{a('lastNameHint')}</p>
              </div>
            </div>

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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-required="true"
                aria-describedby="password-hint password-strength"
                readOnly={loading}
                minLength={12}
                className={INPUT}
              />
              <p id="password-hint" className="text-xs text-stone-700">{a('signupPasswordHint')}</p>
              {/* Password strength. The bar is decoration; the line says it. The line is one polite
                  live region, always mounted, whose text changes only when the strength word
                  changes — so it speaks once per change, not per keystroke. The block (line and
                  hints) also describes the field. */}
              <div id="password-strength" className="space-y-1">
                <div className="flex items-center gap-2">
                  {password && (
                    <div aria-hidden="true" className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${(passwordStrength.score / 6) * 100}%`,
                          backgroundColor: passwordStrength.color,
                        }}
                      />
                    </div>
                  )}
                  <span aria-live="polite" aria-atomic="true" className="text-xs font-medium text-stone-800">
                    {password ? formatMessage(a('passwordStrength'), { strength: a(strengthKey(passwordStrength.strength)) }) : ''}
                  </span>
                </div>
                {password && passwordStrength.feedback.length > 0 && (
                  <ul className="text-xs text-stone-700 space-y-0.5 ms-1">
                    {passwordStrength.feedback.map((msg) => passwordFeedbackKey(msg)).filter((k): k is AuthKey => k !== null).map((key) => (
                      <li key={key}>• {a(key)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-stone-800">
                {a('confirmPassword')}
              </label>
              <Input
                id="confirmPassword"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                aria-required="true"
                readOnly={loading}
                className={INPUT}
              />
            </div>

            {/* Terms of Service / Privacy Policy: placeholder copy until the legal pages exist, so it
                stays English and is marked so. */}
            <div lang="en" dir="ltr" className="flex items-start gap-2">
              <input
                id="terms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => {
                  if (!loading) setAcceptTerms(e.target.checked)
                }}
                aria-required="true"
                aria-disabled={loading}
                className="mt-0.5 h-6 w-6 flex-shrink-0 rounded border-stone-500 accent-lime-700"
              />
              <label htmlFor="terms" className="text-sm text-stone-700">
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

            <TurnstileWidget
              ref={turnstileRef}
              onVerify={setCaptchaToken}
              onExpireOrError={() => setCaptchaToken(undefined)}
            />

            <Button
              type="submit"
              className={cn(
                'w-full h-auto min-h-9 whitespace-normal bg-green-700 hover:bg-green-800 text-white font-medium',
                (isLimited || (password.length > 0 && !passwordStrength.valid)) && UNAVAILABLE
              )}
              aria-disabled={loading || isLimited || (password.length > 0 && !passwordStrength.valid)}
            >
              {loading ? a('creatingAccount') : isLimited ? a('lockedWait') : a('createAccount')}
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
              onClick={() => handleOAuthSignup('google')}
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
              onClick={() => handleOAuthSignup('apple')}
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
              <span className="bg-stone-50 px-2 text-stone-700">{a('orCreateAccount')}</span>
            </div>
          </div>

          <div className="text-stone-700">
            {a('haveAccount')}{' '}
            <Link href="/login" className="text-lime-800 font-semibold underline hover:text-lime-900">
              {t(locale, 'signIn')}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
