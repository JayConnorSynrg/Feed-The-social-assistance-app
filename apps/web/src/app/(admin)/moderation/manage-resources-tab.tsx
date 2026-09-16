'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Search, Loader2, MapPin, AlertCircle, Pencil, CheckCircle2,
  Map as MapIcon, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { US_STATES, STATE_TO_ABBR, normalizeState } from '@/lib/us-states'
import { MapView, type MapViewHandle } from '@/components/map/map-view'
import { ResourceMarker } from '@/components/map/resource-marker'
import type { Resource as ResourceMarkerResource } from '@/components/map/resource-marker'
import {
  ResourceEditDialog,
  type ResourceEditDialogInput,
  type ResourceEditDialogSavedRow,
} from './resource-edit-dialog'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ResourceRow {
  id: string
  name: string
  description: string | null
  category: string
  address_line1: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  email: string | null
  website: string | null
  status: string
  source: string | null
  is_verified: boolean | null
  moderated_at: string | null
  lat: number | null
  lng: number | null
  service_mode: string
}

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

export function ManageResourcesTab() {
  const supabase = createClient()
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
      const msg = err instanceof Error ? err.message : 'Failed to load resources'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [supabase, stateFilter, cityFilter, searchInput])

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
      logger.info('admin.resource.list.more', {
        added: list.length,
        offset: rows.length,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load more resources'
      setError(msg)
    } finally {
      setLoadingMore(false)
    }
  }, [supabase, stateFilter, cityFilter, searchInput, rows.length])

  // Initial load only — subsequent loads are triggered explicitly via Apply/Enter
  // so typing in the city/search boxes does not fire a query on every keystroke.
  useEffect(() => {
    void loadResources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Edit ────────────────────────────────────────────────────
  const openEdit = useCallback((r: ResourceRow) => {
    setEditing(r)
  }, [])

  const closeEdit = useCallback(() => {
    setEditing(null)
  }, [])

  // <ResourceEditDialog> owns the admin_update_resource RPC call, geocoding, and
  // structured logging (INV A/B/C/E). This just merges the saved row back into
  // the list and shows the "Saved" indicator — zero field regression from the
  // pre-extraction inline modal (every field it saved still saves identically).
  const handleDialogSaved = useCallback((row: ResourceEditDialogSavedRow) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)))
    setSavedId(row.id)
    setTimeout(() => setSavedId(null), 2500)
    setEditing(null)
  }, [])

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
  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs text-stone-500">State</Label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-500"
              >
                <option value="">All states</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s} ({STATE_TO_ABBR[s]})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-stone-500">City</Label>
              <Input
                placeholder="e.g. Burlington"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !loading) void loadResources() }}
                className="text-stone-900 placeholder:text-stone-400 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-stone-500">Search name / description</Label>
              <Input
                placeholder="e.g. food bank"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !loading) void loadResources() }}
                className="text-stone-900 placeholder:text-stone-400 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => void loadResources()}
                disabled={loading}
                className="w-full bg-lime-600 hover:bg-lime-700 text-white"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" />Apply filters</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-stone-700">
          Approved resources{!loading && ` — showing ${rows.length}${hasMore ? ' (more available)' : ''}`}
        </span>
        <button
          type="button"
          onClick={() => setMapExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs font-medium text-lime-700 hover:text-lime-800 transition-colors"
          aria-expanded={mapExpanded}
        >
          <MapIcon className="h-3.5 w-3.5" />
          {mapExpanded ? 'Hide map' : 'Show map'}
          {mapExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── Map (collapsible; toggling never disturbs the list or its filters — INV B/D) ── */}
      {mapExpanded && (
        <div className="rounded-xl overflow-hidden border border-stone-200 h-72 bg-stone-50">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : (
            <MapView ref={mapRef} className="h-full w-full">
              {mappable.map((r) => (
                <ResourceMarker key={r.id} resource={toMarkerResource(r)} />
              ))}
            </MapView>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <Button variant="outline" size="sm" className="ml-auto h-6 text-xs" onClick={() => void loadResources()}>
            Retry
          </Button>
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-stone-600 font-medium">No resources match these filters</p>
            <p className="text-sm text-stone-400 mt-1">Adjust the state, city, or search and apply again.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id} className="flex flex-col">
              <CardContent className="pt-4 flex-1 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 capitalize">
                        {r.category.replace(/_/g, ' ')}
                      </span>
                      {savedId === r.id && (
                        <span className="text-xs text-green-700 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-stone-900 leading-snug line-clamp-2">{r.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="shrink-0 text-lime-700 hover:text-lime-800 transition-colors"
                    aria-label="Edit resource"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>

                {(r.city ?? r.address_line1) && (
                  <div className="flex items-center gap-1 text-xs text-stone-500">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {[r.address_line1, r.city, r.state, r.zip_code].filter(Boolean).join(', ')}
                  </div>
                )}
                {r.description && (
                  <p className="text-xs text-stone-600 line-clamp-3">{r.description}</p>
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
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="text-stone-700"
          >
            {loadingMore ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…</>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}

      {/* ── Edit dialog (shared with the Approve tab — see resource-edit-dialog.tsx) ── */}
      <ResourceEditDialog
        open={editing !== null}
        resource={editing ? toDialogInputFromManageRow(editing) : null}
        mode="edit"
        onOpenChange={(open) => { if (!open) closeEdit() }}
        onSaved={handleDialogSaved}
      />
    </div>
  )
}
