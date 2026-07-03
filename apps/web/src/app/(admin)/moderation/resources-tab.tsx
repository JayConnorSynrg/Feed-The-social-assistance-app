'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Search, Check, X, Loader2, Globe, MapPin, ExternalLink,
  AlertCircle, ChevronDown, ChevronUp, Map as MapIcon, List,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { MapView, type MapViewHandle } from '@/components/map/map-view'
import { ResourceMarker } from '@/components/map/resource-marker'
import type { Resource as ResourceMarkerResource } from '@/components/map/resource-marker'
import { DiscoverProgress } from '@/components/ui/discover-progress'

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
  website: string | null
  status: string
  discovery_metadata: DiscoveryMeta | null
  lat: number | null
  lng: number | null
}

type ContentFilter = 'all' | 'resource' | 'link' | 'form'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function provenanceLabel(meta: DiscoveryMeta): string {
  if (meta.authoritative_domain) return '.gov/.org verified'
  const n = meta.corroborating_count
  return `${n} source${n !== 1 ? 's' : ''}`
}

function confidenceClass(confidence: 'high' | 'medium'): string {
  return confidence === 'high'
    ? 'bg-green-100 text-green-800 border-green-200'
    : 'bg-amber-100 text-amber-800 border-amber-200'
}

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

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function ResourcesTab() {
  const supabase = createClient()
  const mapRef = useRef<MapViewHandle>(null)

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

  // ── Load pending queue ──────────────────────────────────────

  const loadPending = useCallback(async () => {
    setQueueLoading(true)
    setQueueError(null)
    try {
      const { data, error } = await supabase.rpc('admin_list_pending_resources')
      if (error) throw error
      setPending((data ?? []) as PendingItem[])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load pending queue'
      setQueueError(msg)
    } finally {
      setQueueLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  // Prefill location from browser geolocation on mount
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // Only prefill if still empty
        setNearLocation((prev) => {
          if (prev.label) return prev
          return { label: '', lat: pos.coords.latitude, lng: pos.coords.longitude }
        })
        // Reverse-geocode to get a human label
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        if (!token) return
        try {
          const { coords } = pos
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.longitude},${coords.latitude}.json?types=place,region&access_token=${token}`
          const resp = await fetch(url)
          if (!resp.ok) return
          const json = await resp.json() as {
            features?: Array<{ place_name?: string; text?: string; context?: Array<{ id?: string; short_code?: string }> }>
          }
          const place = json.features?.[0]
          if (!place) return
          const placeName = place.text ?? ''
          const regionShort = place.context?.find((c) => c.id?.startsWith('region'))?.short_code?.replace('US-', '') ?? ''
          const label = regionShort ? `${placeName}, ${regionShort}` : placeName
          if (label) {
            setNearLocation((prev) => ({
              label: prev.label || label,
              lat: prev.lat ?? pos.coords.latitude,
              lng: prev.lng ?? pos.coords.longitude,
            }))
          }
        } catch {
          // Reverse-geocode failed — keep lat/lng without a label
        }
      },
      () => {
        // Denied or unavailable — leave empty, no error surfaced
      },
      { timeout: 8000 }
    )
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
      if (!token) throw new Error('Not authenticated')

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
        const text = await response.text().catch(() => response.statusText)
        throw new Error(`Discovery failed: ${text}`)
      }

      const result = await response.json() as {
        staged?: number
        rejected?: number
        resources?: number
        forms?: number
      }

      const total = result.staged ?? (result.resources ?? 0) + (result.forms ?? 0)
      setDiscoverSummary(
        `Staged ${total} candidate${total !== 1 ? 's' : ''} for review` +
        (result.rejected != null ? ` (${result.rejected} rejected by provenance filter)` : '')
      )

      // Reload the pending queue to include newly staged items
      await loadPending()
      setDiscoveryJustCompleted(true)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Treat abort as a soft outcome — the edge function may still be running
        setDiscoverSummary('Discovery request timed out — check queue for any staged items')
        await loadPending()
      } else {
        const msg = err instanceof Error ? err.message : 'Discovery failed'
        setDiscoverError(msg)
      }
    } finally {
      clearTimeout(timeout)
      setDiscovering(false)
    }
  }, [query, nearLocation, supabase, loadPending])

  // Auto-switch to map view after discovery if mappable results exist
  useEffect(() => {
    if (!discoveryJustCompleted) return
    setDiscoveryJustCompleted(false)
    const mappable = pending.filter((p) => p.lat != null && p.lng != null)
    if (mappable.length === 0) return
    setView('map')
    setTimeout(() => {
      if (nearLocation.lat != null && nearLocation.lng != null) {
        mapRef.current?.flyTo({ center: [nearLocation.lng, nearLocation.lat], zoom: 9, duration: 800 })
      } else {
        const first = mappable[0]
        mapRef.current?.flyTo({ center: [first.lng!, first.lat!], zoom: 10, duration: 800 })
      }
    }, 200)
  }, [discoveryJustCompleted, pending, nearLocation, mapRef])

  // ── Approve / Reject ────────────────────────────────────────

  const handleApprove = useCallback(async (item: PendingItem) => {
    setProcessingId(item.id)
    try {
      const contentType = item.discovery_metadata?.content_type ?? 'resource'

      if (contentType === 'form') {
        const { error } = await supabase.rpc('approve_form_template', { p_id: item.id })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('approve_resource', {
          p_resource_id: item.id,
          p_reason: 'Admin approved from discovery queue',
        })
        if (error) throw error
      }

      setPending((prev) => prev.filter((p) => p.id !== item.id))
    } catch (err) {
      console.error('Error approving item:', err)
    } finally {
      setProcessingId(null)
    }
  }, [supabase])

  const handleReject = useCallback(async (item: PendingItem) => {
    setProcessingId(item.id)
    try {
      const { error } = await supabase.rpc('reject_resource', {
        p_resource_id: item.id,
        p_reason: 'Admin rejected from discovery queue',
      })
      if (error) throw error
      setPending((prev) => prev.filter((p) => p.id !== item.id))
    } catch (err) {
      console.error('Error rejecting item:', err)
    } finally {
      setProcessingId(null)
    }
  }, [supabase])

  // ── Bulk approve high-confidence ────────────────────────────

  const highConfidenceItems = pending.filter(
    (p) => p.discovery_metadata?.confidence === 'high'
  )

  const handleBulkApprove = useCallback(async () => {
    setBulkConfirm(false)
    setBulkRunning(true)
    const items = pending.filter((p) => p.discovery_metadata?.confidence === 'high')
    for (const item of items) {
      await handleApprove(item)
    }
    setBulkRunning(false)
  }, [pending, handleApprove])

  // ── Filtered list ───────────────────────────────────────────

  const filtered = filter === 'all'
    ? pending
    : pending.filter((p) => p.discovery_metadata?.content_type === filter)

  const mappable = filtered.filter((p) => p.lat != null && p.lng != null)

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Discovery input ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Discover Resources</CardTitle>
          <CardDescription>
            Enter a natural-language query to source and stage new resources for review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Location bias input */}
          <div className="flex gap-2 items-center">
            <label className="text-xs text-stone-500 shrink-0 w-24">Searching near</label>
            <Input
              placeholder="e.g. Burlington, VT (defaults to your location)"
              value={nearLocation.label}
              onChange={(e) => setNearLocation({ label: e.target.value, lat: null, lng: null })}
              disabled={discovering}
              className="flex-1 text-stone-900 placeholder:text-stone-400 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setNearLocation({ label: '', lat: null, lng: null })
                if (typeof navigator !== 'undefined' && navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
                      setNearLocation({ label: '', lat: pos.coords.latitude, lng: pos.coords.longitude })
                      if (!token) return
                      try {
                        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${pos.coords.longitude},${pos.coords.latitude}.json?types=place,region&access_token=${token}`
                        const resp = await fetch(url)
                        if (!resp.ok) return
                        const json = await resp.json() as {
                          features?: Array<{ text?: string; context?: Array<{ id?: string; short_code?: string }> }>
                        }
                        const place = json.features?.[0]
                        if (!place) return
                        const placeName = place.text ?? ''
                        const regionShort = place.context?.find((c) => c.id?.startsWith('region'))?.short_code?.replace('US-', '') ?? ''
                        const label = regionShort ? `${placeName}, ${regionShort}` : placeName
                        if (label) setNearLocation({ label, lat: pos.coords.latitude, lng: pos.coords.longitude })
                      } catch { /* ignore */ }
                    },
                    () => { /* denied — ignore */ },
                    { timeout: 8000 }
                  )
                }
              }}
              disabled={discovering}
              className="text-xs text-lime-700 hover:text-lime-800 hover:underline shrink-0 whitespace-nowrap disabled:opacity-40"
            >
              Use my location
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder='e.g. "food banks in Burlington VT" or "SNAP application forms"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !discovering) void handleDiscover() }}
              disabled={discovering}
              className="flex-1 text-stone-900 placeholder:text-stone-400"
            />
            <Button
              onClick={() => void handleDiscover()}
              disabled={discovering || !query.trim()}
              className="bg-lime-600 hover:bg-lime-700 text-white shrink-0"
            >
              {discovering ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Discovering…</>
              ) : (
                <><Search className="h-4 w-4 mr-2" />Discover</>
              )}
            </Button>
          </div>

          <DiscoverProgress active={discovering} durationMs={30000} />

          {discoverSummary && (
            <p className="text-sm text-green-700 flex items-center gap-1.5">
              <Check className="h-4 w-4 shrink-0" />
              {discoverSummary}
            </p>
          )}
          {discoverError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {discoverError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Queue header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-stone-700">
            Pending review
            {!queueLoading && ` (${filtered.length})`}
          </span>

          {/* Filter chips */}
          {(['all', 'resource', 'link', 'form'] as ContentFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === f
                  ? 'bg-lime-600 text-white border-lime-600'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-lime-400'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-stone-200 overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors ${
                view === 'list' ? 'bg-stone-100 text-stone-800' : 'bg-white text-stone-500 hover:bg-stone-50'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              onClick={() => setView('map')}
              className={`px-3 py-1.5 text-xs flex items-center gap-1 transition-colors border-l border-stone-200 ${
                view === 'map' ? 'bg-stone-100 text-stone-800' : 'bg-white text-stone-500 hover:bg-stone-50'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              Map
            </button>
          </div>

          {/* Bulk approve */}
          {highConfidenceItems.length > 0 && (
            <>
              {bulkConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-stone-600">
                    Approve {highConfidenceItems.length} high-confidence items?
                  </span>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                    onClick={() => void handleBulkApprove()}
                    disabled={bulkRunning}
                  >
                    {bulkRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setBulkConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => setBulkConfirm(true)}
                  disabled={bulkRunning}
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Bulk approve high-confidence ({highConfidenceItems.length})
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Queue error ── */}
      {queueError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {queueError}
          <Button variant="outline" size="sm" className="ml-auto h-6 text-xs" onClick={() => void loadPending()}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Map view ── */}
      {view === 'map' && (
        <div className="rounded-xl overflow-hidden border border-stone-200 h-72">
          {queueLoading ? (
            <div className="h-full flex items-center justify-center bg-stone-50">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : (
            <MapView ref={mapRef} className="h-full w-full">
              {mappable.map((item) => (
                <ResourceMarker
                  key={item.id}
                  resource={toMarkerResource(item)}
                />
              ))}
            </MapView>
          )}
        </div>
      )}

      {/* ── List view ── */}
      {queueLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-10 w-10 mx-auto text-green-500 mb-3" />
            <p className="text-stone-600 font-medium">No pending items</p>
            <p className="text-sm text-stone-400 mt-1">
              Use the discovery input above to source new resources.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const meta = item.discovery_metadata
            const contentType = meta?.content_type ?? 'resource'
            const isExpanded = expandedId === item.id
            const isProcessing = processingId === item.id
            const sourceUrl = meta?.source_url ?? item.website ?? null

            return (
              <Card key={item.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Content type + confidence */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 capitalize">
                          {contentType}
                        </span>
                        {meta && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${confidenceClass(meta.confidence)}`}>
                            {meta.confidence} confidence
                          </span>
                        )}
                      </div>

                      <CardTitle className="text-sm leading-snug line-clamp-2">
                        {item.name}
                      </CardTitle>
                    </div>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="shrink-0 text-stone-400 hover:text-stone-600 transition-colors"
                      aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col gap-2 pt-0">
                  {/* Provenance chip */}
                  {meta && (
                    <div className="flex items-center gap-1 text-xs text-stone-500">
                      <Globe className="h-3 w-3 shrink-0" />
                      {provenanceLabel(meta)}
                    </div>
                  )}

                  {/* Address */}
                  {(item.city ?? item.address) && (
                    <div className="flex items-center gap-1 text-xs text-stone-500">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {[item.address, item.city, item.state].filter(Boolean).join(', ')}
                    </div>
                  )}

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="space-y-1.5 text-xs text-stone-600 pt-1 border-t border-stone-100">
                      {item.description && (
                        <p className="line-clamp-4">{item.description}</p>
                      )}
                      {item.phone && <p>Phone: {item.phone}</p>}
                      {item.category && (
                        <p>Category: {item.category.replace(/_/g, ' ')}</p>
                      )}
                    </div>
                  )}

                  {/* Source URL */}
                  {sourceUrl && (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-lime-700 hover:underline flex items-center gap-1 truncate mt-auto"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{sourceUrl}</span>
                    </a>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-stone-100 mt-auto">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                      onClick={() => void handleApprove(item)}
                      disabled={isProcessing || bulkRunning}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <><Check className="h-3.5 w-3.5 mr-1" />Approve</>
                      )}
                    </Button>
                    {contentType !== 'form' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-7 text-xs"
                        onClick={() => void handleReject(item)}
                        disabled={isProcessing || bulkRunning}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <><X className="h-3.5 w-3.5 mr-1" />Reject</>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
