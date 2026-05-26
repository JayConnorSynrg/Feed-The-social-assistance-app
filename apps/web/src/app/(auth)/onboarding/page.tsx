'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthContext } from '@/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useGeolocation } from '@/hooks/use-geolocation'
import { MapPin, Navigation, Check, ArrowRight, ArrowLeft, Phone, HandHeart, Search, Users, Settings2 } from 'lucide-react'
import { logger } from '@/lib/logger'

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
    label: 'Facilitator',
    description: 'Volunteer to help run and maintain the open source FEED system',
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
type Step = 1 | 2 | 3 | 4

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)

  const { getCurrentPosition } = useGeolocation()

  const handleUseLocation = useCallback(async () => {
    setGeoLoading(true)
    setError(null)
    try {
      const position = await getCurrentPosition()
      if (position) {
        setLatitude(position.coords.latitude)
        setLongitude(position.coords.longitude)
        // Reverse geocode to get city/state/zip
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
          // Geocoding failed, but we still have coords
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

  const handleComplete = async () => {
    setLoading(true)
    setError(null)
    const timer = logger.time('auth.onboarding.complete')

    try {
      // Use the user from AuthProvider context exclusively.
      // NEVER call getSession() here — it acquires a navigator lock that
      // can deadlock against AuthProvider's own initialization, especially
      // under React Strict Mode's double-mount cycle. If the context has
      // no user after auth loading completes, redirect to login.
      const userId = authUser?.id
      if (!userId) {
        if (authLoading) {
          // Auth still initializing — retry after a short delay rather
          // than calling getSession() which would deadlock.
          setLoading(false)
          setError('Still loading your account. Please try again in a moment.')
          return
        }
        // Auth finished loading but no user — session expired or invalid.
        router.push('/login')
        return
      }

      const profileData = {
        id: userId,
        user_role: userRole,
        zip_code: zipCode || null,
        location_city: city || null,
        location_state: state || null,
        latitude: latitude,
        longitude: longitude,
        needs: selectedNeeds,
        phone: phone || null,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      } as any

      // Upsert with a timeout — Next.js patches global fetch and can abort
      // in-flight requests. If the timeout fires, the server-side write
      // likely completed before the abort.
      const upsertPromise = supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('upsert_timeout')), 10_000)
      )

      let upsertError: { message: string } | null = null
      try {
        const result = await Promise.race([upsertPromise, timeoutPromise])
        upsertError = result.error
      } catch (raceErr: unknown) {
        const msg = (raceErr as any)?.message ?? ''
        const isAbortOrTimeout =
          (raceErr as any)?.name === 'AbortError' ||
          msg.includes('signal') ||
          msg.includes('aborted') ||
          msg === 'upsert_timeout'

        if (!isAbortOrTimeout) throw raceErr
        // Abort or timeout — the upsert likely succeeded server-side.
        // Navigate and let middleware verify.
        logger.warn('auth.onboarding.upsert_aborted', { reason: msg })
      }

      if (upsertError) {
        logger.error('auth.onboarding.upsert_failed', upsertError, { userId })
        throw new Error(upsertError.message)
      }

      // Verify the write committed before navigating — prevents the
      // redirect loop where middleware sees onboarding_completed=false
      // and sends the user back here.
      try {
        const { data: verify } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', userId)
          .maybeSingle()
        if (!verify?.onboarding_completed) {
          logger.warn('auth.onboarding.verify_failed', { userId, verify })
          // Retry the upsert once
          await supabase.from('profiles').upsert({ id: userId, onboarding_completed: true }, { onConflict: 'id' })
        }
      } catch {
        // Verification failed — navigate anyway, middleware will catch
      }

      timer.end({ step: 'complete', userId })
      router.push('/')
      router.refresh()
    } catch (err: unknown) {
      const msg = (err as any)?.message ?? String(err)
      const isAbort =
        (err as any)?.name === 'AbortError' ||
        (typeof msg === 'string' && (msg.includes('signal') || msg.includes('aborted')))

      if (isAbort) {
        // Abort errors mean the whole operation was interrupted.
        // The upsert may have succeeded — navigate and let middleware decide.
        logger.warn('auth.onboarding.outer_abort', { message: msg })
        router.push('/')
        return
      }

      timer.error(err, { step: 'handleComplete' })
      setError(typeof msg === 'string' ? msg : 'Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canProceedStep1 = userRole !== null
  const canProceedStep2 = zipCode.length >= 5 || (latitude !== null && longitude !== null)
  const canProceedStep3 = selectedNeeds.length > 0

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
          </CardTitle>
          <CardDescription className="text-stone-600">
            {step === 1 && 'Tell us how you want to use FEED'}
            {step === 2 && 'This helps us find resources near you'}
            {step === 3 && 'Select all that apply - you can change this later'}
            {step === 4 && 'Optional - for appointment reminders and updates'}
          </CardDescription>
          {/* Step indicator */}
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`w-8 h-1.5 rounded-full transition-colors ${
                  s <= step ? 'bg-lime-600' : 'bg-stone-200'
                }`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              {error}
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

              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white mt-4"
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <button
                onClick={handleComplete}
                disabled={loading || authLoading}
                className="w-full text-center text-sm text-stone-400 hover:text-lime-700 mt-2 transition-colors"
              >
                Find out how to help Feed.
              </button>
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
                  onClick={handleComplete}
                  disabled={loading || authLoading}
                >
                  {loading ? 'Saving...' : authLoading ? 'Loading...' : 'Get Started'}
                </Button>
              </div>

              <button
                onClick={handleComplete}
                disabled={loading || authLoading}
                className="w-full text-center text-sm text-stone-400 hover:text-stone-600"
              >
                Skip for now
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
