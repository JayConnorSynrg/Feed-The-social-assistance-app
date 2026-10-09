'use client'

// apps/web/src/components/panels/businesses-panel.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P4a Community → Businesses panel. Two surfaces in one member-reachable panel:
//   * Showcase: every APPROVED local business, sorted by bucketed distance (reuses the
//     existing haversine calculateDistance + the server distance-bucket vocabulary via
//     bucketForKm/distanceBucketLabel — no new distance formula). Each row shows the
//     business's logo (embedded in the ONE list query — no N+1) or an initial fallback, and
//     links to its public /s/business/[id] page.
//   * Submit: any signed-in non-guest member can submit a rich business profile — details,
//     hours, photos (logo/cover/gallery via the existing validating uploader), services,
//     attributes, and social links. It enters review as pending (truthful-optimistic — never
//     shown as already-live; reverts with a banner on failure; a partial-child failure is
//     surfaced honestly — CINV4). Guests see a create-account prompt instead of the form.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Leaf,
  Plus,
  MapPin,
  ExternalLink,
  Loader2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ImagePlus,
  X,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir } from '@/lib/i18n'
import { AdminEditLinkIsland } from '@/components/admin/admin-edit-link-island'
import { ADMIN_EDIT_LINK_CLASS } from '@/components/admin/admin-edit-link'
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
  type BusinessHours,
  type BusinessPhoto,
  type BusinessService,
  type CostModel,
  type SubmitPhase,
  type NewBusinessInput,
} from '@/lib/business'
import { BUSINESS_CATEGORIES, BUSINESS_ATTRIBUTES, SOCIAL_PLATFORMS } from '@/lib/business-vocab'
import { fetchApprovedBusinesses, submitBusiness, withPhotoUploadMetric, photoImageType } from '@/lib/business-data'
import { uploadPostImage, deletePostImage } from '@/lib/post-image-upload'

const INPUT_CLASS =
  'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-lime-500'

// ---- Hours editor model -------------------------------------------------------------------------
// index 0..6 == Sunday..Saturday, matching BusinessHours.day_of_week.
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
interface Interval {
  open: string
  close: string
}
interface DayHours {
  closed: boolean
  intervals: Interval[]
}
function emptyHours(): DayHours[] {
  return DAY_LABELS.map(() => ({ closed: true, intervals: [{ open: '', close: '' }] }))
}
/** A day with no complete interval, or marked closed, contributes no rows (== closed). */
function serializeHours(days: DayHours[]): BusinessHours[] {
  const out: BusinessHours[] = []
  days.forEach((day, dow) => {
    if (day.closed) return
    for (const iv of day.intervals) {
      if (iv.open && iv.close) out.push({ day_of_week: dow, open_time: iv.open, close_time: iv.close })
    }
  })
  return out
}

const COST_OPTIONS: { value: CostModel; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'sliding_scale', label: 'Sliding scale' },
  { value: 'paid', label: 'Paid' },
]

const ACCEPT = 'image/jpeg,image/png,image/webp'

interface UploadedPhoto {
  url: string
  path: string
}
type PhotoKind = 'logo' | 'cover' | 'gallery'

const EMPTY_FORM: NewBusinessInput = {
  name: '',
  description: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  phone: '',
  email: '',
  website: '',
  business_category: '',
  cost_model: null,
  service_radius_miles: null,
}

// ---- Collapsible progressive-disclosure section -------------------------------------------------
function Section({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string
  hint?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-stone-200">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-stone-700 hover:bg-stone-50"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 text-stone-400" /> : <ChevronRight className="h-4 w-4 text-stone-400" />}
          {title}
        </span>
        {hint && <span className="text-xs font-normal text-stone-400">{hint}</span>}
      </button>
      {open && <div className="space-y-3 border-t border-stone-100 px-3 py-3">{children}</div>}
    </div>
  )
}

