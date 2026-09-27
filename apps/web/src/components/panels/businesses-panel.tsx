'use client'

// apps/web/src/components/panels/businesses-panel.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P4a Community → Businesses panel. Two surfaces in one member-reachable panel:
//   * Showcase: every APPROVED local business, sorted by bucketed distance (reuses the
//     existing haversine calculateDistance + the server distance-bucket vocabulary via
//     bucketForKm/distanceBucketLabel — no new distance formula). Each row links to its
//     public /s/business/[id] page and shows its leaf.
//   * Submit: any signed-in non-guest member can submit a business; it enters review as
//     pending (truthful-optimistic — never shown as already-live; reverts with a banner on
//     failure — CINV4). Guests see a create-account prompt instead of the form.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Leaf, Plus, MapPin, ExternalLink, Loader2, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useGeolocation, calculateDistance } from '@/hooks/use-geolocation'
import { usePanelContext } from '@/components/layout/feed-shell'
import { Button } from '@/components/ui/button'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { logger } from '@/lib/logger'
import { distanceBucketLabel } from '@/components/feed/post-model'
import {
  bucketForKm,
  parseGeographyPoint,
  sortByDistanceKm,
  nextSubmitPhase,
  type Business,
  type SubmitPhase,
  type NewBusinessInput,
} from '@/lib/business'
import { fetchApprovedBusinesses, submitBusiness } from '@/lib/business-data'

const INPUT_CLASS =
  'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-lime-500'

const EMPTY_FORM: NewBusinessInput = {
  name: '',
  description: '',
  address: '',
  city: '',
  state: '',
  phone: '',
  website: '',
}

