'use client'

// apps/web/src/app/(admin)/moderation/manage-resources-tab.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Manage tab: approved resources, filtered and paged, each editable in the shared dialog.
// P6 W4: the admin's language throughout (lib/i18n-admin-resources.ts); resource names,
// descriptions and addresses keep their own (lang="" dir="auto"). A failed read shows a translated
// line and writes one admin.resource.list_failed row with its code. A save is announced in an
// always-mounted status line once the dialog has fully closed; buttons that are busy are
// aria-disabled so they keep focus, and a control that leaves hands focus to the list heading.

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Search, Loader2, MapPin, AlertCircle, Pencil, CheckCircle2,
  Map as MapIcon, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { logEvent, logger } from '@/lib/logger'
import { MemberViewLink } from '@/components/admin/member-view-link'
import { resourceMapVisibility, resourceVisibility } from '@/lib/member-visibility'
import { adminNavT } from '@/lib/i18n-admin-nav'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, isolate } from '@/lib/format-message'
import { failureCode } from '@/lib/failure-code'
import { formatCount } from '@/lib/i18n-intl'
import { orgFormT } from '@/lib/i18n-org-forms'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import { adminResourcesT, namedControl } from '@/lib/i18n-admin-resources'
import { AnnouncementText, NO_ANNOUNCEMENT, afterLayout, announce, type Announcement } from './row-focus'
import { US_STATES, STATE_TO_ABBR, normalizeState } from '@/lib/us-states'
import { needsLocation } from '@/lib/geocode-accuracy'
import { MapView, type MapViewHandle } from '@/components/map/map-view'
import { ResourceMarker } from '@/components/map/resource-marker'
import type { Resource as ResourceMarkerResource } from '@/components/map/resource-marker'
import {
  ResourceEditDialog,
  type ResourceEditDialogInput,
  type ResourceEditDialogSavedRow,
} from './resource-edit-dialog'
import { readFocusResource, type ManageResourceRow } from './resource-focus-read'
import { useAdminFocusSession } from './use-admin-focus'
import { AdminFocusNoticeLine, type AdminFocusNotice } from './admin-focus-notice'
import { RESOURCE_EDIT_BUTTON_ATTR, restoreFocusAfterResourceEdit } from './admin-focus-return'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ResourceRow = ManageResourceRow

// Normalizes a manage-list row into the shape <ResourceEditDialog> expects.
function toDialogInputFromManageRow(r: ResourceRow): ResourceEditDialogInput {
  return {
    id: r.id,
    name: r.name ?? '',
    description: r.description ?? '',
    category: r.category ?? 'other',
    address_line1: r.address_line1 ?? '',
    city: r.city ?? '',
    state: r.state ?? '',
    zip_code: r.zip_code ?? '',
    phone: r.phone ?? '',
    email: r.email ?? '',
    website: r.website ?? '',
    status: r.status ?? 'approved',
    service_mode: r.service_mode ?? 'physical',
    lat: r.lat,
    lng: r.lng,
    geocode_accuracy: r.geocode_accuracy,
  }
}

// Maps a manage-list row into the shape <ResourceMarker> expects. Only ever
// called on rows that have already passed the `mappable` filter (INV A) —
// non-null lat/lng guaranteed by that filter, not re-checked here.
function toMarkerResource(r: ResourceRow): ResourceMarkerResource {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    address_line1: r.address_line1,
    city: r.city,
    state: r.state,
    phone: r.phone,
    website: r.website,
    latitude: r.lat!,
    longitude: r.lng!,
  }
}

// Picks a flyTo zoom level from the lat/lng degree-span of a marker set —
// MapViewHandle exposes flyTo(center, zoom) only (no fitBounds/getMap), so the
// viewport-fit approximates a bounding-box fit by choosing a tighter zoom for
// a tighter spread. Capped at 12 to mirror the padding used by a true
// map.fitBounds() call, in case MapViewHandle later exposes one.
function zoomForSpan(span: number): number {
  if (span < 0.01) return 12
  if (span < 0.05) return 11
  if (span < 0.1) return 10
  if (span < 0.5) return 9
  if (span < 1) return 8
  if (span < 2) return 7
  if (span < 5) return 6
  if (span < 10) return 5
  if (span < 20) return 4
  return 3
}

const PAGE_SIZE = 100

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

