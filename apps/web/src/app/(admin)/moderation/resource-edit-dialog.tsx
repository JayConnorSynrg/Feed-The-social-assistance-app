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
import { privilegedRpc } from '@/lib/privileged-action'
import type { Database } from '@feed/database'
import { US_STATES, STATE_TO_ABBR, normalizeState } from '@/lib/us-states'

type AdminUpdateResourceRows = Database['public']['Functions']['admin_update_resource']['Returns']
import { resolveGeoPointV6, type GeocodeMatch, type AddressSuggestion } from '@/lib/mapbox-geocode-v6'
import { needsLocation } from '@/lib/geocode-accuracy'
import { AddressAutocomplete } from './address-autocomplete'
import {
  applySuggestion, addressSnapshotOf, type AddressSnapshot,
} from './resource-edit-geo'
import {
  decideGeoWrite, runResourceSave, buildGeocodeEvent, changedFieldKeys,
} from './resource-edit-save'

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
  /** Current geocode_accuracy tag; 'unlocated' drives the "needs location"
   *  editor badge (W1). Null on rows never geocoded. */
  geocode_accuracy: string | null
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

    // ── W1: decide the coordinates ONCE, one rule for every path ──
    // decideGeoWrite runs planSaveGeo and, for a free-typed address, the on-save
    // forward geocode — then applies the single rule in both directions: a STRONG
    // match writes coords + tier; a WEAK/FAILED result writes NO coords and asks
    // the RPC to flag 'unlocated' (server-gated to rows with no existing pin, so
    // a good pin is never overwritten); online / no-address / unchanged skip.
    const geo = await decideGeoWrite(
      {
        serviceMode: form.service_mode,
        form,
        initialAddress: initialAddressRef.current,
        initialHasCoords: initialHasCoordsRef.current,
        selection: selectedSuggestion,
      },
      { resolveGeoPoint },
    )

    // ── W2: exactly one geocode event (privacy-safe field builder). ──
    logger.info('admin.resource.geocode', buildGeocodeEvent(resource.id, form.service_mode, geo))

    const changedFields = changedFieldKeys(resource, form)

    try {
      // runResourceSave owns the admin_update_resource call, the single
      // admin.resource.save event (info on success / logger.error on failure —
      // no more swallowed catch), and the INV-D approve confirm-after-persist.
      const updated = await runResourceSave(
        {
          resourceId: resource.id,
          mode,
          serviceMode: form.service_mode,
          basePayload: {
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
          },
          geo,
          changedFields,
        },
        {
          // Routed through privilegedRpc: one request id sent as x-request-id, shared with the
          // withMetric wide-event and the durable admin_actions row written by admin_update_resource.
          rpc: (payload) =>
            privilegedRpc<AdminUpdateResourceRows>(
              supabase,
              'admin.resource.update',
              'admin_update_resource',
              payload,
              { action: 'resource.update', target_id: resource.id },
            ),
          onConfirm: mode === 'approve' ? onConfirm : undefined,
          logger,
        },
      )

      // admin_update_resource ALWAYS RETURNS the row, so `updated` is the source
      // of truth and this fallback is effectively unreachable. It exists only to
      // satisfy the row shape if a row ever fails to come back — so its geo
      // fields echo the row's PRIOR known state (what the server would preserve),
      // never the client's optimistic guess: fabricating coords/accuracy here
      // could contradict the server's "keep existing pin / only-tag-unlocated-
      // when-location-null" gate.
      onSaved(
        (updated as ResourceEditDialogSavedRow | null) ?? {
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
          lat: resource.lat,
          lng: resource.lng,
          service_mode: form.service_mode,
          geocode_accuracy: resource.geocode_accuracy,
          geocode_confidence: null,
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

            {/* W1: 'location error' state — this row has no map pin. Shown in the
                editor so an admin knows to give it a locatable address; the row
                stays off the map and findable in search until then. */}
            {resource && needsLocation(resource.geocode_accuracy) && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Needs location — not shown on the map. Enter an address and pick a suggestion to place it.
              </div>
            )}

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
