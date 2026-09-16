'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertCircle, Loader2, Save, X, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { US_STATES, STATE_TO_ABBR, normalizeState } from '@/lib/us-states'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

// resource_category enum values — MUST mirror the resource_category enum in
// packages/database/types.ts exactly (all 25 values). An opened resource always
// shows its true category rather than silently defaulting to 'food'. Human labels
// are derived from each value via .replace(/_/g, ' '), matching the existing style.
const CATEGORIES = [
  'food', 'housing', 'healthcare', 'employment', 'education', 'legal',
  'transportation', 'utilities', 'clothing', 'financial', 'mental_health',
  'substance_abuse', 'domestic_violence', 'childcare', 'senior_services',
  'disability_services', 'veteran_services', 'immigration', 'other',
  'eitc_tax_filing', 'free_legal', 'prenatal_natal_care', 'waste_disposal',
  'free_camping', 'free_goods_donation',
] as const

const STATUSES = ['approved', 'pending', 'rejected', 'archived'] as const

// resource_service_mode enum — MUST mirror packages/database/types.ts Enums exactly.
// Fixed 3-option selector per INV B (not the hand-maintained CATEGORIES pattern).
const SERVICE_MODES = ['physical', 'online', 'hybrid'] as const
type ServiceMode = (typeof SERVICE_MODES)[number]

const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  physical: 'Physical location',
  online: 'Online only',
  hybrid: 'Hybrid (physical + online)',
}

// Normalized input shape both tabs map their row shape into before opening this
// dialog — see toDialogInputFromManageRow (manage-resources-tab.tsx) and
// toDialogInputFromPendingRow (resources-tab.tsx). Keeping this shape independent
// of either RPC row shape is what lets one dialog serve both call sites (INV A).
export interface ResourceEditDialogInput {
  id: string
  name: string
  description: string
  category: string
  address_line1: string
  city: string
  state: string
  zip_code: string
  phone: string
  email: string
  website: string
  status: string
  service_mode: string
  lat: number | null
  lng: number | null
}