const SELECT_CLASS =
  'w-full text-sm border border-stone-500 rounded-lg px-3 py-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-700'
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-1'

export function ManageResourcesTab({ locale }: { locale: Locale }) {
  const supabase = createClient()
  const t = (key: Parameters<typeof adminResourcesT>[1]) => adminResourcesT(locale, key)
  // The list heading: where focus goes when the control that had it leaves (Retry, Load more).
  const listHeading = useRef<HTMLHeadingElement | null>(null)
  // A saved edit, announced once the dialog has fully closed (the page behind it is aria-hidden).
  const [status, setStatus] = useState<Announcement>(NO_ANNOUNCEMENT)
  const savedAnnouncement = useRef<string | null>(null)
  // After Load more brings the last page, the button leaves: focus the first new row's Edit button.
  const focusRowId = useRef<string | null | undefined>(undefined)
  const mapRef = useRef<MapViewHandle>(null)

  // Filters
  const [stateFilter, setStateFilter] = useState('')   // full state name from dropdown
  const [cityFilter, setCityFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Map panel — collapsed by default (INV B); mounts MapView only when expanded.
  const [mapExpanded, setMapExpanded] = useState(false)

  // List
  const [rows, setRows] = useState<ResourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit dialog
  const [editing, setEditing] = useState<ResourceRow | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  // ── Load list ───────────────────────────────────────────────
  const loadResources = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_list_resources', {
        p_state: normalizeState(stateFilter) || undefined,
        p_city: cityFilter.trim() || undefined,
        p_search: searchInput.trim() || undefined,
        p_status: 'approved',
        p_limit: PAGE_SIZE,
        p_offset: 0,
      })
      if (rpcError) throw rpcError
      const list = (data ?? []) as ResourceRow[]
      setRows(list)
      setHasMore(list.length === PAGE_SIZE)
      logger.info('admin.resource.list', {
        count: list.length,
        state: normalizeState(stateFilter) ?? null,
        city: cityFilter.trim() || null,
        search: searchInput.trim() || null,
      })
    } catch (err) {
      // No other row records this read: one row with its code, never the message.
      logger.warn('admin.resource.list_failed', { code: failureCode(err), page: 'first' })
      setError(adminResourcesT(locale, 'listLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [supabase, stateFilter, cityFilter, searchInput, locale])

  // ── Load next page ───────────────────────────────────────────
  // Appends the next PAGE_SIZE rows using the current filters, offset by the
  // number of rows already shown. admin_list_resources takes p_limit/p_offset.
  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_list_resources', {
        p_state: normalizeState(stateFilter) || undefined,
        p_city: cityFilter.trim() || undefined,
        p_search: searchInput.trim() || undefined,
        p_status: 'approved',
        p_limit: PAGE_SIZE,
        p_offset: rows.length,
      })
      if (rpcError) throw rpcError
      const list = (data ?? []) as ResourceRow[]
      setRows((prev) => [...prev, ...list])
      setHasMore(list.length === PAGE_SIZE)
      // The last page: Load more leaves, so focus moves on (the first new row, else the heading).
      if (list.length !== PAGE_SIZE) focusRowId.current = list[0]?.id ?? null
      logger.info('admin.resource.list.more', {
        added: list.length,
        offset: rows.length,
      })
    } catch (err) {
      logger.warn('admin.resource.list_failed', { code: failureCode(err), page: 'more' })
      setError(adminResourcesT(locale, 'moreLoadFailed'))
    } finally {
      setLoadingMore(false)
    }
  }, [supabase, stateFilter, cityFilter, searchInput, rows.length, locale])

  useEffect(() => {
    const target = focusRowId.current
    if (target === undefined) return
    focusRowId.current = undefined
    afterLayout(() => {
      const node = target ? document.querySelector<HTMLElement>(`[${RESOURCE_EDIT_BUTTON_ATTR}="${target}"]`) : null
      ;(node ?? listHeading.current)?.focus()
    })
  }, [rows])

  // Initial load only — subsequent loads are triggered explicitly via Apply/Enter
  // so typing in the city/search boxes does not fire a query on every keystroke.
  useEffect(() => {
    void loadResources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Edit ────────────────────────────────────────────────────
  // The resource the dialog last opened: where focus returns when it closes (see onCloseAutoFocus).
  const editedIdRef = useRef<string | null>(null)
  const openEdit = useCallback((r: ResourceRow) => {
    editedIdRef.current = r.id
    setEditing(r)
  }, [])

  const closeEdit = useCallback(() => {
    setEditing(null)
  }, [])

  // "Edit in admin" (?tab=manage&focus=resource:<uuid>): this tab claims the focus
  // (useAdminFocusSession, admin-focus-session.ts), reads the resource by id — it is usually not on
  // the first page of 100 — and opens it in the edit dialog; the list, its filters and paging are
  // untouched. The tab writes found / not_found (or abandoned when it unmounts first), then focus is
  // stripped; invalid / forbidden are the shell's gate (useAdminFocusGate). This tab mounts only for
  // tiers that may edit resources (resource admin and up).
  const focusSession = useAdminFocusSession('resource', 'manage')
  const [focusNotice, setFocusNotice] = useState<AdminFocusNotice | null>(null)
  useEffect(() => {
    if (!focusSession?.isOpen()) return
    let active = true
    const read = new AbortController()
    void readFocusResource(supabase, focusSession.focus.id, read.signal).then((row) => {
      // An unmount (or React's development re-run) leaves the answer to the next run / abandoned.
      if (!active || !focusSession.isOpen()) return
      if (row) {
        focusSession.resolve('found')
        openEdit(row)
      } else {
        focusSession.resolve('not_found')
        setFocusNotice('not_found')
      }
    })
    return () => {
      active = false
      read.abort()
    }
  }, [focusSession, supabase, openEdit])

  // <ResourceEditDialog> owns the admin_update_resource RPC call, geocoding, and
  // structured logging (INV A/B/C/E). This just merges the saved row back into
  // the list and shows the "Saved" indicator — zero field regression from the
  // pre-extraction inline modal (every field it saved still saves identically).
  const handleDialogSaved = useCallback((row: ResourceEditDialogSavedRow) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)))
    setSavedId(row.id)
    setTimeout(() => setSavedId(null), 2500)
    savedAnnouncement.current = formatMessage(adminResourcesT(locale, 'savedStatus'), { name: isolate(row.name) })
    setEditing(null)
  }, [locale])

  // ── Map (INV A/C) ───────────────────────────────────────────
  // Derived directly from `rows` — the same filtered list the cards render
  // (INV C) — so state/city/search filters change the map's markers too.
  // Online resources are never plotted even when they carry coordinates
  // (INV A): a food-bank PDF list geocoded to an org's mailing address is not
  // a physical location an admin should be sent to.
  // Memoized so identity only changes when `rows` itself changes (a filter
  // apply or a load) — not on every unrelated re-render (dialog open/close,
  // savedId timeout, etc). The fit-viewport effect below depends on this
  // identity to avoid fighting the admin's manual pan/zoom.
  const mappable = useMemo(
    () => rows.filter((r) => r.lat != null && r.lng != null && r.service_mode !== 'online'),
    [rows]
  )
  const onlineExcludedCount = rows.filter(
    (r) => r.lat != null && r.lng != null && r.service_mode === 'online'
  ).length

  // Structured log on expand — counts only, no PII (INV E).
  useEffect(() => {
    if (!mapExpanded) return
    logger.info('admin.resource.map.expand', {
      total: rows.length,
      mappable: mappable.length,
      online_excluded: onlineExcludedCount,
    })
    // Re-logs when the toggle re-opens after a filter change; intentionally
    // excludes mappable/onlineExcludedCount from deps to avoid re-firing on
    // every row mutation while already expanded (e.g. after an edit save).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapExpanded, rows])

  // Fit the viewport to the current markers so the map "shows the locations
  // of the resources" on first paint instead of opening at the default
  // US-center/zoom-4 view. Runs when the map expands (MapView mounts fresh —
  // mapRef.current is guaranteed set by commit time) and whenever the
  // mappable set changes identity while already expanded (a filter narrows
  // results to a state/city). Deliberately does NOT depend on anything else,
  // so an unrelated re-render never fights the admin's manual pan/zoom.
  useEffect(() => {
    if (!mapExpanded || mappable.length === 0) return
    const map = mapRef.current
    if (!map) return

    if (mappable.length === 1) {
      const only = mappable[0]
      if (only.lat != null && only.lng != null) {
        map.flyTo({ center: [only.lng, only.lat], zoom: 11 })
      }
      return
    }

    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
    for (const r of mappable) {
      if (r.lat == null || r.lng == null) continue
      minLat = Math.min(minLat, r.lat)
      maxLat = Math.max(maxLat, r.lat)
      minLng = Math.min(minLng, r.lng)
      maxLng = Math.max(maxLng, r.lng)
    }
    const centerLat = (minLat + maxLat) / 2
    const centerLng = (minLng + maxLng) / 2
    const span = Math.max(maxLat - minLat, maxLng - minLng)
    map.flyTo({ center: [centerLng, centerLat], zoom: zoomForSpan(span) })
  }, [mapExpanded, mappable])

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  const stateId = 'manage-filter-state'
  const cityId = 'manage-filter-city'
  const searchId = 'manage-filter-search'

  return (
    <div className="space-y-4" lang={locale} dir={dir(locale)}>
      {/* ── Filters ── */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor={stateId} className="text-xs text-stone-600">{t('fieldState')}</Label>
              <select
                id={stateId}
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">{t('stateAll')}</option>
                {/* State names are proper nouns (lib/us-states.ts); the value is the full name. */}
                {US_STATES.map((st) => (
                  <option key={st} value={st} lang="en">{st} ({STATE_TO_ABBR[st]})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={cityId} className="text-xs text-stone-600">{t('fieldCity')}</Label>
              <Input
                id={cityId}
                placeholder={t('cityPlaceholder')}
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !loading) void loadResources() }}
                dir="auto"
                className="text-stone-900 placeholder:text-stone-500 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={searchId} className="text-xs text-stone-600">{t('searchLabel')}</Label>
              <Input
                id={searchId}
                placeholder={t('searchPlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !loading) void loadResources() }}
                dir="auto"
                className="text-stone-900 placeholder:text-stone-500 text-sm"
              />
            </div>
            <div className="flex items-end">
              {/* aria-disabled while loading (not disabled): the pressed button keeps focus. */}
              <Button
                onClick={() => { if (!loading) void loadResources() }}
                aria-disabled={loading || undefined}
                className="w-full bg-lime-700 hover:bg-lime-800 text-white"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 me-2 animate-spin" aria-hidden="true" />{t('loading')}</>
                ) : (
                  <><Search className="h-4 w-4 me-2" aria-hidden="true" />{t('applyFilters')}</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 ref={listHeading} tabIndex={-1} className={`rounded-sm text-sm font-medium text-stone-700 ${FOCUS_RING}`}>
          {t('approvedTitle')}
          {!loading && ` ${formatMessage(t('showing'), { count: formatCount(rows.length, locale) })}${hasMore ? ` ${t('moreAvailable')}` : ''}`}
        </h2>
        <button
          type="button"
          onClick={() => setMapExpanded((prev) => !prev)}
          className={`flex min-h-6 items-center gap-1.5 rounded-sm text-xs font-medium text-lime-800 hover:text-lime-900 transition-colors ${FOCUS_RING}`}
          aria-expanded={mapExpanded}
        >
          <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {mapExpanded ? t('hideMap') : t('showMap')}
          {mapExpanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </div>

      {/* ── Map (collapsible; toggling never disturbs the list or its filters — INV B/D) ── */}
      {mapExpanded && (
        <div className="rounded-xl overflow-hidden border border-stone-200 h-96 bg-stone-50">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-stone-500" aria-hidden="true" />
            </div>
          ) : (
            <MapView ref={mapRef} className="h-full w-full">
              {mappable.map((r) => (
                <ResourceMarker key={r.id} resource={toMarkerResource(r)} locale={locale} />
              ))}
            </MapView>
          )}
        </div>
      )}

      {/* ── "Edit in admin" link that opened nothing ── */}
      <AdminFocusNoticeLine notice={focusNotice} kind="resource" locale={locale} onDismiss={() => setFocusNotice(null)} />

      {/* ── A saved edit (always mounted, so it is announced) ── */}
      <p role="status" data-testid="manage-status" className="sr-only"><AnnouncementText announcement={status} /></p>

      {/* ── Error (always mounted: announced when it appears) ── */}
      <div
        role="alert"
        data-testid="manage-alert"
        className={error ? 'rounded-lg border border-red-700 bg-red-50 px-4 py-3 text-sm text-red-800 flex flex-wrap items-center gap-2' : 'sr-only'}
      >
        {error && <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {error ?? ''}
        {error && (
          <Button
            variant="outline"
            size="sm"
            className="ms-auto h-6 border-stone-500 text-xs"
            onClick={() => {
              // The line (and this button) leaves as the reload starts: continue from the heading.
              listHeading.current?.focus()
              void loadResources()
            }}
          >
            {t('tryAgain')}
          </Button>
        )}
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-stone-500" aria-hidden="true" />
          <span className="sr-only">{t('loading')}</span>
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-stone-700 font-medium">{t('noMatchTitle')}</p>
            <p className="text-sm text-stone-600 mt-1">{t('noMatchBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id} className="flex flex-col">
              <CardContent className="pt-4 flex-1 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                        {resourceCategoryLabel(r.category, locale)}
                      </span>
                      {savedId === r.id && (
                        <span className="text-xs text-green-800 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {t('saved')}
                        </span>
                      )}
                      {/* W1: 'location error' badge — off the map, still listed. */}
                      {needsLocation(r.geocode_accuracy) && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-amber-700 bg-amber-50 text-amber-800 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" /> {t('needsLocation')}
                        </span>
                      )}
                    </div>
                    <p lang="" dir="auto" className="text-sm font-medium text-stone-900 leading-snug line-clamp-2">{r.name}</p>
                  </div>
                  <button
                    type="button"
                    {...{ [RESOURCE_EDIT_BUTTON_ATTR]: r.id }}
                    onClick={() => openEdit(r)}
                    className={`inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-sm text-lime-800 hover:text-lime-900 transition-colors ${FOCUS_RING}`}
                    aria-label={namedControl(t('editResource'), r.name)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {(r.city ?? r.address_line1) && (
                  <div className="flex items-center gap-1 text-xs text-stone-600">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span lang="" dir="auto">{[r.address_line1, r.city, r.state, r.zip_code].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {r.description && (
                  <p lang="" dir="auto" className="text-xs text-stone-700 line-clamp-3">{r.description}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <MemberViewLink
                    to={{ kind: 'resource', id: r.id }}
                    visibility={resourceVisibility(r)}
                    label={orgFormT(locale, 'actionViewPublic')}
                    locale={locale}
                    itemName={r.name}
                    source="manage_resources"
                  />
                  {/* Its pin on the members' map (approved + a non-zero location); a resource a
                      visible business links to lands on that business's pin. */}
                  <MemberViewLink
                    to={{ kind: 'map_focus', focus: { kind: 'resource', id: r.id } }}
                    visibility={resourceMapVisibility(r)}
                    label={adminNavT(locale, 'viewOnMap')}
                    locale={locale}
                    itemName={r.name}
                    source="manage_resources"
                  />
                </div>
                {r.website && (
                  <a
                    href={r.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    onClick={() => logEvent('admin.resource.link.visit', { resource_id: r.id })}
                    className="text-xs text-lime-800 hover:underline flex items-center gap-1 truncate mt-auto"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{r.website}</span>
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Load more ── */}
      {!loading && hasMore && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            onClick={() => { if (!loadingMore) void loadMore() }}
            aria-disabled={loadingMore || undefined}
            className="border-stone-500 text-stone-700"
          >
            {loadingMore ? (
              <><Loader2 className="h-4 w-4 me-2 animate-spin" aria-hidden="true" />{t('loading')}</>
            ) : (
              t('loadMore')
            )}
          </Button>
        </div>
      )}

      {/* ── Edit dialog (shared with the Approve tab — see resource-edit-dialog.tsx) ── */}
      <ResourceEditDialog
        open={editing !== null}
        resource={editing ? toDialogInputFromManageRow(editing) : null}
        mode="edit"
        locale={locale}
        onOpenChange={(open) => { if (!open) closeEdit() }}
        onSaved={handleDialogSaved}
        // A dialog an "Edit in admin" link opened has no trigger: without this, closing it drops focus
        // to <body>. Its row's Edit button when listed, else the Manage tab trigger. A save is
        // announced only now, with the dialog gone (while open, the page behind it is aria-hidden).
        onCloseAutoFocus={(event) => {
          restoreFocusAfterResourceEdit(event, editedIdRef.current, document)
          const text = savedAnnouncement.current
          savedAnnouncement.current = null
          if (text) announce(setStatus, text)
        }}
      />
    </div>
  )
}
