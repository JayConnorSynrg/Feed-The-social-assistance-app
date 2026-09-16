'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Search, Loader2, MapPin, AlertCircle, Pencil, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { US_STATES, STATE_TO_ABBR, normalizeState } from '@/lib/us-states'
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

const PAGE_SIZE = 100

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ManageResourcesTab() {
  const supabase = createClient()

  // Filters
  const [stateFilter, setStateFilter] = useState('')   // full state name from dropdown
  const [cityFilter, setCityFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')

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
      </div>

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
