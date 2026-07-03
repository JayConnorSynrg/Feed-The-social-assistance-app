'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useGeolocation } from '@/hooks/use-geolocation'
import { MapPin, Navigation, Check, ArrowRight, ArrowLeft, Phone, HandHeart, Search, Users, Settings2, Globe } from 'lucide-react'
import { logger } from '@/lib/logger'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { normalizeState } from '@/lib/us-states'
import { LANGUAGES, detectBrowserLanguage } from '@/lib/languages'
import type { Database } from '@feed/database'

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
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
    label: 'Seeker',
    description: 'Find food, housing, healthcare, jobs, and other resources near you',
    icon: Search,
    color: 'border-blue-500 bg-blue-50',
  },
  {
    id: 'providing',
    label: 'Sourcer',
    description: 'Share resources, connect people with services, or offer direct support',
    icon: HandHeart,
    color: 'border-green-500 bg-green-50',
  },
  {
    id: 'facilitator',
    label: 'Administrator',
    description: 'Operate and maintain FEED — requires an administrator code',
    icon: Settings2,
    color: 'border-amber-500 bg-amber-50',
  },
  {
    id: 'both',
    label: 'Both',
    description: 'I need help in some areas and can offer help in others',
    icon: Users,
    color: 'border-purple-500 bg-purple-50',
  },
] as const

const NEEDS_OPTIONS = [
  { id: 'food', label: 'Food Assistance', emoji: '🍎' },
  { id: 'housing', label: 'Housing', emoji: '🏠' },
  { id: 'healthcare', label: 'Healthcare', emoji: '🏥' },
  { id: 'employment', label: 'Employment', emoji: '💼' },
  { id: 'childcare', label: 'Childcare', emoji: '👶' },
  { id: 'legal', label: 'Legal Aid', emoji: '⚖️' },
  { id: 'financial', label: 'Financial Help', emoji: '💰' },
  { id: 'education', label: 'Education', emoji: '📚' },
] as const