export function BusinessesPanel() {
  const { user, isAnonymous } = useAuth()
  const { position } = useGeolocation()
  const { panelParams } = usePanelContext()
  const supabase = createClient()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(panelParams?.subtab === 'submit')
  const [form, setForm] = useState<NewBusinessInput>(EMPTY_FORM)
  const [phase, setPhase] = useState<SubmitPhase>({ kind: 'idle' })

  const canSubmit = !!user && !isAnonymous

  const loadBusinesses = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const rows = await fetchApprovedBusinesses(supabase)
      setBusinesses(rows)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load businesses')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadBusinesses()
  }, [loadBusinesses])

  // Sort by bucketed distance when a position is available; else keep the name order the
  // reader returned. Distance uses the existing haversine calculateDistance.
  const origin = position?.coords
  const sorted = useMemo(() => {
    if (!origin) return businesses
    const kmOf = (b: Business): number | null => {
      const pt = parseGeographyPoint(b.location)
      if (!pt) return null
      return calculateDistance(origin.latitude, origin.longitude, pt.lat, pt.lng)
    }
    return sortByDistanceKm(businesses, kmOf)
  }, [businesses, origin])

  const labelFor = useCallback(
    (b: Business): string | null => {
      if (!origin) return null
      const pt = parseGeographyPoint(b.location)
      if (!pt) return null
      return distanceBucketLabel(bucketForKm(calculateDistance(origin.latitude, origin.longitude, pt.lat, pt.lng)))
    },
    [origin]
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!canSubmit || !form.name.trim()) return
      // Optimistic: enter the submitting phase immediately. On resolve we settle to a
      // TRUTHFUL phase from the outcome — 'pending' review on success (never live), or revert
      // to an error banner (form preserved) on failure.
      setPhase({ kind: 'submitting' })
      const outcome = await submitBusiness(supabase, form, user!.id)
      const next = nextSubmitPhase(outcome)
      setPhase(next)
      if (next.kind === 'pending') {
        logger.info('business.submit.pending', { org_id: next.id })
        setForm(EMPTY_FORM)
      } else if (next.kind === 'error') {
        logger.error('business.submit.failed', new Error(next.message), { outcome: 'error' })
      }
    },
    [canSubmit, form, supabase, user]
  )

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-100 text-lime-700">
              <Leaf className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-800">Local Businesses</h1>
              <p className="text-xs text-stone-500">Community-submitted local businesses near you</p>
            </div>
          </div>
          {canSubmit && !showForm && (
            <Button
              size="sm"
              className="bg-lime-700 hover:bg-lime-800 text-white"
              onClick={() => {
                setPhase({ kind: 'idle' })
                setShowForm(true)
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add a local business
            </Button>
          )}
        </div>

        {/* Submit affordance for guests */}
        {!canSubmit && (
          <CreateAccountPrompt message="Create a free account to add a local business to the map" />
        )}

        {/* Submit form (member-only) */}
        {canSubmit && showForm && (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-stone-200 bg-white p-4 space-y-3"
            aria-label="Submit a local business"
          >
            <h2 className="text-sm font-semibold text-stone-800">Add a local business</h2>

            {phase.kind === 'error' && (
              <div
                role="alert"
                className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-800"
              >
                Could not submit: {phase.message}. Please try again.
              </div>
            )}

            {phase.kind === 'pending' ? (
              <div className="flex items-start gap-2 rounded-lg bg-lime-50 px-3 py-3 text-sm text-stone-700">
                <CheckCircle className="h-5 w-5 shrink-0 text-lime-700" />
                <div>
                  <p className="font-medium text-stone-800">Submitted for review</p>
                  <p>Your business is pending review. A resource admin will approve it before it appears on the map.</p>
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-lime-700 hover:underline"
                    onClick={() => {
                      setPhase({ kind: 'idle' })
                      setShowForm(false)
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="biz-name" className="mb-1 block text-xs font-medium text-stone-600">
                    Business name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="biz-name"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={INPUT_CLASS}
                    placeholder="Corner Cafe"
                  />
                </div>
                <div>
                  <label htmlFor="biz-desc" className="mb-1 block text-xs font-medium text-stone-600">
                    Description
                  </label>
                  <textarea
                    id="biz-desc"
                    value={form.description ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className={INPUT_CLASS}
                    rows={3}
                    placeholder="What does this business offer the community?"
                  />
                </div>
                <div>
                  <label htmlFor="biz-address" className="mb-1 block text-xs font-medium text-stone-600">
                    Street address
                  </label>
                  <input
                    id="biz-address"
                    value={form.address ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    className={INPUT_CLASS}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="biz-city" className="mb-1 block text-xs font-medium text-stone-600">
                      City
                    </label>
                    <input
                      id="biz-city"
                      value={form.city ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="Burlington"
                    />
                  </div>
                  <div>
                    <label htmlFor="biz-state" className="mb-1 block text-xs font-medium text-stone-600">
                      State
                    </label>
                    <input
                      id="biz-state"
                      value={form.state ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="VT"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="biz-phone" className="mb-1 block text-xs font-medium text-stone-600">
                      Phone
                    </label>
                    <input
                      id="biz-phone"
                      value={form.phone ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="(802) 555-0100"
                    />
                  </div>
                  <div>
                    <label htmlFor="biz-website" className="mb-1 block text-xs font-medium text-stone-600">
                      Website
                    </label>
                    <input
                      id="biz-website"
                      value={form.website ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    className="bg-lime-700 hover:bg-lime-800 text-white"
                    disabled={phase.kind === 'submitting' || !form.name.trim()}
                  >
                    {phase.kind === 'submitting' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      'Submit for review'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false)
                      setPhase({ kind: 'idle' })
                    }}
                    disabled={phase.kind === 'submitting'}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </form>
        )}

        {/* Showcase list */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-stone-600">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">
            {loadError}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 py-10 text-center text-sm text-stone-500">
            No local businesses yet. {canSubmit ? 'Be the first to add one.' : ''}
          </div>
        ) : (
          <ul className="space-y-3">
            {sorted.map((b) => {
              const label = labelFor(b)
              const addr = [b.city, b.state].filter(Boolean).join(', ')
              return (
                <li key={b.id}>
                  <a
                    href={`/s/business/${b.id}`}
                    className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-lime-300 hover:bg-lime-50/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#0f766e] text-white shadow-sm">
                      <Leaf className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate font-semibold text-stone-800">{b.name}</h3>
                        <ExternalLink className="h-4 w-4 shrink-0 text-stone-400" />
                      </div>
                      {b.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-stone-600">{b.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                        {addr && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {addr}
                          </span>
                        )}
                        {label && <span>{label}</span>}
                      </div>
                    </div>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
