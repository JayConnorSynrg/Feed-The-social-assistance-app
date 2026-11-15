'use client'

// apps/web/src/app/(auth)/onboarding/page.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The five onboarding steps a new member sees right after sign-up, in the member's language
// (useProfileLocale: the feed_locale cookie, else the browser, until a profile loads). Only labels
// are translated: the row saved (user_role, needs, zip, phone, preferred_language) holds the same
// values in every locale. Each step's heading takes focus on Continue and Back; Continue on an
// unfinished step is aria-disabled and says why in the one always-mounted alert; a failed save shows
// a translated line (lib/i18n-onboarding.ts) and its existing log row carries the error code only.

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { useGeolocation } from '@/hooks/use-geolocation'
import { MapPin, Navigation, Check, ArrowRight, ArrowLeft, Phone, HandHeart, Search, Users, Globe } from 'lucide-react'
import { logger } from '@/lib/logger'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { normalizeState } from '@/lib/us-states'
import { LANGUAGES, detectBrowserLanguage } from '@/lib/languages'
import type { Database } from '@feed/database'
import { cn } from '@/lib/utils'
import { dir, t, type Locale } from '@/lib/i18n'
import { onboardingT, type OnboardingKey } from '@/lib/i18n-onboarding'
import { assistantT } from '@/lib/i18n-assistant'
import { formatMessage, splitMessage } from '@/lib/format-message'
import { formatCount } from '@/lib/i18n-intl'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { announce, AnnouncementText, clearAnnouncement, NO_ANNOUNCEMENT, type Announcement } from '@/app/(admin)/moderation/row-focus'

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * A failure as its log row may carry it: the code (PostgREST's or the SQLSTATE; 'unknown' when there
 * is none, as before) and the error's class name, never its message — a PostgREST message can quote
 * the values it was given (ZIP, phone).
 */
function codeOnly(err: unknown): { code: string; error: Error } {
  const raw = (err as { code?: unknown } | null)?.code
  const code = typeof raw === 'string' && raw ? raw : 'unknown'
  const name = err instanceof Error ? err.name : 'Error'
  return { code, error: Object.assign(new Error(code), { name, code }) }
}

/** Postgres error codes that are deterministic — never retry them. */
function isDeterministicPgError(code: string | undefined): boolean {
  if (!code) return false
  // 42xxx = privilege/syntax errors, 23xxx = constraint errors, 22xxx = data errors
  return /^(42|23|22)/.test(code)
}

/**
 * Retry wrapper for transient failures only.
 * Deterministic Postgres errors (42501, 42P01, 23xxx etc.) surface immediately.
 * Network / AbortError / 5xx failures are retried with back-off.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts: number; backoffMs: number[] }
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < opts.attempts; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastErr = err
      const msg = getErrorMessage(err)
      // Surface deterministic errors immediately (no retry)
      const code = (err as { code?: string })?.code
      if (isDeterministicPgError(code)) throw err
      // AbortError from a timeout is transient — retry
      const isTransient =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError') ||
        msg.includes('signal') ||
        msg.includes('aborted') ||
        msg.includes('fetch') ||
        msg.includes('network')
      if (!isTransient) throw err
      if (attempt < opts.attempts - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, opts.backoffMs[attempt] ?? 1500))
      }
    }
  }
  throw lastErr
}

const ROLE_OPTIONS = [
  {
    id: 'seeking',
    label: 'roleSeeker',
    description: 'roleSeekerBody',
    icon: Search,
    color: 'border-blue-500 bg-blue-50',
  },
  {
    id: 'providing',
    label: 'roleSourcer',
    description: 'roleSourcerBody',
    icon: HandHeart,
    color: 'border-green-500 bg-green-50',
  },
  {
    id: 'both',
    label: 'roleBoth',
    description: 'roleBothBody',
    icon: Users,
    color: 'border-purple-500 bg-purple-50',
  },
] as const satisfies ReadonlyArray<{ id: string; label: OnboardingKey; description: OnboardingKey; icon: unknown; color: string }>

const NEEDS_OPTIONS = [
  { id: 'food', label: 'needFood', emoji: '🍎' },
  { id: 'housing', label: 'needHousing', emoji: '🏠' },
  { id: 'healthcare', label: 'needHealthcare', emoji: '🏥' },
  { id: 'employment', label: 'needEmployment', emoji: '💼' },
  { id: 'childcare', label: 'needChildcare', emoji: '👶' },
  { id: 'legal', label: 'needLegal', emoji: '⚖️' },
  { id: 'financial', label: 'needFinancial', emoji: '💰' },
  { id: 'education', label: 'needEducation', emoji: '📚' },
] as const satisfies ReadonlyArray<{ id: string; label: OnboardingKey; emoji: string }>

type UserRole = 'seeking' | 'providing' | 'both'

/** The radio an Arrow key moves to (null: not a moving key). Down / Up are next / previous; Right /
 *  Left follow the reading direction (in a right-to-left locale Left is next). Wraps around. */
