'use client'

// apps/web/src/app/(admin)/moderation/resources-tab.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Resources tab: Discover (platform admins) and the review queue. P6 W4: every word is the
// admin's language (lib/i18n-admin-resources.ts); discovered names, descriptions and addresses keep
// their own (lang="" dir="auto"). A failure shows a translated line, never the server's text; a read
// or Discover failure writes one row with its code. Approve / Reject announce their result in an
// always-mounted status line and move focus to the next card (else the queue heading) before the
// card leaves; while an action runs its buttons are aria-disabled, so they keep focus.

import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  Search, Check, X, Loader2, Globe, MapPin, ExternalLink,
  AlertCircle, ChevronDown, ChevronUp, Map as MapIcon, List,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { MemberViewLink } from '@/components/admin/member-view-link'
import { resourceVisibility } from '@/lib/member-visibility'
import { privilegedRpc } from '@/lib/privileged-action'
import { needsLocation } from '@/lib/geocode-accuracy'
import { MapView, type MapViewHandle } from '@/components/map/map-view'
import { ResourceMarker } from '@/components/map/resource-marker'
import type { Resource as ResourceMarkerResource } from '@/components/map/resource-marker'
import { DiscoverProgress } from '@/components/ui/discover-progress'
import { useAdminTier } from '@/hooks/use-admin-tier'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, isolate } from '@/lib/format-message'
import { failureCode } from '@/lib/failure-code'
import { moderationCount } from '@/lib/i18n-admin-moderation'
import { formatCount } from '@/lib/i18n-intl'
import { orgFormT } from '@/lib/i18n-org-forms'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import {
  BULK_CONFIRM, BULK_DONE, REJECTED_BY_FILTER, SOURCE_COUNT, STAGED_CANDIDATES,
  adminResourcesT, contentTypeLabel, namedControl,
} from '@/lib/i18n-admin-resources'
import { DESTRUCTIVE_BUTTON_CLASS } from './post-moderation-actions'
import { AnnouncementText, NO_ANNOUNCEMENT, afterLayout, announce, focusAfterRowRemoval, type Announcement } from './row-focus'
import {
  ResourceEditDialog,
  type ResourceEditDialogInput,
  type ResourceEditDialogSavedRow,
} from './resource-edit-dialog'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface DiscoveryMeta {
  content_type: 'resource' | 'link' | 'form'
  source_url: string | null
  confidence: 'high' | 'medium'
  corroborating_count: number
  authoritative_domain: boolean
  sources?: string[]
  application_url?: string
}

interface PendingItem {
  id: string
  name: string
  description: string | null
  category: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  email: string | null
  website: string | null
  status: string
  discovery_metadata: DiscoveryMeta | null
  lat: number | null
  lng: number | null
  service_mode: string
  geocode_accuracy: string | null
}

type ContentFilter = 'all' | 'resource' | 'link' | 'form'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function provenanceLabel(meta: DiscoveryMeta, locale: Locale): string {
  if (meta.authoritative_domain) return adminResourcesT(locale, 'provenanceVerified')
  return moderationCount(SOURCE_COUNT, meta.corroborating_count, locale)
}

function confidenceClass(confidence: 'high' | 'medium'): string {
  return confidence === 'high'
    ? 'bg-green-100 text-green-800 border-green-700'
    : 'bg-amber-100 text-amber-800 border-amber-700'
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-1'
/** Each card's Details chevron: the stable place focus lands on when a card leaves. */
const detailsId = (id: string) => `resource-details-${id}`

function toMarkerResource(item: PendingItem): ResourceMarkerResource {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    address_line1: item.address,
    city: item.city,
    state: item.state,
    phone: item.phone,
    website: item.website,
    latitude: item.lat!,
    longitude: item.lng!,
  }
}

// Normalizes a pending-queue row (admin_list_pending_resources shape) into the
// shape <ResourceEditDialog> expects. Shape differs from the manage-list row:
// `address` (not `address_line1`) — email is now available on this RPC's
// return shape (INV D) and is mapped the same as every other visible field.
function toDialogInputFromPendingRow(item: PendingItem): ResourceEditDialogInput {
  return {
    id: item.id,
    name: item.name ?? '',
    description: item.description ?? '',
    category: item.category ?? 'other',
    address_line1: item.address ?? '',
    city: item.city ?? '',
    state: item.state ?? '',
    zip_code: item.zip_code ?? '',
    phone: item.phone ?? '',
    email: item.email ?? '',
    website: item.website ?? '',
    status: item.status ?? 'pending',
    service_mode: item.service_mode ?? 'physical',
    lat: item.lat,
    lng: item.lng,
    geocode_accuracy: item.geocode_accuracy,
  }
}

