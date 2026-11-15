'use client'

// apps/web/src/app/(auth)/forgot-password/page.tsx
// Request a password reset link, in the visitor's language (useProfileLocale: the feed_locale
// cookie, else Accept-Language; lib/i18n-auth.ts). A failure line comes from the error's code and
// writes one auth.password.failed row {code, step: 'forgot'}; the Supabase call is unchanged.

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { TurnstileWidget, type TurnstileWidgetHandle } from '@/components/auth/turnstile-widget'
import { logger } from '@/lib/logger'
import { dir } from '@/lib/i18n'
import { authT, passwordFailureKey, type AuthKey } from '@/lib/i18n-auth'
import { failureCode } from '@/lib/failure-code'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { announce, AnnouncementText, clearAnnouncement, NO_ANNOUNCEMENT, type Announcement } from '@/app/(admin)/moderation/row-focus'

/** The input classes of this page: 3:1 border, readable placeholder. */
const INPUT = 'bg-white/90 border-stone-500 text-stone-900 placeholder:text-stone-600 focus:border-lime-700 focus:ring-lime-500/20'

export default function ForgotPasswordPage() {
  const locale = useProfileLocale()
  const a = (key: AuthKey) => authT(locale, key)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  // The one alert region's text (always mounted with the form; one node per failure).
  const [alertLine, setAlert] = useState<Announcement>(NO_ANNOUNCEMENT)
  const setError = (text: string | null) => (text ? announce(setAlert, text) : clearAnnouncement(setAlert))
  const [submitted, setSubmitted] = useState(false)
  // The form is replaced by the confirmation: focus goes to it.
  const sentRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (submitted) sentRef.current?.focus()
  }, [submitted])
  // Turnstile CAPTCHA token — undefined when no site key is set (no-op).
  const [captchaToken, setCaptchaToken] = useState<string>()
  const turnstileRef = useRef<TurnstileWidgetHandle>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // The submit button is aria-disabled (not disabled) while busy: a press does nothing.
    if (loading) return
    setError(null)
    setLoading(true)
    const timer = logger.time('auth.forgot_password')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        captchaToken,
        redirectTo: `${window.location.origin}/auth/confirm?type=recovery&next=/reset-password`,
      })

      if (error) throw error

      timer.end({ step: 'reset_request' })
      setSubmitted(true)
    } catch (err: unknown) {
      // Next.js App Router aborts fetch during re-renders — treat abort as success
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        timer.end({ step: 'reset_request', aborted: true })
        setSubmitted(true)
        return
      }
      timer.error(err, { step: 'reset_request' })
      const code = failureCode(err)
      logger.warn('auth.password.failed', { code, step: 'forgot' })
      setError(a(passwordFailureKey(code, 'forgotFailed')))
    } finally {
      setLoading(false)
      // Turnstile tokens are single-use — reset so any retry gets a fresh one.
      turnstileRef.current?.reset()
      setCaptchaToken(undefined)
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
      <div className="absolute inset-0 bg-gradient-to-b from-lime-50/60 via-stone-50/40 to-lime-100/50" />

      <Card className="w-full max-w-md relative z-10 bg-stone-50/95 text-stone-800 backdrop-blur-sm border-lime-200/60 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-lime-800">{a('forgotTitle')}</CardTitle>
          <CardDescription className="text-stone-700">
            {a('forgotSubtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 bg-lime-50/30 mx-4 rounded-lg p-4 -mt-2 mb-4">
          {submitted ? (
            <div className="text-center space-y-4 py-2">
              <p ref={sentRef} tabIndex={-1} className="text-stone-800 font-medium rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-700">{a('forgotSent')}</p>
              <p className="text-stone-700 text-sm">
                {a('forgotSpam')}
              </p>
              <Link
                href="/login"
                className="inline-flex min-h-6 items-center text-sm text-lime-800 font-semibold underline hover:text-lime-900"
              >
                {a('backToSignIn')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* One alert region, always mounted; each failure inserts a new node. */}
              <div role="alert" className={alertLine.text ? 'bg-red-50 border border-red-700 text-red-800 text-sm p-3 rounded-md' : undefined}>
                <AnnouncementText announcement={alertLine} />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-stone-800">
                  {a('emailAddress')}
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

              <TurnstileWidget
                ref={turnstileRef}
                onVerify={setCaptchaToken}
                onExpireOrError={() => setCaptchaToken(undefined)}
              />

              <Button
                type="submit"
                className="w-full bg-green-700 hover:bg-green-800 text-white font-medium"
                aria-disabled={loading}
              >
                {loading ? a('sending') : a('sendResetLink')}
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex min-h-6 items-center text-sm text-stone-700 underline hover:text-lime-800"
                >
                  {a('backToSignIn')}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