// Shape returned by the admin_update_resource RPC (packages/database/types.ts).
// Passed back to the caller via onSaved so each tab can merge it into its own
// row shape without this dialog needing to know either tab's local row type.
export interface ResourceEditDialogSavedRow {
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

interface EditForm {
  name: string
  description: string
  category: string
  address_line1: string
  city: string
  state: string
  zip_code: string
  phone: string
  email: string
  website: string
  status: string
  service_mode: string
}

function toForm(r: ResourceEditDialogInput): EditForm {
  return {
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
    service_mode: SERVICE_MODES.includes(r.service_mode as ServiceMode)
      ? r.service_mode
      : 'physical',
  }
}

// ─────────────────────────────────────────────────────────────
// Forward geocode (INV C) — client-side only; NEXT_PUBLIC_MAPBOX_TOKEN is
// browser-referer-restricted so it can never be used server-side. Returns null
// on ANY failure (missing token, empty query, network error, empty features) —
// geocode failure must never block save.
// ─────────────────────────────────────────────────────────────
export async function resolveGeoPoint(query: string): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const q = query.trim()
  if (!token || !q) return null
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&limit=1&country=us`
    const resp = await fetch(url)
    if (!resp.ok) return null
    const json = await resp.json() as { features?: Array<{ center?: [number, number] }> }
    const center = json.features?.[0]?.center
    if (!center || center.length !== 2) return null
    const [lng, lat] = center
    if (typeof lat !== 'number' || typeof lng !== 'number') return null
    return { lat, lng }
  } catch {
    return null
  }
}

type GeocodeSource =
  | 'mapbox_forward'
  | 'skipped_online'
  | 'skipped_address_unchanged'
  | 'no_address'
  | 'geocode_failed'

// The address fields whose change (since the dialog was prefilled) can trigger
// a re-geocode. Kept as a standalone shape so the initial-snapshot ref does not
// need to retain the entire EditForm.
type AddressSnapshot = Pick<EditForm, 'address_line1' | 'city' | 'state' | 'zip_code'>

function addressSnapshotOf(f: EditForm): AddressSnapshot {
  return { address_line1: f.address_line1, city: f.city, state: f.state, zip_code: f.zip_code }
}

function addressChanged(a: AddressSnapshot, b: AddressSnapshot): boolean {
  return (
    a.address_line1 !== b.address_line1
    || a.city !== b.city
    || a.state !== b.state
    || a.zip_code !== b.zip_code
  )
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export interface ResourceEditDialogProps {
  open: boolean
  resource: ResourceEditDialogInput | null
  /** 'edit' = Manage tab inline edit ("Save changes"). 'approve' = Approve tab
   *  edit-then-confirm ("Confirm") — persists edits THEN calls onConfirm exactly once. */
  mode: 'edit' | 'approve'
  onOpenChange: (open: boolean) => void
  /** Called once admin_update_resource succeeds (and, in 'approve' mode, once
   *  onConfirm also succeeds) with the RPC-returned row. */
  onSaved: (row: ResourceEditDialogSavedRow) => void
  /** 'approve' mode only — called with the resource id AFTER the edit persists.
   *  Must resolve or throw; a throw surfaces in the dialog and does not close it
   *  or fire onSaved, so Confirm cannot double-approve. */
  onConfirm?: (resourceId: string) => Promise<void>
}

export function ResourceEditDialog({
  open, resource, mode, onOpenChange, onSaved, onConfirm,
}: ResourceEditDialogProps) {
  const supabase = createClient()

  const [form, setForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Address fields + coordinates as of prefill — read at Save time to decide
  // whether the address changed since the dialog opened (see handleSave INV C).
  const initialAddressRef = useRef<AddressSnapshot | null>(null)
  const initialHasCoordsRef = useRef(false)

  useEffect(() => {
    if (open && resource) {
      const f = toForm(resource)
      setForm(f)
      setSaveError(null)
      initialAddressRef.current = addressSnapshotOf(f)
      initialHasCoordsRef.current = resource.lat != null && resource.lng != null
    } else if (!open) {
      setForm(null)
      setSaveError(null)
      initialAddressRef.current = null
      initialHasCoordsRef.current = false
    }
  }, [open, resource])

  const setField = (k: keyof EditForm, v: string) =>
    setForm((prev) => (prev ? { ...prev, [k]: v } : prev))

  const close = useCallback(() => {
    if (saving) return
    onOpenChange(false)
  }, [saving, onOpenChange])

  const handleSave = useCallback(async () => {
    if (!resource || !form || saving) return

    if (!form.name.trim()) { setSaveError('Name is required.'); return }
    if (!form.category) { setSaveError('Category is required.'); return }
    if (!form.status) { setSaveError('Status is required.'); return }

    setSaving(true)
    setSaveError(null)

    // ── INV C: forward geocode on save, both directions ──
    // physical/hybrid + a usable address + (address changed since the dialog
    // opened OR the resource currently has no coordinates) -> geocode and pass
    // p_lat/p_lng so location gets written. Every other case (online, no usable
    // address, or address unchanged with existing coordinates) omits p_lat/p_lng
    // so location is left untouched — this is the fix for unrelated-field edits
    // (e.g. phone) clobbering a manually-corrected pin. A failed/empty geocode
    // also omits p_lat/p_lng and never blocks save.
    let geoLat: number | undefined
    let geoLng: number | undefined
    let source: GeocodeSource
    const hasAddress = Boolean(
      form.address_line1.trim() && (form.city.trim() || form.state.trim() || form.zip_code.trim()),
    )
    const shouldGeocode = hasAddress && (
      addressChanged(addressSnapshotOf(form), initialAddressRef.current ?? addressSnapshotOf(form))
      || !initialHasCoordsRef.current
    )

    if (form.service_mode === 'online') {
      source = 'skipped_online'
    } else if (!hasAddress) {
      source = 'no_address'
    } else if (!shouldGeocode) {
      source = 'skipped_address_unchanged'
    } else {
      const query = [
        form.address_line1.trim(),
        form.city.trim(),
        normalizeState(form.state) ?? form.state.trim(),
        form.zip_code.trim(),
      ].filter(Boolean).join(', ')
      const point = await resolveGeoPoint(query)
      if (point) {
        geoLat = point.lat
        geoLng = point.lng
        source = 'mapbox_forward'
      } else {
        source = 'geocode_failed'
      }
    }

    // INV E — structured logging via the existing app logger. No user/admin PII;
    // address is resource data, not logged here to keep the event minimal.
    logger.info('admin.resource.edit_dialog.geocode', {
      resource_id: resource.id,
      mode,
      geocoded: source === 'mapbox_forward',
      source,
    })

    try {
      const { data, error: rpcError } = await supabase.rpc('admin_update_resource', {
        p_id: resource.id,
        p_name: form.name.trim(),
        p_description: form.description.trim(),
        p_category: form.category,
        p_address_line1: form.address_line1.trim(),
        p_city: form.city.trim(),
        p_state: normalizeState(form.state) ?? '',
        p_zip_code: form.zip_code.trim(),
        p_phone: form.phone.trim(),
        p_email: form.email.trim(),
        p_website: form.website.trim(),
        p_status: form.status,
        p_service_mode: form.service_mode,
        p_lat: geoLat,
        p_lng: geoLng,
      })
      if (rpcError) throw rpcError

      const updated = ((data ?? []) as ResourceEditDialogSavedRow[])[0] ?? null

      const { data: userData } = await supabase.auth.getUser()
      logger.info('admin.resource.edit_dialog.save', {
        resource_id: resource.id,
        mode,
        by: userData?.user?.id ?? null,
        geocoded: source === 'mapbox_forward',
      })

      // ── INV D: approve mode persists edits FIRST, then confirms exactly once ──
      if (mode === 'approve' && onConfirm) {
        await onConfirm(resource.id)
      }

      onSaved(
        updated ?? {
          id: resource.id,
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category,
          address_line1: form.address_line1.trim(),
          city: form.city.trim(),
          state: normalizeState(form.state) ?? form.state.trim(),
          zip_code: form.zip_code.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          website: form.website.trim(),
          status: form.status,
          source: null,
          is_verified: null,
          moderated_at: null,
          lat: geoLat ?? null,
          lng: geoLng ?? null,
          service_mode: form.service_mode,
        },
      )
      onOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : `Failed to ${mode === 'approve' ? 'confirm' : 'save'} resource`
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }, [resource, form, saving, supabase, mode, onConfirm, onSaved, onOpenChange])

  const isApprove = mode === 'approve'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isApprove ? 'Review and confirm resource' : 'Edit resource'}</DialogTitle>
          <DialogDescription>
            {isApprove
              ? 'Edit any field before approving. Confirm saves your changes and publishes this resource in one step.'
              : 'Changes persist to the resources table and are recorded with your admin identity.'}
          </DialogDescription>
        </DialogHeader>

        {form && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-stone-500">Name</Label>
              <Input value={form.name} onChange={(e) => setField('name', e.target.value)}
                className="text-stone-900" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-stone-500">Description</Label>
              <Textarea value={form.description} onChange={(e) => setField('description', e.target.value)}
                className="text-stone-900 min-h-[80px]" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-stone-500">Category</Label>
                <select
                  value={form.category}
                  onChange={(e) => setField('category', e.target.value)}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-stone-500">Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-500"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Service mode — INV B: fixed 3-option selector, plain select. */}
            <div className="space-y-1">
              <Label className="text-xs text-stone-500">Service mode</Label>
              <select
                value={form.service_mode}
                onChange={(e) => setField('service_mode', e.target.value)}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-500"
              >
                {SERVICE_MODES.map((m) => (
                  <option key={m} value={m}>{SERVICE_MODE_LABELS[m]}</option>
                ))}
              </select>
              {form.service_mode === 'online' && (
                <p className="text-xs text-stone-400">Online resources are not geocoded or placed on the map.</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-stone-500">Address</Label>
              <Input value={form.address_line1} onChange={(e) => setField('address_line1', e.target.value)}
                className="text-stone-900" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs text-stone-500">City</Label>
                <Input value={form.city} onChange={(e) => setField('city', e.target.value)}
                  className="text-stone-900" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-stone-500">State</Label>
                <select
                  value={normalizeState(form.state) ?? ''}
                  onChange={(e) => setField('state', e.target.value)}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-500"
                >
                  <option value="">—</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={STATE_TO_ABBR[s]}>{STATE_TO_ABBR[s]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-stone-500">ZIP</Label>
                <Input value={form.zip_code} onChange={(e) => setField('zip_code', e.target.value)}
                  className="text-stone-900" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-stone-500">Phone</Label>
                <Input value={form.phone} onChange={(e) => setField('phone', e.target.value)}
                  className="text-stone-900" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-stone-500">Email</Label>
                <Input value={form.email} onChange={(e) => setField('email', e.target.value)}
                  className="text-stone-900" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-stone-500">Website</Label>
              <Input value={form.website} onChange={(e) => setField('website', e.target.value)}
                className="text-stone-900" />
            </div>

            {saveError && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {saveError}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={saving}
            className="bg-lime-600 hover:bg-lime-700 text-white"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{isApprove ? 'Confirming…' : 'Saving…'}</>
            ) : isApprove ? (
              <><CheckCheck className="h-4 w-4 mr-2" />Confirm</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Save changes</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