// Shared reverse-geocode helper — resolves browser position to a { label, lat, lng }
// triple.  Returns null silently if geolocation is unavailable or denied.
async function resolveGeoLabel(): Promise<{ label: string; lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        if (!token) {
          resolve({ label: '', lat, lng })
          return
        }
        try {
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,region&access_token=${token}`
          const resp = await fetch(url)
          if (!resp.ok) { resolve({ label: '', lat, lng }); return }
          const json = await resp.json() as {
            features?: Array<{ text?: string; place_name?: string; context?: Array<{ id?: string; short_code?: string }> }>
          }
          const place = json.features?.[0]
          if (!place) { resolve({ label: '', lat, lng }); return }
          const placeName = place.text ?? ''
          const regionShort = place.context?.find((c) => c.id?.startsWith('region'))?.short_code?.replace('US-', '') ?? ''
          const label = regionShort ? `${placeName}, ${regionShort}` : placeName
          resolve({ label, lat, lng })
        } catch {
          resolve({ label: '', lat, lng })
        }
      },
      () => { resolve(null) },
      { timeout: 8000 },
    )
  })
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function ResourcesTab({ locale }: { locale: Locale }) {
  const supabase = createClient()
  const t = useCallback((key: Parameters<typeof adminResourcesT>[1]) => adminResourcesT(locale, key), [locale])
  const progressLabels = useMemo(
    () => [t('progressSearching'), t('progressVerifying'), t('progressGeocoding')],
    [t],
  )
  const mapRef = useRef<MapViewHandle>(null)
  // P3.1: RA sees the review queue (approve/reject/update resources), but Discover (paid
  // Firecrawl) and form-template approval stay platform-admin only.
  const { tier } = useAdminTier()
  const isPA = tier === 'platform_admin'

  const [query, setQuery] = useState('')
  const [discovering, setDiscovering] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)
  const [discoverSummary, setDiscoverSummary] = useState<string | null>(null)

  const [pending, setPending] = useState<PendingItem[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState<string | null>(null)

  const [filter, setFilter] = useState<ContentFilter>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkRunning, setBulkRunning] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'map'>('list')
  const [nearLocation, setNearLocation] = useState<{ label: string; lat: number | null; lng: number | null }>({ label: '', lat: null, lng: null })
  const [discoveryJustCompleted, setDiscoveryJustCompleted] = useState(false)

  // Edit-then-confirm approve dialog (INV D) — resource/link items only; form
  // items keep the one-click approve_form_template path (no resource fields to edit).
  const [approveTarget, setApproveTarget] = useState<PendingItem | null>(null)

  // The result of the last approve / reject, announced by an always-mounted status line.
  const [status, setStatus] = useState<Announcement>(NO_ANNOUNCEMENT)
  // Focus after a card leaves: chosen before the queue changes, applied after it re-renders.
  const focusTarget = useRef<{ id: string | null } | null>(null)
  const chevrons = useRef(new Map<string, HTMLButtonElement>())
  const queueHeading = useRef<HTMLHeadingElement | null>(null)
  const bulkButton = useRef<HTMLButtonElement | null>(null)
  const restoreBulk = useRef(false)
  // Opening the bulk confirmation replaces the button that had focus: focus moves to Confirm.
  const bulkConfirmButton = useRef<HTMLButtonElement | null>(null)
  const focusBulkConfirm = useRef(false)
  // An approve the dialog confirmed: announced and focused once the dialog has fully closed.
  const dialogDone = useRef<{ text: string; focus: string | null } | null>(null)
  // The cards on screen, in order (set each render): where focus goes when one leaves.
  const visibleIdsRef = useRef<string[]>([])

  // ── Load pending queue ──────────────────────────────────────

  const loadPending = useCallback(async () => {
    setQueueLoading(true)
    setQueueError(null)
    try {
      const { data, error } = await supabase.rpc('admin_list_pending_resources')
      if (error) throw error
      setPending((data ?? []) as PendingItem[])
    } catch (err) {
      // No other row records this read: one row with its code, never the message.
      logger.warn('admin.resources.load_failed', { code: failureCode(err) })
      setQueueError(adminResourcesT(locale, 'queueLoadFailed'))
    } finally {
      setQueueLoading(false)
    }
  }, [supabase, locale])

  useEffect(() => {
    void loadPending()
    // The first load only; Retry and Discover reload explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  useEffect(() => {
    const target = focusTarget.current
    if (!target) return
    focusTarget.current = null
    afterLayout(() => {
      const node = target.id ? chevrons.current.get(target.id) : null
      ;(node ?? queueHeading.current)?.focus()
    })
  }, [pending])

  // Opening the bulk confirmation moves focus to its Confirm (described by the question) in the same
  // commit that mounts it — before paint, so focus never rests on the removed button.
  useLayoutEffect(() => {
    if (!focusBulkConfirm.current) return
    focusBulkConfirm.current = false
    bulkConfirmButton.current?.focus()
  })

  // Cancel on the bulk confirmation brings back the Bulk approve button: focus returns to it.
  useEffect(() => {
    if (!restoreBulk.current) return
    restoreBulk.current = false
    bulkButton.current?.focus()
  })

  // Prefill location from browser geolocation on mount.
  // Does NOT clobber a manual label edit — the prev.label guard is intentional.
  useEffect(() => {
    void resolveGeoLabel().then((geo) => {
      if (!geo) return
      setNearLocation((prev) => prev.label ? prev : { label: geo.label, lat: geo.lat, lng: geo.lng })
    })
  }, [])

  // Fly to first resource with coords whenever pending loads or filter changes
  useEffect(() => {
    if (view !== 'map') return
    const first = pending.find(
      (p) => (filter === 'all' || p.discovery_metadata?.content_type === filter)
        && p.lat != null && p.lng != null
    )
    if (first && first.lat != null && first.lng != null) {
      mapRef.current?.flyTo({ center: [first.lng, first.lat], zoom: 10, duration: 800 })
    }
  }, [pending, filter, view])

  // ── Discovery ───────────────────────────────────────────────

  const handleDiscover = useCallback(async () => {
    const q = query.trim()
    if (!q) return

    setDiscovering(true)
    setDiscoverError(null)
    setDiscoverSummary(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 35_000)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw Object.assign(new Error('no session'), { code: 'no_session' })

      const opId = crypto.randomUUID().slice(0, 8)
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resource-discover`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          'x-request-id': opId,
        },
        body: JSON.stringify({
          query: q,
          nearLocation: nearLocation.label.trim()
            ? { label: nearLocation.label.trim(), lat: nearLocation.lat, lng: nearLocation.lng }
            : undefined,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        // The edge function's reply text is neither shown nor logged (it can quote the query).
        throw Object.assign(new Error('discovery http'), { code: 'http', status: response.status })
      }

      const result = await response.json() as {
        staged?: { resources?: number; forms?: number }
        rejected?: number
        deduped?: number
      }

      const total = (result.staged?.resources ?? 0) + (result.staged?.forms ?? 0)
      const staged = moderationCount(STAGED_CANDIDATES, total, locale)
      setDiscoverSummary(
        result.rejected != null
          ? formatMessage(adminResourcesT(locale, 'discoverSummary'), {
              staged,
              rejected: moderationCount(REJECTED_BY_FILTER, result.rejected, locale),
            })
          : staged,
      )

      // Reload the pending queue to include newly staged items
      await loadPending()
      setDiscoveryJustCompleted(true)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Treat abort as a soft outcome — the edge function may still be running
        setDiscoverSummary(adminResourcesT(locale, 'discoverTimeout'))
        await loadPending()
      } else {
        const status = (err as { status?: unknown } | null)?.status
        logger.warn('admin.resource.discover_failed', {
          code: failureCode(err),
          ...(typeof status === 'number' ? { status } : {}),
        })
        setDiscoverError(adminResourcesT(locale, 'discoverFailed'))
      }
    } finally {
      clearTimeout(timeout)
      setDiscovering(false)
    }
  }, [query, nearLocation, supabase, loadPending, locale])

  // Auto-switch to map view after discovery if mappable results exist.
  // Double-flyTo prevention: when view is 'list' → setView('map') alone is enough
  // because the existing [pending, filter, view] effect fires on the view change and
  // does the flyTo.  Only call flyTo directly here when view is already 'map' (the
  // view dependency in that effect won't fire again).
  useEffect(() => {
    if (!discoveryJustCompleted) return
    setDiscoveryJustCompleted(false)
    const mappable = pending.filter((p) => p.lat != null && p.lng != null)
    if (mappable.length === 0) return
    if (view === 'map') {
      // Already on map — existing flyTo effect won't re-fire; do it directly.
      setTimeout(() => {
        if (nearLocation.lat != null && nearLocation.lng != null) {
          mapRef.current?.flyTo({ center: [nearLocation.lng, nearLocation.lat], zoom: 9, duration: 800 })
        } else {
          const first = mappable[0]
          mapRef.current?.flyTo({ center: [first.lng!, first.lat!], zoom: 10, duration: 800 })
        }
      }, 200)
    } else {
      // Switching list→map: the [pending, filter, view] effect will fire on the view
      // change and handle the flyTo — no second flyTo needed here.
      setView('map')
    }
  }, [discoveryJustCompleted, pending, nearLocation, view, mapRef])

  // ── Approve / Reject ────────────────────────────────────────
  //
  // Two approve paths, by content type:
  // - 'form' items have no resource fields to edit (they are form-template
  //   rows), so they keep the original one-click approve via handleApprove
  //   below — this call is NOT dead code, it is still the only approve path
  //   for forms and is also reused by "Bulk approve high-confidence" (which
  //   is unchanged by this wave and must stay one-click for all content types).
  // - 'resource' / 'link' items now go through the edit-then-confirm dialog
  //   (INV D): clicking "Approve" opens <ResourceEditDialog mode="approve">
  //   via setApproveTarget below; the dialog persists edits via
  //   admin_update_resource FIRST, then calls handleConfirmApprove exactly
  //   once, which is the sole caller of approve_resource for this path.

  const handleApprove = useCallback(async (item: PendingItem, opts: { announce?: boolean } = {}): Promise<boolean> => {
    setProcessingId(item.id)
    try {
      const contentType = item.discovery_metadata?.content_type ?? 'resource'

      if (contentType === 'form') {
        const { error } = await privilegedRpc(
          supabase,
          'admin.form_template.approve',
          'approve_form_template',
          { p_id: item.id },
          { action: 'form_template.approve', target_id: item.id },
        )
        if (error) throw error
      } else {
        const { error } = await privilegedRpc(
          supabase,
          'admin.resource.approve',
          'approve_resource',
          { p_resource_id: item.id, p_reason: 'Admin approved from discovery queue' },
          { action: 'resource.approve', target_id: item.id },
        )
        if (error) throw error
      }

      if (opts.announce !== false) {
        focusTarget.current = { id: focusAfterRowRemoval(visibleIdsRef.current, item.id) }
        announce(setStatus, formatMessage(adminResourcesT(locale, 'approvedStatus'), { name: isolate(item.name) }))
      }
      setPending((prev) => prev.filter((p) => p.id !== item.id))
      return true
    } catch (err) {
      // W2: every approve failure reaches logger.error → app_logs (was console-only).
      logger.error('admin.resource.approve', err, {
        resource_id: item.id,
        content_type: item.discovery_metadata?.content_type ?? 'resource',
        outcome: 'error',
      })
      // Surface the failure in the UI instead of silently leaving the item in the queue (in the
      // admin's language: the server's message is never shown).
      setQueueError(formatMessage(adminResourcesT(locale, 'approveFailed'), { name: isolate(item.name) }))
      return false
    } finally {
      setProcessingId(null)
    }
  }, [supabase, locale])

  // Called by <ResourceEditDialog mode="approve"> AFTER admin_update_resource
  // has persisted the edited fields. Guarded against double-fire by the
  // dialog's own `saving` state (the Confirm button disables while in flight).
  const handleConfirmApprove = useCallback(async (resourceId: string) => {
    // Routed through privilegedRpc: one request id sent as x-request-id, shared with the withMetric
    // wide-event and the durable admin_actions row. Re-throws on failure so the dialog surfaces it.
    const { error } = await privilegedRpc(
      supabase,
      'admin.resource.approve',
      'approve_resource',
      { p_resource_id: resourceId, p_reason: 'Admin approved from discovery queue' },
      { action: 'resource.approve', target_id: resourceId },
    )
    if (error) throw error
  }, [supabase])

  // Called once both admin_update_resource and approve_resource succeed —
  // the item is no longer pending, so remove it from the queue and close.
  // The announcement and the focus move wait until the dialog has fully closed (onCloseAutoFocus):
  // while it is open the rest of the page is aria-hidden.
  const handleApproveDialogSaved = useCallback((row: ResourceEditDialogSavedRow) => {
    dialogDone.current = {
      text: formatMessage(adminResourcesT(locale, 'approvedStatus'), { name: isolate(row.name) }),
      focus: focusAfterRowRemoval(visibleIdsRef.current, row.id),
    }
    setPending((prev) => prev.filter((p) => p.id !== row.id))
    setApproveTarget(null)
  }, [locale])

  const handleApproveDialogClosed = useCallback((event: Event) => {
    const done = dialogDone.current
    if (!done) return // Cancel: Radix returns focus to the card's Approve button, which is still there.
    dialogDone.current = null
    event.preventDefault()
    announce(setStatus, done.text)
    const node = done.focus ? chevrons.current.get(done.focus) : null
    ;(node ?? queueHeading.current)?.focus()
  }, [])

  const handleReject = useCallback(async (item: PendingItem) => {
    setProcessingId(item.id)
    try {
      const { error } = await privilegedRpc(
        supabase,
        'admin.resource.reject',
        'reject_resource',
        { p_resource_id: item.id, p_reason: 'Admin rejected from discovery queue' },
        { action: 'resource.reject', target_id: item.id },
      )
      if (error) throw error
      focusTarget.current = { id: focusAfterRowRemoval(visibleIdsRef.current, item.id) }
      announce(setStatus, formatMessage(adminResourcesT(locale, 'rejectedStatus'), { name: isolate(item.name) }))
      setPending((prev) => prev.filter((p) => p.id !== item.id))
    } catch (err) {
      // W2: reject failures reach logger.error → app_logs (was console-only).
      logger.error('admin.resource.reject', err, { resource_id: item.id, outcome: 'error' })
      // Surface the failure in the UI instead of silently leaving the item in the queue.
      setQueueError(formatMessage(adminResourcesT(locale, 'rejectFailed'), { name: isolate(item.name) }))
    } finally {
      setProcessingId(null)
    }
  }, [supabase, locale])

  // ── Bulk approve high-confidence ────────────────────────────

  // Bulk approve operates on high-confidence items. Form-template rows are Platform-Admin only, so
  // a non-PA (Resource Admin) never bulk-approves them — they are excluded from the set entirely.
  const highConfidenceItems = pending.filter(
    (p) => p.discovery_metadata?.confidence === 'high' && (isPA || p.discovery_metadata?.content_type !== 'form')
  )

  const handleBulkApprove = useCallback(async () => {
    // The confirmation (and the focused Confirm button) leaves now: continue from the queue heading.
    queueHeading.current?.focus()
    setBulkConfirm(false)
    setBulkRunning(true)
    const items = pending.filter(
      (p) => p.discovery_metadata?.confidence === 'high' && (isPA || p.discovery_metadata?.content_type !== 'form')
    )
    let approved = 0
    for (const item of items) {
      if (await handleApprove(item, { announce: false })) approved++
    }
    announce(setStatus, moderationCount(BULK_DONE, approved, locale))
    setBulkRunning(false)
  }, [pending, handleApprove, isPA, locale])

  // ── Filtered list ───────────────────────────────────────────

  const filtered = filter === 'all'
    ? pending
    : pending.filter((p) => p.discovery_metadata?.content_type === filter)

  const mappable = filtered.filter((p) => p.lat != null && p.lng != null)
  visibleIdsRef.current = filtered.map((p) => p.id)

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  const nearId = 'resources-discover-near'
  const queryId = 'resources-discover-query'
  const busyGuard = (busy: boolean, run: () => void) => () => {
    if (!busy) run()
  }

  return (
    <div className="space-y-4" lang={locale} dir={dir(locale)}>

      {/* ── Discovery input (platform admin only — paid external spend) ── */}
      {isPA && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('discoverTitle')}</CardTitle>
          <CardDescription className="text-stone-600">{t('discoverIntro')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Location bias input */}
          <div className="flex flex-wrap gap-2 items-center">
            <label htmlFor={nearId} className="text-xs text-stone-600 shrink-0">{t('nearLabel')}</label>
            <Input
              id={nearId}
              placeholder={t('nearPlaceholder')}
              value={nearLocation.label}
              onChange={(e) => setNearLocation({ label: e.target.value, lat: null, lng: null })}
              readOnly={discovering}
              className="min-w-0 flex-1 basis-48 text-stone-900 placeholder:text-stone-500 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (discovering) return
                // Explicitly overwrites — no prev.label guard (unlike the mount effect)
                void resolveGeoLabel().then((geo) => {
                  if (!geo) return
                  setNearLocation({ label: geo.label, lat: geo.lat, lng: geo.lng })
                })
              }}
              aria-disabled={discovering || undefined}
              className={`min-h-6 rounded-sm text-xs text-lime-800 hover:text-lime-900 hover:underline shrink-0 ${FOCUS_RING}`}
            >
              {t('useMyLocation')}
            </button>
          </div>
          <div className="space-y-1">
            <label htmlFor={queryId} className="text-xs text-stone-600">
              {t('queryLabel')} <span className="text-stone-600">({t('required')})</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Input
                id={queryId}
                required
                aria-required="true"
                placeholder={t('queryPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !discovering) void handleDiscover() }}
                readOnly={discovering}
                className="min-w-0 flex-1 basis-56 text-stone-900 placeholder:text-stone-500"
              />
              {/* aria-disabled + guard (not disabled): the pressed button keeps focus while Discover
                  runs (its label says so); with no query it is a solid grey. readOnly boxes keep focus too. */}
              <Button
                data-testid="resources-discover"
                onClick={() => { if (!discovering && query.trim()) void handleDiscover() }}
                aria-disabled={discovering || !query.trim() || undefined}
                className={
                  !query.trim() && !discovering
                    ? 'bg-stone-200 text-stone-700 hover:bg-stone-200 shrink-0'
                    : 'bg-lime-700 hover:bg-lime-800 text-white shrink-0'
                }
              >
                {discovering ? (
                  <><Loader2 className="h-4 w-4 me-2 animate-spin" aria-hidden="true" />{t('discovering')}</>
                ) : (
                  <><Search className="h-4 w-4 me-2" aria-hidden="true" />{t('discover')}</>
                )}
              </Button>
            </div>
          </div>

          <DiscoverProgress active={discovering} durationMs={30000} labels={progressLabels} />

          {/* Always mounted, so each result is announced when its text arrives. */}
          <p role="status" className={discoverSummary ? 'text-sm text-green-800 flex items-center gap-1.5' : 'sr-only'}>
            {discoverSummary && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {discoverSummary ?? ''}
          </p>
          <p role="alert" className={discoverError ? 'text-sm text-red-700 flex items-center gap-1.5' : 'sr-only'}>
            {discoverError && <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {discoverError ?? ''}
          </p>
        </CardContent>
      </Card>
      )}

      {/* ── Queue header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2
            ref={queueHeading}
            tabIndex={-1}
            className={`rounded-sm text-sm font-medium text-stone-700 ${FOCUS_RING}`}
          >
            {queueLoading ? t('pendingTitle') : formatMessage(t('pendingTitleCount'), { count: formatCount(filtered.length, locale) })}
          </h2>

          {/* Filter chips (the value stays the content-type id) */}
          <div role="group" aria-label={t('filterLabel')} className="flex flex-wrap gap-2">
            {(['all', 'resource', 'link', 'form'] as ContentFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-6 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${FOCUS_RING} ${
                  filter === f
                    ? 'bg-lime-700 text-white border-lime-700'
                    : 'bg-white text-stone-700 border-stone-500 hover:border-lime-700'
                }`}
              >
                {f === 'all' ? t('filterAll') : contentTypeLabel(f, locale)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div role="group" aria-label={t('viewLabel')} className="flex rounded-lg border border-stone-500 overflow-hidden">
            <button
              type="button"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${FOCUS_RING} ${
                view === 'list' ? 'bg-stone-100 text-stone-800' : 'bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              {t('viewList')}
            </button>
            <button
              type="button"
              aria-pressed={view === 'map'}
              onClick={() => setView('map')}
              className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors border-s border-stone-500 ${FOCUS_RING} ${
                view === 'map' ? 'bg-stone-100 text-stone-800' : 'bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {t('viewMap')}
            </button>
          </div>

          {/* Bulk approve */}
          {highConfidenceItems.length > 0 && (
            <>
              {bulkConfirm ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span id="resources-bulk-question" className="text-xs text-stone-700">
                    {moderationCount(BULK_CONFIRM, highConfidenceItems.length, locale)}
                  </span>
                  <Button
                    ref={bulkConfirmButton}
                    size="sm"
                    className="bg-green-700 hover:bg-green-800 text-white h-7 text-xs"
                    aria-describedby="resources-bulk-question"
                    onClick={() => { if (!bulkRunning) void handleBulkApprove() }}
                    aria-disabled={bulkRunning || undefined}
                  >
                    {bulkRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : t('confirm')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-stone-500 text-xs"
                    onClick={() => {
                      restoreBulk.current = true
                      setBulkConfirm(false)
                    }}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              ) : (
                <Button
                  ref={bulkButton}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-green-700 text-green-800 hover:bg-green-50"
                  onClick={busyGuard(bulkRunning, () => {
                    focusBulkConfirm.current = true
                    setBulkConfirm(true)
                  })}
                  aria-disabled={bulkRunning || undefined}
                >
                  <Check className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                  {formatMessage(t('bulkApprove'), { count: formatCount(highConfidenceItems.length, locale) })}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Approve / reject results (always mounted: each one is announced) ── */}
      <p role="status" data-testid="resources-queue-status" className="sr-only"><AnnouncementText announcement={status} /></p>

      {/* ── Queue error (always mounted: announced when it appears) ── */}
      <div
        role="alert"
        data-testid="resources-queue-alert"
        className={queueError ? 'rounded-lg border border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800 flex flex-wrap items-center gap-2' : 'sr-only'}
      >
        {queueError && <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {queueError ?? ''}
        {queueError && (
          <Button
            variant="outline"
            size="sm"
            className="ms-auto h-6 border-stone-500 text-xs"
            onClick={() => {
              // The line (and this button) leaves as the reload starts: continue from the heading.
              queueHeading.current?.focus()
              void loadPending()
            }}
          >
            {t('tryAgain')}
          </Button>
        )}
      </div>

      {/* ── Map view ── */}
      {view === 'map' && (
        <div className="rounded-xl overflow-hidden border border-stone-200 h-96">
          {queueLoading ? (
            <div className="h-full flex items-center justify-center bg-stone-50">
              <Loader2 className="h-6 w-6 animate-spin text-stone-500" aria-hidden="true" />
            </div>
          ) : (
            <MapView ref={mapRef} className="h-full w-full">
              {mappable.map((item) => (
                <ResourceMarker
                  key={item.id}
                  resource={toMarkerResource(item)}
                  locale={locale}
                />
              ))}
            </MapView>
          )}
        </div>
      )}

      {/* ── List view ── */}
      {queueLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-stone-500" aria-hidden="true" />
          <span className="sr-only">{t('loading')}</span>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-10 w-10 mx-auto text-green-700 mb-3" aria-hidden="true" />
            <p className="text-stone-700 font-medium">{t('emptyTitle')}</p>
            <p className="text-sm text-stone-600 mt-1">{t('emptyBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const meta = item.discovery_metadata
            const contentType = meta?.content_type ?? 'resource'
            const isExpanded = expandedId === item.id
            const isProcessing = processingId === item.id
            const busy = isProcessing || bulkRunning
            const sourceUrl = meta?.source_url ?? item.website ?? null

            return (
              <Card key={item.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Content type + confidence */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                          {contentTypeLabel(contentType, locale)}
                        </span>
                        {meta && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${confidenceClass(meta.confidence)}`}>
                            {t(meta.confidence === 'high' ? 'confidenceHigh' : 'confidenceMedium')}
                          </span>
                        )}
                        {/* W1: 'location error' badge — off the map, still listed/findable. */}
                        {needsLocation(item.geocode_accuracy) && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-amber-700 bg-amber-50 text-amber-800 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" aria-hidden="true" /> {t('needsLocation')}
                          </span>
                        )}
                      </div>

                      <CardTitle className="text-sm leading-snug line-clamp-2">
                        <span lang="" dir="auto">{item.name}</span>
                      </CardTitle>
                    </div>

                    <button
                      type="button"
                      ref={(node) => {
                        if (node) chevrons.current.set(item.id, node)
                        else chevrons.current.delete(item.id)
                      }}
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className={`inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-sm text-stone-600 hover:text-stone-800 transition-colors ${FOCUS_RING}`}
                      aria-label={t('itemDetails')}
                      aria-expanded={isExpanded}
                      aria-controls={detailsId(item.id)}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col gap-2 pt-0">
                  {/* Provenance chip */}
                  {meta && (
                    <div className="flex items-center gap-1 text-xs text-stone-600">
                      <Globe className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {provenanceLabel(meta, locale)}
                    </div>
                  )}

                  {/* Address */}
                  {(item.city ?? item.address) && (
                    <div className="flex items-center gap-1 text-xs text-stone-600">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span lang="" dir="auto">{[item.address, item.city, item.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}

                  {/* Awaiting review: members cannot see it yet (admin_list_pending_resources lists
                      pending items), so this shows the reason, never a link. A form template never
                      has a member resource page. */}
                  <MemberViewLink
                    to={{ kind: 'resource', id: item.id }}
                    visibility={contentType === 'form' ? { visible: false, reason: 'not_approved' } : resourceVisibility(item)}
                    label={orgFormT(locale, 'actionViewPublic')}
                    locale={locale}
                    itemName={item.name}
                    source="resources_queue"
                  />

                  {/* Expanded detail */}
                  <div id={detailsId(item.id)} hidden={!isExpanded} className="space-y-1.5 text-xs text-stone-700 pt-1 border-t border-stone-100">
                    {isExpanded && (
                      <>
                        {item.description && (
                          <p lang="" dir="auto" className="line-clamp-4">{item.description}</p>
                        )}
                        {item.phone && <p>{formatMessage(t('phoneLine'), { phone: isolate(item.phone) })}</p>}
                        {item.category && (
                          <p>{formatMessage(t('categoryLine'), { category: resourceCategoryLabel(item.category, locale) })}</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Source URL */}
                  {sourceUrl && (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      className="text-xs text-lime-800 hover:underline flex items-center gap-1 truncate mt-auto"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{sourceUrl}</span>
                    </a>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100 mt-auto">
                    {/* Form-template approval stays platform-admin only (P3.1). A Resource Admin
                        sees the form item but not the approve control. While an action runs the
                        buttons are aria-disabled (not disabled), so the focused one keeps focus. */}
                    {(contentType !== 'form' || isPA) ? (
                    <Button
                      size="sm"
                      className="flex-1 bg-green-700 hover:bg-green-800 text-white h-7 text-xs"
                      onClick={busyGuard(busy, () => {
                        // Forms have no resource fields to edit — keep the
                        // one-click approve_form_template path. resource/link
                        // items open the edit-then-confirm dialog (INV D).
                        if (contentType === 'form') { void handleApprove(item) } else { setApproveTarget(item) }
                      })}
                      aria-disabled={busy || undefined}
                      aria-label={namedControl(t('approve'), item.name)}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                      )}
                      {t('approve')}
                    </Button>
                    ) : (
                      <span className="flex-1 text-xs text-stone-600 self-center">{t('paRequired')}</span>
                    )}
                    {contentType !== 'form' && (
                      <Button
                        size="sm"
                        className={`flex-1 h-7 text-xs ${DESTRUCTIVE_BUTTON_CLASS}`}
                        onClick={busyGuard(busy, () => void handleReject(item))}
                        aria-disabled={busy || undefined}
                        aria-label={namedControl(t('reject'), item.name)}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <X className="h-3.5 w-3.5 me-1" aria-hidden="true" />
                        )}
                        {t('reject')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Edit-then-confirm approve dialog (shared with Manage tab — INV D) ── */}
      <ResourceEditDialog
        open={approveTarget !== null}
        resource={approveTarget ? toDialogInputFromPendingRow(approveTarget) : null}
        mode="approve"
        locale={locale}
        onOpenChange={(open) => { if (!open) setApproveTarget(null) }}
        onSaved={handleApproveDialogSaved}
        onConfirm={handleConfirmApprove}
        onCloseAutoFocus={handleApproveDialogClosed}
      />
    </div>
  )
}
