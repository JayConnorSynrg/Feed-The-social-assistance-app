'use client'

// apps/web/src/app/(auth)/reset-password/page.tsx
// Set a new password, in the visitor's language (useProfileLocale; lib/i18n-auth.ts). A failure line
// comes from the error's code and writes one auth.password.failed row {code, step: 'reset'}; the
// Supabase call, its timeout and the redirects are unchanged.

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { logger } from '@/lib/logger'
import { dir } from '@/lib/i18n'
import { authT, passwordFailureKey, type AuthKey } from '@/lib/i18n-auth'
import { failureCode } from '@/lib/failure-code'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { announce, AnnouncementText, clearAnnouncement, NO_ANNOUNCEMENT, type Announcement } from '@/app/(admin)/moderation/row-focus'

/** The input classes of this page: 3:1 border, readable placeholder. */
const INPUT = 'bg-white/90 border-stone-500 text-stone-900 placeholder:text-stone-600 focus:border-lime-700 focus:ring-lime-500/20'

export default function ResetPasswordPage() {
  const router = useRouter()
  const locale = useProfileLocale()
  const a = (key: AuthKey) => authT(locale, key)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // The one alert region's text (always mounted with the form; one node per failure).
  const [alertLine, setAlert] = useState<Announcement>(NO_ANNOUNCEMENT)
  const setError = (text: string | null) => (text ? announce(setAlert, text) : clearAnnouncement(setAlert))
  const [success, setSuccess] = useState(false)
  // The form is replaced by the confirmation: focus goes to it.
  const doneRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (success) doneRef.current?.focus()
  }, [success])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // The submit button is aria-disabled (not disabled) while busy: a press does nothing.
    if (loading) return
    setError(null)

    if (newPassword.length < 12) {
      setError(a('passwordTooShort'))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(a('passwordsMismatch'))
      return
    }

    setLoading(true)
    const timer = logger.time('auth.reset_password')

    try {
      const supabase = createClient()

      // Wrap in a timeout — Next.js 16 proxy can abort Supabase fetch requests,
      // causing the promise to never resolve. If it times out, the update likely
      // succeeded server-side before the abort.
      const updatePromise = supabase.auth.updateUser({ password: newPassword })
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('update_timeout')), 8000)
      )

      let result: Awaited<ReturnType<typeof supabase.auth.updateUser>> | null = null
      try {
        result = await Promise.race([updatePromise, timeoutPromise])
      } catch (raceErr) {
        // Abort/timeout — server likely processed the update before the abort.
        // Supabase processes in ~400ms; abort fires after React pre-render.
        timer.end({ step: 'password_update', aborted: true })
        setSuccess(true)
        setTimeout(() => router.push('/login'), 3000)
        return
      }

      if (result?.error) throw result.error

      timer.end({ step: 'password_update' })
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (err: unknown) {
      const isAbort =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && (err.message.includes('signal') || err.message.includes('abort') || err.message === 'update_timeout'))
      if (isAbort) {
        timer.end({ step: 'password_update', aborted: true })
        setSuccess(true)
        setTimeout(() => router.push('/login'), 3000)
        return
      }
      timer.error(err, { step: 'password_update' })
      const code = failureCode(err)
      logger.warn('auth.password.failed', { code, step: 'reset' })
      setError(a(passwordFailureKey(code, 'resetFailed')))
    } finally {
      setLoading(false)
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
          <CardTitle className="text-2xl font-bold text-lime-800">{a('resetTitle')}</CardTitle>
          <CardDescription className="text-stone-700">
            {a('resetSubtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 bg-lime-50/30 mx-4 rounded-lg p-4 -mt-2 mb-4">
          {success ? (
            <div className="text-center space-y-2 py-2">
              <p ref={doneRef} tabIndex={-1} className="text-stone-800 font-medium rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-700">{a('resetDone')}</p>
              <p className="text-stone-700 text-sm">{a('resetRedirecting')}</p>
              <p className="text-stone-700 text-xs mt-2">{a('resetHelp')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* One alert region, always mounted; each failure inserts a new node. */}
              <div role="alert" className={alertLine.text ? 'bg-red-50 border border-red-700 text-red-800 text-sm p-3 rounded-md' : undefined}>
                <AnnouncementText announcement={alertLine} />
              </div>

              <div className="space-y-2">
                <label htmlFor="new-password" className="block text-sm font-medium text-stone-800">
                  {a('newPassword')}
                </label>
                <Input
                  id="new-password"
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  aria-required="true"
                  aria-describedby="new-password-hint"
                  readOnly={loading}
                  className={INPUT}
                />
                <p id="new-password-hint" className="text-xs text-stone-700">{a('passwordHint')}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="block text-sm font-medium text-stone-800">
                  {a('confirmPassword')}
                </label>
                <Input
                  id="confirm-password"
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

              <Button
                type="submit"
                className="w-full bg-green-700 hover:bg-green-800 text-white font-medium"
                aria-disabled={loading}
              >
                {loading ? a('updating') : a('updatePassword')}
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