function nextRadioIndex(key: string, current: number, count: number, locale: Locale): number | null {
  const rtl = dir(locale) === 'rtl'
  const forward = key === 'ArrowDown' || key === (rtl ? 'ArrowLeft' : 'ArrowRight')
  const back = key === 'ArrowUp' || key === (rtl ? 'ArrowRight' : 'ArrowLeft')
  if (forward) return (current + 1) % count
  if (back) return (current - 1 + count) % count
  return null
}
type Step = 1 | 2 | 3 | 4 | 5

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const locale = useProfileLocale()
  const o = (key: OnboardingKey) => onboardingT(locale, key)
  const { user: authUser, loading: authLoading } = useAuthContext()

  const [step, setStep] = useState<Step>(1)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [zipCode, setZipCode] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([])
  const [phone, setPhone] = useState('')

  // Local submitting flag — decoupled from authLoading so the button is never
  // permanently disabled waiting for auth context to resolve.
  const [preferredLanguage, setPreferredLanguage] = useState<string>(() => detectBrowserLanguage())

  const [submitting, setSubmitting] = useState(false)
  // The one alert region, always mounted: a failure line or why Continue cannot go on yet.
  const [alertLine, setAlert] = useState<Announcement>(NO_ANNOUNCEMENT)
  const showError = useCallback((text: string | null) => (text ? announce(setAlert, text) : clearAnnouncement(setAlert)), [])
  // Single flight: set synchronously before the first await, so a second press sends nothing.
  const busyRef = useRef(false)
  // Each step's heading takes focus when the step changes (not on the first paint).
  const headingRef = useRef<HTMLHeadingElement>(null)
  const stepChangedRef = useRef(false)
  // The action whose save failed, so "Try again" repeats exactly that one (Get Started saves every
  // answer; Skip for now saves the flag only). It stays set while the retry runs, so the button —
  // and keyboard focus on it — stays put.
  const [failedAction, setFailedAction] = useState<'complete' | 'skip' | null>(null)

  const [geoLoading, setGeoLoading] = useState(false)

  // Capture userId into local ref once authUser first resolves.
  // This prevents the silent return that dead-ends the form when handleComplete
  // fires while authLoading is still true.
  const userIdRef = useRef<string | null>(null)
  const pendingSubmitRef = useRef(false)

  useEffect(() => {
    if (authUser?.id && !userIdRef.current) {
      userIdRef.current = authUser.id
      // If a submit was attempted before auth resolved, fire it now.
      if (pendingSubmitRef.current) {
        pendingSubmitRef.current = false
        void handleComplete()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser])

  useEffect(() => {
    if (!stepChangedRef.current) return
    headingRef.current?.focus()
  }, [step])

  const goTo = (next: Step) => {
    stepChangedRef.current = true
    showError(null)
    setStep(next)
  }

  const roleRefs = useRef<Array<HTMLButtonElement | null>>([])
  const chooseRole = (index: number) => {
    setUserRole(ROLE_OPTIONS[index].id as UserRole)
    showError(null)
  }

  const { getCurrentPosition } = useGeolocation()

  const handleUseLocation = useCallback(async () => {
    if (geoLoading) return
    setGeoLoading(true)
    showError(null)
    try {
      const position = await getCurrentPosition()
      if (position) {
        setLatitude(position.coords.latitude)
        setLongitude(position.coords.longitude)
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${position.coords.longitude},${position.coords.latitude}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&types=postcode,place,region`
          )
          const data = await response.json()
          if (data.features?.length) {
            for (const feature of data.features) {
              if (feature.place_type?.includes('postcode')) {
                setZipCode(feature.text)
              }
              if (feature.place_type?.includes('place')) {
                setCity(feature.text)
              }
              if (feature.place_type?.includes('region')) {
                setState(feature.text)
              }
            }
          }
        } catch {
          // Geocoding failed but coords are captured — continue without city/zip
        }
      } else {
        // Denied, timed out or unsupported: the hook answers null.
        showError(onboardingT(locale, 'locationFailed'))
      }
    } catch {
      showError(onboardingT(locale, 'locationFailed'))
    } finally {
      setGeoLoading(false)
    }
  }, [getCurrentPosition, geoLoading, showError, locale])

  const toggleNeed = (needId: string) => {
    setSelectedNeeds((prev) =>
      prev.includes(needId) ? prev.filter((n) => n !== needId) : [...prev, needId]
    )
  }

  /**
   * Write onboarding_completed=true to the profile row, then navigate to /.
   * The profile row is guaranteed to exist (handle_new_user trigger creates it
   * at signup). .update().eq('id', userId) uses the column-scoped UPDATE grant
   * which covers onboarding_completed but excludes id — avoids the 42501 that
   * .upsert() caused by including id in DO UPDATE SET.
   *
   * AWAIT before navigate: navigating fire-and-forget meant proxy.ts bounced
   * the user back to /onboarding when the write hadn't committed yet.
   */
  const markCompleteAndNavigate = useCallback(
    async (userId: string): Promise<void> => {
      logger.info('onboarding.skip.start', { userId })
      const doWrite = async () => {
        const result = await supabase
          .from('profiles')
          .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
          .eq('id', userId)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code })
      }

      try {
        await withRetry(doWrite, { attempts: 3, backoffMs: [500, 1500] })
        logger.warn('onboarding.save.ok', { userId, path: 'skip' })
        router.push('/')
      } catch (err: unknown) {
        const { code, error } = codeOnly(err)
        logger.error('onboarding.save.exhausted', error, { step: 'skip', userId, code })
        showError(onboardingT(locale, 'saveFailed'))
        setFailedAction('skip')
      }
    },
    [router, supabase, showError, locale]
  )

  const handleComplete = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setSubmitting(true)
    showError(null)

    // Hard 10s timeout wrapping the ENTIRE operation — including auth resolution,
    // profile write, and verification. If anything stalls, the user always
    // escapes "Saving…" within ~10s.
    const doWork = async () => {
      const userId = userIdRef.current ?? authUser?.id ?? null

      // Auth not yet resolved — queue the submit and return.
      if (!userId && authLoading) {
        pendingSubmitRef.current = true
        logger.info('onboarding.complete.pending_auth', {})
        return
      }

      if (!userId) {
        // Auth done but no user — session expired.
        logger.warn('onboarding.complete.no_user', { authLoading })
        router.push('/login')
        return
      }

      logger.info('onboarding.complete.start', { userId, hasPhone: !!phone })
      const timer = logger.time('auth.onboarding.complete')

      // Resolve city/state before building update payload.
      let resolvedCity = city
      let resolvedState = state
      if (!resolvedState && (latitude !== null || zipCode.length >= 5)) {
        const geocodeController = new AbortController()
        const geocodeTimer = setTimeout(() => geocodeController.abort(), 5_000)
        try {
          const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
          let geocodeUrl: string
          if (latitude !== null && longitude !== null) {
            geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&types=postcode,place,region`
          } else {
            geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(zipCode)}.json?types=postcode&access_token=${token}&limit=1`
          }
          const geoRes = await fetch(geocodeUrl, { signal: geocodeController.signal })
          const geoData = await geoRes.json()
          if (geoData.features?.length) {
            for (const feature of geoData.features) {
              if (!resolvedCity && feature.place_type?.includes('place')) resolvedCity = feature.text as string
              if (!resolvedState && feature.place_type?.includes('region')) resolvedState = feature.text as string
            }
          }
          logger.info('onboarding.location.resolved', {
            hasState: !!resolvedState,
            source: latitude !== null ? 'reverse_geocode' : 'zip_geocode',
          })
        } catch {
          // Geocode timed out or failed — proceed with whatever we have; location_state may be null.
          logger.info('onboarding.location.resolved', { hasState: false, source: 'geocode_failed' })
        } finally {
          clearTimeout(geocodeTimer)
        }
      }

      // Build update payload WITHOUT id — id is excluded from the column-scoped
      // UPDATE grant; including it in .upsert() caused 42501 (permission denied).
      // The profiles row is guaranteed to exist via the handle_new_user trigger.
      type ProfileUpdate = Omit<Database['public']['Tables']['profiles']['Update'], 'id'>
      const profileUpdate: ProfileUpdate = {
        user_role: userRole,
        zip_code: zipCode || null,
        location_city: resolvedCity || null,
        location_state: normalizeState(resolvedState) || normalizeState(state) || null,
        latitude: latitude,
        longitude: longitude,
        needs: selectedNeeds,
        phone: phone || null,
        preferred_language: preferredLanguage || 'en',
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      }

      // Main write with retry (transient failures only; deterministic errors surface immediately).
      let writeError: { code: string } | null = null
      let attempt = 0

      const doWrite = async () => {
        attempt++
        logger.warn('onboarding.save.attempt', {
          userId,
          attempt,
          step: 'main_write',
        })
        const result = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', userId)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        if (result.error) {
          const err = Object.assign(new Error(result.error.message), { code: result.error.code })
          throw err
        }
      }

      try {
        await withRetry(doWrite, { attempts: 3, backoffMs: [500, 1500] })
        writeError = null
      } catch (err: unknown) {
        const { code, error } = codeOnly(err)
        // Recovery after retry succeeded on a prior attempt won't reach here, but log
        // exhaustion for observability.
        logger.error(attempt > 1 ? 'onboarding.save.exhausted' : 'onboarding.save.failed', error, {
          step: 'main_write',
          attempt,
          userId,
          code,
        })
        writeError = { code }
      }

      if (writeError) {
        showError(onboardingT(locale, 'saveFailed'))
        setFailedAction('complete')
        return
      }

      // Verify the write committed — prevents the redirect loop where middleware
      // sees onboarding_completed=false and sends the user back.
      try {
        const { data: verify, error: verifyErr } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', userId)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
          .maybeSingle()

        if (verifyErr && !isQueryTimeout(verifyErr)) {
          logger.warn('onboarding.complete.verify_error', { userId, code: verifyErr.code })
        }

        if (!verify?.onboarding_completed) {
          logger.warn('onboarding.complete.verify_failed', { userId })
          // Retry-write the flag — deterministic error surfaces immediately
          const retryResult = await supabase
            .from('profiles')
            .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
            .eq('id', userId)
            .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
          if (retryResult.error) {
            logger.warn('onboarding.complete.verify_retry_failed', { userId, code: retryResult.error.code })
          } else {
            logger.warn('onboarding.save.ok', { userId, path: 'verify_retry' })
          }
        }
      } catch (verifyErr: unknown) {
        // Verification failed — navigate anyway; middleware will catch loops.
        logger.warn('onboarding.complete.verify_error', { userId, code: codeOnly(verifyErr).code })
      }

      timer.end({ step: 'complete', userId })
      logger.warn('onboarding.save.ok', { userId, path: 'complete' })
      router.push('/')
      router.refresh()
    }

    try {
      await Promise.race([
        doWork(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('onboarding_timeout')), 10_000)
        ),
      ])
    } catch (err: unknown) {
      const msg = getErrorMessage(err)
      const isAbort =
        (err instanceof Error && err.name === 'AbortError') ||
        (msg.includes('signal') || msg.includes('aborted'))
      const isTimeout = msg === 'onboarding_timeout'

      if (isAbort || isTimeout) {
        // Abort or hard timeout — the write may have committed server-side.
        // Navigate and let middleware detect any loop.
        logger.warn(isTimeout ? 'onboarding.complete.timeout' : 'onboarding.complete.outer_abort', {})
        router.push('/')
        return
      }

      const { code, error } = codeOnly(err)
      logger.error('onboarding.complete.failed', error, { step: 'handleComplete', code })
      showError(onboardingT(locale, 'saveFailed'))
      setFailedAction('complete')
    } finally {
      busyRef.current = false
      setSubmitting(false)
    }
  }, [authUser, authLoading, phone, userRole, zipCode, city, state, latitude, longitude, selectedNeeds, preferredLanguage, router, supabase, showError, locale])

  const handleSkip = useCallback(async () => {
    const userId = userIdRef.current ?? authUser?.id ?? null
    if (!userId) {
      // No user — redirect immediately; skip the write entirely.
      logger.warn('onboarding.skip.no_user', { authLoading })
      router.push('/')
      return
    }
    if (busyRef.current) return
    busyRef.current = true
    setSubmitting(true)
    showError(null)
    try {
      await markCompleteAndNavigate(userId)
    } finally {
      busyRef.current = false
      setSubmitting(false)
    }
  }, [authUser, authLoading, markCompleteAndNavigate, router, showError])

  const canProceedStep1 = userRole !== null
  const canProceedStep2 = zipCode.length >= 5 || (latitude !== null && longitude !== null)
  const canProceedStep3 = selectedNeeds.length > 0
  const canProceedStep5 = preferredLanguage.length > 0

  const TOTAL_STEPS = 5
  const title: Record<Step, OnboardingKey> = {
    1: 'step1Title',
    2: 'step2Title',
    3: userRole === 'providing' ? 'step3TitleProviding' : 'step3TitleSeeking',
    4: 'step4Title',
    5: 'step5Title',
  }
  const body: Record<Step, OnboardingKey> = { 1: 'step1Body', 2: 'step2Body', 3: 'step3Body', 4: 'step4Body', 5: 'step5Body' }
  const place = city ? (state ? `${city}, ${state}` : city) : ''

  /** Continue: moves on when the step is complete, else says what is missing (focus stays). */
  const continueTo = (next: Step, ready: boolean, missing: OnboardingKey) => () => {
    if (ready) goTo(next)
    else showError(o(missing))
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
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-lime-50/60 via-stone-50/40 to-lime-100/50" />

      <Card className="w-full max-w-lg relative z-10 bg-stone-50/95 text-stone-800 backdrop-blur-sm border-lime-200/60 shadow-xl">
        <CardHeader className="text-center">
          <p id="onboarding-step-line" className="text-xs font-medium text-stone-700">
            {formatMessage(assistantT(locale, 'flowStep'), { current: formatCount(step, locale), total: formatCount(TOTAL_STEPS, locale) })}
          </p>
          <h1
            ref={headingRef}
            id="onboarding-step-title"
            tabIndex={-1}
            aria-describedby="onboarding-step-line"
            className="text-2xl font-bold leading-tight text-lime-800 outline-none break-words"
          >
            {o(title[step])}
          </h1>
          <CardDescription className="text-stone-700">{o(body[step])}</CardDescription>
          {/* Step indicator (the step line above says it in words) */}
          <div aria-hidden="true" className="flex justify-center gap-2 mt-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`w-7 h-1.5 rounded-full transition-colors ${
                  s <= step ? 'bg-lime-600' : 'bg-stone-200'
                }`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* One alert region, always mounted; each announcement inserts a new node. */}
          <div
            role="alert"
            className={alertLine.text ? 'bg-red-50 border border-red-700 text-red-800 text-sm p-3 rounded-md' : undefined}
          >
            <AnnouncementText announcement={alertLine} />
          </div>
          {failedAction && (
            // Repeats exactly the action that failed, with every answer given so far.
            <button
              type="button"
              aria-disabled={submitting}
              onClick={() => void (failedAction === 'complete' ? handleComplete() : handleSkip())}
              className="min-h-6 text-sm underline font-medium text-red-800 hover:text-red-900"
            >
              {t(locale, 'tryAgain')}
            </button>
          )}

          {/* Step 1: Role Selection */}
          {step === 1 && (
            <div className="space-y-3">
              {/* An APG radio group: one Tab stop (the chosen card, else the first); Arrow keys move and
                  choose, Left / Right following the reading direction; Space chooses. */}
              <div role="radiogroup" aria-labelledby="onboarding-step-title" className="space-y-3">
                {ROLE_OPTIONS.map((role, index) => {
                  const Icon = role.icon
                  const isSelected = userRole === role.id
                  const tabStop = userRole === null ? index === 0 : isSelected
                  return (
                    <button
                      key={role.id}
                      ref={(node) => { roleRefs.current[index] = node }}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={tabStop ? 0 : -1}
                      onKeyDown={(e) => {
                        if (e.key === ' ') {
                          e.preventDefault()
                          chooseRole(index)
                          return
                        }
                        const next = nextRadioIndex(e.key, index, ROLE_OPTIONS.length, locale)
                        if (next === null) return
                        e.preventDefault()
                        chooseRole(next)
                        roleRefs.current[next]?.focus()
                      }}
                      onClick={() => chooseRole(index)}
                      className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-start transition-all ${
                        isSelected
                          ? role.color
                          : 'border-stone-500 bg-white/90 hover:border-lime-700'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-white/80' : 'bg-stone-100'
                      }`}>
                        <Icon aria-hidden="true" className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{o(role.label)}</p>
                        <p className="text-xs text-stone-700 mt-0.5">{o(role.description)}</p>
                      </div>
                      {isSelected && <Check aria-hidden="true" className="w-5 h-5 text-lime-700 flex-shrink-0 mt-1" />}
                    </button>
                  )
                })}
              </div>

              <Button
                type="button"
                className={cn('w-full h-auto min-h-9 whitespace-normal mt-4', canProceedStep1 ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-200')}
                aria-disabled={!canProceedStep1}
                onClick={continueTo(2, canProceedStep1, 'chooseRole')}
              >
                {assistantT(locale, 'flowContinue')} <ArrowRight aria-hidden="true" className="w-4 h-4 ms-2 rtl:-scale-x-100" />
              </Button>

              {/* Skips onboarding and opens FEED, as it says. */}
              <button
                type="button"
                onClick={handleSkip}
                aria-disabled={submitting}
                className="w-full min-h-6 text-center text-sm text-stone-700 underline hover:text-lime-800 mt-2 transition-colors"
              >
                {o('skipForNow')}
              </button>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full h-auto min-h-9 whitespace-normal py-4 border-stone-500 bg-white/90 hover:bg-lime-50"
                onClick={handleUseLocation}
                aria-disabled={geoLoading}
              >
                <Navigation aria-hidden="true" className={`w-4 h-4 me-2 ${geoLoading ? 'animate-spin' : ''}`} />
                {geoLoading ? o('locating') : o('useLocation')}
              </Button>

              {/* Always mounted, so the detected place is spoken when it appears. */}
              <div role="status">
                {geoLoading && <p className="sr-only">{o('locating')}</p>}
                {!geoLoading && latitude && longitude && (
                  <div className="flex items-center gap-2 p-3 bg-lime-50 rounded-lg text-sm text-lime-800">
                    <Check aria-hidden="true" className="w-4 h-4 shrink-0" />
                    {place ? (
                      <span>
                        {splitMessage(o('locationDetectedAt'), 'place')[0]}
                        <span lang="" dir="auto">{place}</span>
                        {splitMessage(o('locationDetectedAt'), 'place')[1]}
                      </span>
                    ) : (
                      o('locationDetected')
                    )}
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-stone-500" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-stone-50 px-2 text-stone-700">{o('orEnterManually')}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="onboarding-zip" className="text-sm font-medium text-stone-800 mb-1 block">{o('zipCode')}</label>
                  <div className="relative">
                    <MapPin aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                    <Input
                      id="onboarding-zip"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      placeholder="90001"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      dir="ltr"
                      className="ps-10 bg-white/90 border-stone-500 text-stone-900 placeholder:text-stone-600"
                      maxLength={5}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="onboarding-city" className="text-sm font-medium text-stone-800 mb-1 block">{o('city')}</label>
                    <Input
                      id="onboarding-city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={o('phCity')}
                      autoComplete="address-level2"
                      dir="auto"
                      className="bg-white/90 border-stone-500 text-stone-900 placeholder:text-stone-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="onboarding-state" className="text-sm font-medium text-stone-800 mb-1 block">{o('stateLabel')}</label>
                    <Input
                      id="onboarding-state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="CA"
                      autoComplete="address-level1"
                      dir="ltr"
                      className="bg-white/90 border-stone-500 text-stone-900 placeholder:text-stone-600"
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>

              <StepNav
                back={() => goTo(1)}
                backLabel={assistantT(locale, 'flowBack')}
                next={continueTo(3, canProceedStep2, 'chooseLocation')}
                nextLabel={assistantT(locale, 'flowContinue')}
                ready={canProceedStep2}
              />
            </div>
          )}

          {/* Step 3: Needs / Offerings */}
          {step === 3 && (
            <div className="space-y-4">
              <div role="group" aria-labelledby="onboarding-step-title" className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
                {NEEDS_OPTIONS.map((need) => {
                  const isSelected = selectedNeeds.includes(need.id)
                  return (
                    <button
                      key={need.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        toggleNeed(need.id)
                        showError(null)
                      }}
                      className={`relative p-4 rounded-xl border-2 text-start transition-all ${
                        isSelected
                          ? 'border-lime-700 bg-lime-50'
                          : 'border-stone-500 bg-white/90 hover:border-lime-700'
                      }`}
                    >
                      <span aria-hidden="true" className="text-lg mb-1 block">{need.emoji}</span>
                      <span className="text-sm font-medium">{o(need.label)}</span>
                      {isSelected && (
                        <Check aria-hidden="true" className="w-4 h-4 text-lime-700 absolute top-2 end-2" />
                      )}
                    </button>
                  )
                })}
              </div>

              <StepNav
                back={() => goTo(2)}
                backLabel={assistantT(locale, 'flowBack')}
                next={continueTo(4, canProceedStep3, 'chooseNeed')}
                nextLabel={assistantT(locale, 'flowContinue')}
                ready={canProceedStep3}
              />
            </div>
          )}

          {/* Step 4: Contact (optional) */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="onboarding-phone" className="text-sm font-medium text-stone-800 mb-1 block">
                  {o('phone')} <span className="text-stone-700 font-normal">{o('optional')}</span>
                </label>
                <div className="relative">
                  <Phone aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                  <Input
                    id="onboarding-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    type="tel"
                    autoComplete="tel"
                    dir="ltr"
                    aria-describedby="onboarding-phone-hint"
                    className="ps-10 bg-white/90 border-stone-500 text-stone-900 placeholder:text-stone-600"
                  />
                </div>
                <p id="onboarding-phone-hint" className="text-xs text-stone-700 mt-1">
                  {o('phoneHint')}
                </p>
              </div>

              <StepNav
                back={() => goTo(3)}
                backLabel={assistantT(locale, 'flowBack')}
                next={() => goTo(5)}
                nextLabel={assistantT(locale, 'flowContinue')}
                ready
              />

              <button
                type="button"
                onClick={handleSkip}
                aria-disabled={submitting}
                className="w-full min-h-6 text-center text-sm text-stone-700 underline hover:text-stone-900"
              >
                {o('skipForNow')}
              </button>
            </div>
          )}

          {/* Step 5: Language Preference */}
          {step === 5 && (
            <div className="space-y-4">
              <label htmlFor="onboarding-language" className="text-sm font-medium text-stone-800 block">{o('languageLabel')}</label>
              <div className="relative">
                <Globe aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 pointer-events-none" />
                <select
                  id="onboarding-language"
                  data-testid="language-select"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  aria-describedby="onboarding-language-hint"
                  className="w-full ps-10 pe-4 py-2.5 rounded-lg border border-stone-500 bg-white/90 text-stone-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-lime-700"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.nativeName} — {lang.englishName}
                    </option>
                  ))}
                </select>
              </div>
              <p id="onboarding-language-hint" className="text-xs text-stone-700">
                {o('changeLater')}
              </p>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" className="flex-1 h-auto min-h-9 whitespace-normal border-stone-500" onClick={() => goTo(4)}>
                  <ArrowLeft aria-hidden="true" className="w-4 h-4 me-2 rtl:-scale-x-100" /> {assistantT(locale, 'flowBack')}
                </Button>
                <Button
                  type="button"
                  className={cn('flex-1 h-auto min-h-9 whitespace-normal', canProceedStep5 ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-200')}
                  onClick={handleComplete}
                  aria-disabled={submitting || !canProceedStep5}
                >
                  {submitting ? o('saving') : o('getStarted')}
                </Button>
              </div>

              <button
                type="button"
                onClick={handleSkip}
                aria-disabled={submitting}
                className="w-full min-h-6 text-center text-sm text-stone-700 underline hover:text-stone-900"
              >
                {o('skipForNow')}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Back and Continue under a step. Continue is aria-disabled (stone-200/700) until the step is done. */
function StepNav({ back, backLabel, next, nextLabel, ready }: {
  back: () => void
  backLabel: string
  next: () => void
  nextLabel: string
  ready: boolean
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="button" variant="outline" className="flex-1 h-auto min-h-9 whitespace-normal border-stone-500" onClick={back}>
        <ArrowLeft aria-hidden="true" className="w-4 h-4 me-2 rtl:-scale-x-100" /> {backLabel}
      </Button>
      <Button
        type="button"
        className={cn('flex-1 h-auto min-h-9 whitespace-normal', ready ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-200')}
        aria-disabled={!ready}
        onClick={next}
      >
        {nextLabel} <ArrowRight aria-hidden="true" className="w-4 h-4 ms-2 rtl:-scale-x-100" />
      </Button>
    </div>
  )
}