export function BusinessesPanel() {
  const { user, isAnonymous } = useAuth()
  // The admin-only "Edit in admin" link speaks the viewer's profile language (the panel is English).
  const adminLocale = useProfileLocale()
  const { position } = useGeolocation()
  const { panelParams } = usePanelContext()
  const supabase = createClient()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  // Open the submit form when reached via the add-business deep link, which sets
  // panelParams.businessSubmit through the feed-shell alias routing.
  useEffect(() => {
    if (panelParams?.businessSubmit) setShowForm(true)
  }, [panelParams?.businessSubmit])

  // Scalar fields (org row).
  const [form, setForm] = useState<NewBusinessInput>(EMPTY_FORM)
  const [phase, setPhase] = useState<SubmitPhase>({ kind: 'idle' })

  // Rich-profile child editors.
  const [hours, setHours] = useState<DayHours[]>(emptyHours)
  const [logo, setLogo] = useState<UploadedPhoto | null>(null)
  const [cover, setCover] = useState<UploadedPhoto | null>(null)
  const [gallery, setGallery] = useState<UploadedPhoto[]>([])
  const [photoBusy, setPhotoBusy] = useState<Record<PhotoKind, boolean>>({ logo: false, cover: false, gallery: false })
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [services, setServices] = useState<{ name: string; description: string }[]>([])
  const [attributes, setAttributes] = useState<Record<string, boolean>>({})
  const [social, setSocial] = useState<Record<string, string>>({})

  // Progressive disclosure — advanced sections collapsed by default.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const toggleSection = useCallback((key: string) => setOpenSections((s) => ({ ...s, [key]: !s[key] })), [])

  // Single-flight guard — the ref flips synchronously before the first await so a rapid
  // double-click cannot start two submissions (state updates alone would race).
  const submittingRef = useRef(false)

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

  // Clear every editor after a successful submit. Does NOT delete uploaded blobs — they now belong
  // to the created (pending) org; only the local references are dropped.
  const resetEditors = useCallback(() => {
    setForm(EMPTY_FORM)
    setHours(emptyHours())
    setLogo(null)
    setCover(null)
    setGallery([])
    setPhotoError(null)
    setServices([])
    setAttributes({})
    setSocial({})
    setOpenSections({})
  }, [])

  // Upload a selected file through the existing validating edge uploader, wrapped in the
  // business.photo.upload metric. A reject (magic-byte/size/guest) makes uploadPostImage return an
  // error; we throw so withPhotoUploadMetric emits EXACTLY ONE .error and re-throws — then we
  // surface it to the user. On success it emits exactly one .complete.
  const handlePhotoSelect = useCallback(
    async (kind: PhotoKind, file: File | undefined) => {
      if (!file) return
      setPhotoError(null)
      setPhotoBusy((b) => ({ ...b, [kind]: true }))
      try {
        const uploaded = await withPhotoUploadMetric(photoImageType(file.type), file.size, async () => {
          const { url, path, error } = await uploadPostImage(file)
          if (error || !url || !path) throw new Error(error ?? 'Upload failed. Please try again.')
          return { url, path }
        })
        if (kind === 'logo') setLogo(uploaded)
        else if (kind === 'cover') setCover(uploaded)
        else setGallery((g) => [...g, uploaded])
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
      } finally {
        setPhotoBusy((b) => ({ ...b, [kind]: false }))
      }
    },
    []
  )

  const removePhoto = useCallback(
    (kind: PhotoKind, index?: number) => {
      if (kind === 'logo' && logo) {
        void deletePostImage(logo.path)
        setLogo(null)
      } else if (kind === 'cover' && cover) {
        void deletePostImage(cover.path)
        setCover(null)
      } else if (kind === 'gallery' && index != null) {
        const target = gallery[index]
        if (target) void deletePostImage(target.path)
        setGallery((g) => g.filter((_, i) => i !== index))
      }
    },
    [logo, cover, gallery]
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!canSubmit || !form.name.trim()) return
      // Single-flight: reject a second submit already in flight.
      if (submittingRef.current) return
      submittingRef.current = true
      setPhase({ kind: 'submitting' })
      try {
        // Assemble child rows from the editors. Photos are already uploaded (on select), so this
        // only maps the stored {url,path} into BusinessPhoto rows with kind + sort_order.
        const photos: BusinessPhoto[] = []
        if (logo) photos.push({ kind: 'logo', url: logo.url, storage_path: logo.path, sort_order: 0, caption: null })
        if (cover) photos.push({ kind: 'cover', url: cover.url, storage_path: cover.path, sort_order: 0, caption: null })
        gallery.forEach((g, i) =>
          photos.push({ kind: 'gallery', url: g.url, storage_path: g.path, sort_order: i, caption: null })
        )

        const serviceRows: BusinessService[] = services
          .filter((s) => s.name.trim())
          .map((s, i) => ({ name: s.name.trim(), description: s.description.trim() || null, sort_order: i }))

        // Only true attributes are stored (Record<string, true>).
        const attributesOut: Record<string, boolean> = {}
        for (const [k, v] of Object.entries(attributes)) if (v) attributesOut[k] = true

        // Non-empty social values only; the data layer normalizes each at write (allowlisted schemes).
        const socialOut: Record<string, string> = {}
        for (const [k, v] of Object.entries(social)) if (v.trim()) socialOut[k] = v.trim()

        const input: NewBusinessInput = {
          ...form,
          service_radius_miles:
            form.service_radius_miles == null || Number.isNaN(form.service_radius_miles)
              ? null
              : form.service_radius_miles,
          attributes: attributesOut,
          social_links: socialOut,
          hours: serializeHours(hours),
          services: serviceRows,
          photos,
        }

        const outcome = await submitBusiness(supabase, input, user!.id)
        const next = nextSubmitPhase(outcome)
        setPhase(next)
        if (next.kind === 'pending') {
          logger.info('business.submit.pending', { org_id: next.id, partial: !!next.warning })
          resetEditors()
        } else if (next.kind === 'error') {
          logger.error('business.submit.failed', new Error(next.message), { outcome: 'error' })
        }
      } catch (err) {
        // Defense-in-depth: submitBusiness honors a non-throwing contract, but should any future
        // code path here throw, settle to a truthful error phase so the form can never hang on
        // "Submitting…" with no banner.
        setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'Submission failed' })
      } finally {
        submittingRef.current = false
      }
    },
    [canSubmit, form, logo, cover, gallery, services, attributes, social, hours, supabase, user, resetEditors]
  )

  const submitting = phase.kind === 'submitting'

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
              <div role="alert" className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-800">
                Could not submit: {phase.message}. Please try again.
              </div>
            )}

            {phase.kind === 'pending' ? (
              <div className="flex items-start gap-2 rounded-lg bg-lime-50 px-3 py-3 text-sm text-stone-700">
                <CheckCircle className="h-5 w-5 shrink-0 text-lime-700" />
                <div>
                  <p className="font-medium text-stone-800">Submitted for review</p>
                  <p>Your business is pending review. A resource admin will approve it before it appears on the map.</p>
                  {phase.warning && (
                    <p className="mt-1 flex items-start gap-1 text-amber-700">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {phase.warning}
                    </p>
                  )}
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
                {/* --- Core fields (always visible) --- */}
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
                      type="url"
                      value={form.website ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                {/* --- Details section --- */}
                <Section title="Details" open={!!openSections.details} onToggle={() => toggleSection('details')}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="biz-category" className="mb-1 block text-xs font-medium text-stone-600">
                        Category
                      </label>
                      <select
                        id="biz-category"
                        value={form.business_category ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, business_category: e.target.value || null }))}
                        className={INPUT_CLASS}
                      >
                        <option value="">Select…</option>
                        {BUSINESS_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="biz-email" className="mb-1 block text-xs font-medium text-stone-600">
                        Email
                      </label>
                      <input
                        id="biz-email"
                        type="email"
                        value={form.email ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className={INPUT_CLASS}
                        placeholder="hello@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-medium text-stone-600">Cost model</span>
                    <div className="inline-flex rounded-lg border border-stone-200 p-0.5" role="group" aria-label="Cost model">
                      {COST_OPTIONS.map((opt) => {
                        const active = form.cost_model === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setForm((f) => ({ ...f, cost_model: f.cost_model === opt.value ? null : opt.value }))
                            }
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                              active ? 'bg-lime-700 text-white' : 'text-stone-600 hover:bg-stone-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="biz-zip" className="mb-1 block text-xs font-medium text-stone-600">
                        ZIP code
                      </label>
                      <input
                        id="biz-zip"
                        inputMode="numeric"
                        value={form.zip_code ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))}
                        className={INPUT_CLASS}
                        placeholder="05401"
                      />
                    </div>
                    <div>
                      <label htmlFor="biz-radius" className="mb-1 block text-xs font-medium text-stone-600">
                        Service radius (miles)
                      </label>
                      <input
                        id="biz-radius"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={form.service_radius_miles ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            service_radius_miles: e.target.value === '' ? null : Number(e.target.value),
                          }))
                        }
                        className={INPUT_CLASS}
                        placeholder="10"
                      />
                    </div>
                  </div>
                </Section>

                {/* --- Hours section --- */}
                <Section title="Hours" open={!!openSections.hours} onToggle={() => toggleSection('hours')}>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setHours((days) => {
                          const monday = days[1]
                          const copy = { closed: monday.closed, intervals: monday.intervals.map((iv) => ({ ...iv })) }
                          return days.map((d, i) => (i >= 2 && i <= 5 ? { closed: copy.closed, intervals: copy.intervals.map((iv) => ({ ...iv })) } : d))
                        })
                      }
                      className="text-xs font-medium text-lime-700 hover:underline"
                    >
                      Copy Monday to weekdays
                    </button>
                  </div>
                  {hours.map((day, dow) => (
                    <div key={dow} className="rounded-lg border border-stone-100 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-700">{DAY_LABELS[dow]}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!day.closed}
                          aria-label={`${DAY_LABELS[dow]} open`}
                          onClick={() =>
                            setHours((days) => days.map((d, i) => (i === dow ? { ...d, closed: !d.closed } : d)))
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                            day.closed ? 'bg-stone-100 text-stone-500' : 'bg-lime-100 text-lime-700'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${day.closed ? 'bg-stone-400' : 'bg-lime-600'}`}
                            aria-hidden="true"
                          />
                          {day.closed ? 'Closed' : 'Open'}
                        </button>
                      </div>
                      {!day.closed && (
                        <div className="mt-2 space-y-2">
                          {day.intervals.map((iv, ii) => (
                            <div key={ii} className="flex items-center gap-2">
                              <input
                                type="time"
                                aria-label={`${DAY_LABELS[dow]} open time`}
                                value={iv.open}
                                onChange={(e) =>
                                  setHours((days) =>
                                    days.map((d, i) =>
                                      i === dow
                                        ? {
                                            ...d,
                                            intervals: d.intervals.map((x, j) =>
                                              j === ii ? { ...x, open: e.target.value } : x
                                            ),
                                          }
                                        : d
                                    )
                                  )
                                }
                                className={`${INPUT_CLASS} flex-1`}
                              />
                              <span className="text-xs text-stone-400">to</span>
                              <input
                                type="time"
                                aria-label={`${DAY_LABELS[dow]} close time`}
                                value={iv.close}
                                onChange={(e) =>
                                  setHours((days) =>
                                    days.map((d, i) =>
                                      i === dow
                                        ? {
                                            ...d,
                                            intervals: d.intervals.map((x, j) =>
                                              j === ii ? { ...x, close: e.target.value } : x
                                            ),
                                          }
                                        : d
                                    )
                                  )
                                }
                                className={`${INPUT_CLASS} flex-1`}
                              />
                              {day.intervals.length > 1 && (
                                <button
                                  type="button"
                                  aria-label="Remove interval"
                                  onClick={() =>
                                    setHours((days) =>
                                      days.map((d, i) =>
                                        i === dow ? { ...d, intervals: d.intervals.filter((_, j) => j !== ii) } : d
                                      )
                                    )
                                  }
                                  className="rounded p-1 text-stone-400 hover:text-red-600"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setHours((days) =>
                                days.map((d, i) =>
                                  i === dow ? { ...d, intervals: [...d.intervals, { open: '', close: '' }] } : d
                                )
                              )
                            }
                            className="text-xs font-medium text-lime-700 hover:underline"
                          >
                            + Add interval
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </Section>

                {/* --- Photos section --- */}
                <Section title="Photos" open={!!openSections.photos} onToggle={() => toggleSection('photos')}>
                  {photoError && (
                    <p role="alert" className="text-xs text-red-600">
                      {photoError}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <PhotoSingleSlot
                      label="Logo"
                      photo={logo}
                      busy={photoBusy.logo}
                      onSelect={(file) => handlePhotoSelect('logo', file)}
                      onRemove={() => removePhoto('logo')}
                    />
                    <PhotoSingleSlot
                      label="Cover"
                      photo={cover}
                      busy={photoBusy.cover}
                      onSelect={(file) => handlePhotoSelect('cover', file)}
                      onRemove={() => removePhoto('cover')}
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-medium text-stone-600">Gallery</span>
                    <div className="flex flex-wrap gap-2">
                      {gallery.map((g, i) => (
                        <div key={g.path} className="relative h-20 w-20 overflow-hidden rounded-lg border border-stone-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={g.url} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            aria-label="Remove gallery photo"
                            onClick={() => removePhoto('gallery', i)}
                            className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <label
                        className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-stone-300 text-stone-500 hover:border-lime-400 hover:text-lime-700 ${
                          photoBusy.gallery ? 'opacity-60' : ''
                        }`}
                      >
                        {photoBusy.gallery ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <ImagePlus className="h-5 w-5" />
                            <span className="text-[10px]">Add</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept={ACCEPT}
                          className="hidden"
                          disabled={photoBusy.gallery}
                          onChange={(e) => {
                            void handlePhotoSelect('gallery', e.target.files?.[0])
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </Section>

                {/* --- Services section --- */}
                <Section title="Services" open={!!openSections.services} onToggle={() => toggleSection('services')}>
                  {services.map((s, i) => (
                    <div key={i} className="rounded-lg border border-stone-100 p-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          aria-label={`Service ${i + 1} name`}
                          value={s.name}
                          onChange={(e) => setServices((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                          className={`${INPUT_CLASS} flex-1`}
                          placeholder="Service name"
                        />
                        <button
                          type="button"
                          aria-label="Remove service"
                          onClick={() => setServices((rows) => rows.filter((_, j) => j !== i))}
                          className="rounded p-1 text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        aria-label={`Service ${i + 1} description`}
                        value={s.description}
                        onChange={(e) =>
                          setServices((rows) => rows.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))
                        }
                        className={INPUT_CLASS}
                        placeholder="Short description (optional)"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setServices((rows) => [...rows, { name: '', description: '' }])}
                    className="text-xs font-medium text-lime-700 hover:underline"
                  >
                    + Add service
                  </button>
                </Section>

                {/* --- Attributes section --- */}
                <Section title="Attributes" open={!!openSections.attributes} onToggle={() => toggleSection('attributes')}>
                  <div className="flex flex-wrap gap-2">
                    {BUSINESS_ATTRIBUTES.map((attr) => {
                      const active = !!attributes[attr.key]
                      return (
                        <button
                          key={attr.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setAttributes((a) => ({ ...a, [attr.key]: !a[attr.key] }))}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            active
                              ? 'border-lime-600 bg-lime-100 text-lime-800'
                              : 'border-stone-200 text-stone-600 hover:border-lime-300'
                          }`}
                        >
                          {attr.label}
                        </button>
                      )
                    })}
                  </div>
                </Section>

                {/* --- Social section --- */}
                <Section title="Social links" open={!!openSections.social} onToggle={() => toggleSection('social')}>
                  {SOCIAL_PLATFORMS.map((p) => (
                    <div key={p.key}>
                      <label htmlFor={`social-${p.key}`} className="mb-1 block text-xs font-medium text-stone-600">
                        {p.label}
                      </label>
                      <input
                        id={`social-${p.key}`}
                        value={social[p.key] ?? ''}
                        onChange={(e) => setSocial((s) => ({ ...s, [p.key]: e.target.value }))}
                        className={INPUT_CLASS}
                        placeholder={p.base}
                      />
                    </div>
                  ))}
                </Section>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    className="bg-lime-700 hover:bg-lime-800 text-white"
                    disabled={submitting || !form.name.trim()}
                  >
                    {submitting ? (
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
                    disabled={submitting}
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
                <li key={b.id} className="flex flex-col gap-1">
                  <a
                    href={`/s/business/${b.id}`}
                    className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-lime-300 hover:bg-lime-50/40"
                  >
                    {b.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.logo_url}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#0f766e] text-sm font-semibold uppercase text-white shadow-sm">
                        {b.name.trim().charAt(0) || <Leaf className="h-4 w-4" />}
                      </div>
                    )}
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
                  {/* Admins only (renders nothing for anyone else). A sibling of the row link, never
                      inside it: an <a> may not contain another <a>. */}
                  <AdminEditLinkIsland
                    target={{ kind: 'business', id: b.id }}
                    itemName={b.name}
                    source="showcase_row"
                    locale={adminLocale}
                    lang={adminLocale}
                    dir={dir(adminLocale)}
                    className={`${ADMIN_EDIT_LINK_CLASS} self-end`}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// Single-photo slot (logo / cover): enforces exactly one in the UI — once a photo is set only its
// thumbnail + remove render, so a second logo/cover can't be added (mirrors the DB partial-unique
// index). The add affordance reappears after removal.
function PhotoSingleSlot({
  label,
  photo,
  busy,
  onSelect,
  onRemove,
}: {
  label: string
  photo: UploadedPhoto | null
  busy: boolean
  onSelect: (file: File | undefined) => void
  onRemove: () => void
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {photo ? (
        <div className="relative h-24 w-full overflow-hidden rounded-lg border border-stone-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            aria-label={`Remove ${label.toLowerCase()}`}
            onClick={onRemove}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label
          className={`flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-stone-300 text-stone-500 hover:border-lime-400 hover:text-lime-700 ${
            busy ? 'opacity-60' : ''
          }`}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px]">Add {label.toLowerCase()}</span>
            </>
          )}
          <input
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              onSelect(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}
