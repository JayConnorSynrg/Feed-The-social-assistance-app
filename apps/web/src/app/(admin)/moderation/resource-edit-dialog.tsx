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
import { resolveGeoPointV6, type GeocodeMatch, type AddressSuggestion } from '@/lib/mapbox-geocode-v6'
import { AddressAutocomplete } from './address-autocomplete'
import {
  planSaveGeo, applySuggestion, addressSnapshotOf, type AddressSnapshot,
} from './resource-edit-geo'

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
  geocode_accuracy: string | null
  geocode_confidence: string | null
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
// browser-referer-restricted so it can never be used server-side. Delegates
// to the shared Mapbox Geocoding v6 client (lib/mapbox-geocode-v6.ts), which
// returns null on ANY failure (missing token, empty query, network error, no
// usable feature) — geocode failure must never block save — and otherwise
// classifies the top result into a precise-tier or 'approximate' accuracy
// tag (mirrors the geocode-backfill move-only-on-strong-match gate).
// ─────────────────────────────────────────────────────────────
export async function resolveGeoPoint(query: string): Promise<GeocodeMatch | null> {
  return resolveGeoPointV6(query, process.env.NEXT_PUBLIC_MAPBOX_TOKEN)
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
  // The live-autocomplete suggestion currently backing the address, or null when
  // the address was free-typed / hand-edited. Drives the move-only-on-strong-match
  // gate at save time (see handleSave / planSaveGeo).
  const [selectedSuggestion, setSelectedSuggestion] = useState<AddressSuggestion | null>(null)

  // Address fields + coordinates as of prefill — read at Save time to decide
  // whether the address changed since the dialog opened (see handleSave INV C).
  const initialAddressRef = useRef<AddressSnapshot | null>(null)
  const initialHasCoordsRef = useRef(false)

  useEffect(() => {
    if (open && resource) {
      const f = toForm(resource)
      setForm(f)
      setSaveError(null)
      setSelectedSuggestion(null)
      initialAddressRef.current = addressSnapshotOf(f)
      initialHasCoordsRef.current = resource.lat != null && resource.lng != null
    } else if (!open) {
      setForm(null)
      setSaveError(null)
      setSelectedSuggestion(null)
      initialAddressRef.current = null
      initialHasCoordsRef.current = false
    }
  }, [open, resource])

  const setField = (k: keyof EditForm, v: string) =>
    setForm((prev) => (prev ? { ...prev, [k]: v } : prev))

  // Editing any address field by hand invalidates a prior suggestion selection —
  // the typed text may no longer correspond to the picked geocode, so the
  // free-typed on-save geocode path (not the stale selection) must decide coords.
  const setAddressField = (k: 'address_line1' | 'city' | 'state' | 'zip_code', v: string) => {
    setSelectedSuggestion(null)
    setField(k, v)
  }

  // A suggestion was chosen: autofill the four address parts and remember the
  // match so the accuracy gate can move the pin only on a strong match.
  const handleSelectSuggestion = (s: AddressSuggestion) => {
    setForm((prev) => (prev ? applySuggestion(prev, s) : prev))
    setSelectedSuggestion(s)
  }

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

    // ── INV C + W2: decide the save-payload coordinates, both directions ──
    // planSaveGeo (pure) picks one of: use a selected strong-match suggestion's
    // coords; skip a weak-match selection (fill text, leave the pin); run the
    // on-save forward geocode for a free-typed address (changed since prefill or
    // no existing coords); or skip entirely (online / no address / unchanged).
    // Every "skip" omits p_lat/p_lng so the RPC leaves the existing location
    // untouched — an unrelated-field edit never flings a manually-corrected pin,
    // and a geocode failure never blocks save.
    let geoLat: number | undefined
    let geoLng: number | undefined
    let geoAccuracy: string | undefined
    let geoConfidence: string | undefined

    const plan = planSaveGeo({
      serviceMode: form.service_mode,
      form,
      initialAddress: initialAddressRef.current,
      initialHasCoords: initialHasCoordsRef.current,
      selection: selectedSuggestion,
    })
    let source: string = plan.source

    if (plan.selected) {
      geoLat = plan.selected.lat
      geoLng = plan.selected.lng
      geoAccuracy = plan.selected.accuracy
      geoConfidence = plan.selected.confidence
    } else if (plan.geocode) {
      const point = await resolveGeoPoint(plan.query)
      if (point) {
        geoLat = point.lat
        geoLng = point.lng
        geoAccuracy = point.accuracy
        geoConfidence = point.confidence
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
      // Coordinates were written into the payload (from a selected strong match
      // OR a successful on-save forward geocode).
      placed: geoLat != null && geoLng != null,
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
        p_geocode_accuracy: geoAccuracy,
        p_geocode_confidence: geoConfidence,
      })
      if (rpcError) throw rpcError

      const updated = ((data ?? []) as ResourceEditDialogSavedRow[])[0] ?? null

      const { data: userData } = await supabase.auth.getUser()
      logger.info('admin.resource.edit_dialog.save', {
        resource_id: resource.id,
        mode,
        by: userData?.user?.id ?? null,
        placed: geoLat != null && geoLng != null,
        source,
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
          geocode_accuracy: geoAccuracy ?? null,
          geocode_confidence: geoConfidence ?? null,
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
  }, [resource, form, saving, selectedSuggestion, supabase, mode, onConfirm, onSaved, onOpenChange])

  const isApprove = mode === 'approve'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent disableOutsideClose className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
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
              {/* W2: live Mapbox v6 autocomplete. Typing shows suggestions;
                  picking one autofills City/State/ZIP below and stamps coords
                  on a strong match. Free typing still saves via on-save geocode. */}
              <AddressAutocomplete
                value={form.address_line1}
                onChange={(v) => setAddressField('address_line1', v)}
                onSelect={handleSelectSuggestion}
                disabled={saving}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs text-stone-500">City</Label>
                <Input value={form.city} onChange={(e) => setAddressField('city', e.target.value)}
                  className="text-stone-900" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-stone-500">State</Label>
                <select
                  value={normalizeState(form.state) ?? ''}
                  onChange={(e) => setAddressField('state', e.target.value)}
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
                <Input value={form.zip_code} onChange={(e) => setAddressField('zip_code', e.target.value)}
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