type UserRole = 'seeking' | 'providing' | 'facilitator' | 'both'
type Step = 1 | 2 | 3 | 4 | 5

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user: authUser, loading: authLoading } = useAuthContext()

  const [step, setStep] = useState<Step>(1)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [adminCode, setAdminCode] = useState('')
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
  const [error, setError] = useState<string | null>(null)
  // showContinueAnyway becomes true when a write error/timeout occurs so the
  // user can always escape the phone step.
  const [showContinueAnyway, setShowContinueAnyway] = useState(false)

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

  const { getCurrentPosition } = useGeolocation()

  const handleUseLocation = useCallback(async () => {
    setGeoLoading(true)
    setError(null)
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
      }
    } catch {
      setError('Could not get your location. Please enter it manually.')
    } finally {
      setGeoLoading(false)
    }
  }, [getCurrentPosition])

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
      // Facilitators must complete the full flow including code validation.
      // This function handles skip/bypass — not permitted for facilitator role.
      // The facilitator path goes through handleComplete.
      if (userRole === 'facilitator') return

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
        const msg = getErrorMessage(err)
        const code = (err as { code?: string })?.code
        logger.error('onboarding.save.exhausted', err as Error, {
          step: 'skip',
          userId,
          code: code ?? 'unknown',
          message: msg,
        })
        setError(`Could not save your profile: ${msg}. Please try again.`)
        setShowContinueAnyway(true)
      }
    },
    [router, supabase]
  )

  const handleComplete = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    setShowContinueAnyway(false)

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

      // ── FACILITATOR PATH — code verified server-side via edge function ──
      if (userRole === 'facilitator') {
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          'claim-facilitator-admin',
          { body: { code: adminCode.trim() } }
        )
        if (fnError || !fnData?.success) {
          const errCode = fnData?.error ?? fnError?.message ?? 'unknown'
          let errorMsg = 'Invalid administrator code. Please try again.'
          if (errCode === 'rate_limited') {
            errorMsg = 'Too many failed attempts. Please try again in an hour.'
          } else if (errCode === 'not_configured') {
            errorMsg = 'Administrator registration is not currently available. Contact support.'
          } else if (errCode === 'invalid_code') {
            errorMsg = 'Invalid administrator code. Please check and try again.'
          }
          setError(errorMsg)
          setSubmitting(false)
          return
        }

        // Edge fn already set is_admin + user_role — write remaining profile fields only.
        const facilitatorUpdate = {
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
        const { error: profErr } = await supabase
          .from('profiles')
          .update(facilitatorUpdate)
          .eq('id', userId)
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        if (profErr) {
          logger.error('onboarding.facilitator.profile_write_failed', profErr as Error, {
            userId,
            code: profErr.code,
            message: profErr.message,
          })
          setError(`Could not save profile: ${profErr.message}`)
          setShowContinueAnyway(true)
          return
        }

        logger.warn('onboarding.save.ok', { userId, path: 'facilitator' })
        router.push('/')
        router.refresh()
        return
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
      let writeError: { message: string; code?: string } | null = null
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
        const msg = getErrorMessage(err)
        const code = (err as { code?: string })?.code
        if (attempt > 1) {
          // Recovery after retry succeeded on a prior attempt won't reach here,
          // but log exhaustion for observability.
          logger.error('onboarding.save.exhausted', err as Error, {
            step: 'main_write',
            userId,
            attempt,
            code: code ?? 'unknown',
            message: msg,
          })
        } else {
          logger.error('onboarding.save.failed', err as Error, {
            step: 'main_write',
            attempt,
            userId,
            code: code ?? 'unknown',
            message: msg,
          })
        }
        writeError = { message: msg, code: code }
      }

      if (writeError) {
        setError(`Could not save your profile: ${writeError.message}`)
        setShowContinueAnyway(true)
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
          logger.warn('onboarding.complete.verify_error', {
            userId,
            code: verifyErr.code,
            message: verifyErr.message,
          })
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
            logger.warn('onboarding.complete.verify_retry_failed', {
              userId,
              code: retryResult.error.code,
              message: retryResult.error.message,
            })
          } else {
            logger.warn('onboarding.save.ok', { userId, path: 'verify_retry' })
          }
        }
      } catch (verifyErr: unknown) {
        // Verification failed — navigate anyway; middleware will catch loops.
        logger.warn('onboarding.complete.verify_error', {
          userId,
          message: getErrorMessage(verifyErr),
        })
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
        logger.warn(
          isTimeout ? 'onboarding.complete.timeout' : 'onboarding.complete.outer_abort',
          { message: msg }
        )
        router.push('/')
        return
      }

      logger.error('onboarding.complete.failed', err as Error, {
        step: 'handleComplete',
        message: msg,
      })
      setError(typeof msg === 'string' ? msg : 'Failed to save. Please try again.')
      setShowContinueAnyway(true)
    } finally {
      setSubmitting(false)
    }
  }, [authUser, authLoading, phone, userRole, adminCode, zipCode, city, state, latitude, longitude, selectedNeeds, preferredLanguage, router, supabase])

  const handleSkip = useCallback(async () => {
    const userId = userIdRef.current ?? authUser?.id ?? null
    // Facilitators must complete location — do not allow skip.
    if (userRole === 'facilitator') return
    if (!userId) {
      // No user — redirect immediately; skip the write entirely.
      logger.warn('onboarding.skip.no_user', { authLoading })
      router.push('/')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await markCompleteAndNavigate(userId)
    } finally {
      setSubmitting(false)
    }
  }, [authUser, authLoading, markCompleteAndNavigate, router])

  const canProceedStep1 = userRole !== null && (userRole !== 'facilitator' || adminCode.trim().length > 0)
  const canProceedStep2 = zipCode.length >= 5 || (latitude !== null && longitude !== null)
  const canProceedStep3 = selectedNeeds.length > 0
  const canProceedStep5 = preferredLanguage.length > 0

  return (
    <div
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
          <CardTitle className="text-2xl font-bold text-lime-800">
            {step === 1 && "I'm here to..."}
            {step === 2 && 'Where are you located?'}
            {step === 3 && (userRole === 'providing' || userRole === 'facilitator' ? 'What can you help with?' : 'What do you need help with?')}
            {step === 4 && 'How can we reach you?'}
            {step === 5 && 'What language do you prefer?'}
          </CardTitle>
          <CardDescription className="text-stone-600">
            {step === 1 && 'Tell us how you want to use FEED'}
            {step === 2 && 'This helps us find resources near you'}
            {step === 3 && 'Select all that apply - you can change this later'}
            {step === 4 && 'Optional - for appointment reminders and updates'}
            {step === 5 && 'The AI assistant will greet you in your language'}
          </CardDescription>
          {/* Step indicator */}
          <div className="flex justify-center gap-2 mt-4">
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
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md space-y-2">
              <p>{error}</p>
              {showContinueAnyway && (
                <button
                  onClick={async () => {
                    const userId = userIdRef.current ?? authUser?.id ?? null
                    if (userId) {
                      setSubmitting(true)
                      try {
                        await markCompleteAndNavigate(userId)
                      } finally {
                        setSubmitting(false)
                      }
                    } else {
                      router.push('/')
                    }
                  }}
                  className="underline font-medium text-destructive hover:text-destructive/80"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {/* Step 1: Role Selection */}
          {step === 1 && (
            <div className="space-y-3">
              {ROLE_OPTIONS.map((role) => {
                const Icon = role.icon
                const isSelected = userRole === role.id
                return (
                  <button
                    key={role.id}
                    onClick={() => setUserRole(role.id as UserRole)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? role.color
                        : 'border-stone-200 bg-white/90 hover:border-lime-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-white/80' : 'bg-stone-100'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{role.label}</p>
                      <p className="text-xs text-stone-500 mt-0.5">{role.description}</p>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-lime-600 flex-shrink-0 mt-1" />}
                  </button>
                )
              })}

              {userRole === 'facilitator' && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-stone-700 mb-1 block">
                    Administrator code <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="password"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    placeholder="Enter administrator code"
                    className="bg-white/90 border-amber-300 text-stone-900 placeholder:text-stone-400"
                    autoComplete="off"
                  />
                  <p className="text-xs text-stone-500 mt-1">
                    Contact your system administrator for the code.
                  </p>
                </div>
              )}

              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white mt-4"
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              {userRole !== 'facilitator' && (
                <button
                  onClick={handleSkip}
                  disabled={submitting}
                  className="w-full text-center text-sm text-stone-400 hover:text-lime-700 mt-2 transition-colors disabled:opacity-50"
                >
                  Find out how to help Feed.
                </button>
              )}
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full py-6 border-lime-300 bg-white/90 hover:bg-lime-50"
                onClick={handleUseLocation}
                disabled={geoLoading}
              >
                <Navigation className={`w-4 h-4 mr-2 ${geoLoading ? 'animate-spin' : ''}`} />
                {geoLoading ? 'Getting location...' : 'Use my current location'}
              </Button>

              {latitude && longitude && (
                <div className="flex items-center gap-2 p-3 bg-lime-50 rounded-lg text-sm text-lime-700">
                  <Check className="w-4 h-4" />
                  Location detected{city ? `: ${city}${state ? `, ${state}` : ''}` : ''}
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-stone-50 px-2 text-stone-400">Or enter manually</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-stone-700 mb-1 block">ZIP Code</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <Input
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      placeholder="90001"
                      className="pl-10 bg-white/90 border-lime-300 text-stone-900 placeholder:text-stone-400"
                      maxLength={5}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-stone-700 mb-1 block">City</label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Los Angeles"
                      className="bg-white/90 border-lime-300 text-stone-900 placeholder:text-stone-400"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-stone-700 mb-1 block">State</label>
                    <Input
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="CA"
                      className="bg-white/90 border-lime-300 text-stone-900 placeholder:text-stone-400"
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={!canProceedStep2}
                  onClick={() => setStep(3)}
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Needs / Offerings */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {NEEDS_OPTIONS.map((need) => {
                  const isSelected = selectedNeeds.includes(need.id)
                  return (
                    <button
                      key={need.id}
                      onClick={() => toggleNeed(need.id)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-lime-500 bg-lime-50'
                          : 'border-stone-200 bg-white/90 hover:border-lime-300'
                      }`}
                    >
                      <span className="text-lg mb-1 block">{need.emoji}</span>
                      <span className="text-sm font-medium">{need.label}</span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-lime-600 absolute top-2 right-2" />
                      )}
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(2)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={!canProceedStep3}
                  onClick={() => setStep(4)}
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Contact (optional) */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-stone-700 mb-1 block">
                  Phone Number <span className="text-stone-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    type="tel"
                    className="pl-10 bg-white/90 border-lime-300 text-stone-900 placeholder:text-stone-400"
                  />
                </div>
                <p className="text-xs text-stone-400 mt-1">
                  For appointment reminders and important updates only. Never shared.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(3)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setStep(5)}
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>

              {userRole !== 'facilitator' && (
                <button
                  onClick={handleSkip}
                  disabled={submitting}
                  className="w-full text-center text-sm text-stone-400 hover:text-stone-600 disabled:opacity-50"
                >
                  Skip for now
                </button>
              )}
            </div>
          )}

          {/* Step 5: Language Preference */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                <select
                  data-testid="language-select"
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-lime-300 bg-white/90 text-stone-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-lime-400"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.nativeName} — {lang.englishName}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-stone-400">
                You can change this at any time in Settings.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(4)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleComplete}
                  disabled={submitting || !canProceedStep5}
                >
                  {submitting ? 'Saving...' : 'Get Started'}
                </Button>
              </div>

              {userRole !== 'facilitator' && (
                <button
                  onClick={handleSkip}
                  disabled={submitting}
                  className="w-full text-center text-sm text-stone-400 hover:text-stone-600 disabled:opacity-50"
                >
                  Skip for now
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
