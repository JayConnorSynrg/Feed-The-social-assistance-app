'use client'

import { useState, useEffect, useCallback, useRef, useId } from 'react'
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
import { dir, type Locale } from '@/lib/i18n'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import { adminResourcesT, resourceStatusLabel, serviceModeLabel } from '@/lib/i18n-admin-resources'

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
// shows its true category rather than silently defaulting to 'food'. Each option's
// value is the enum; its text is resourceCategoryLabel() in the admin's language.
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
  /** Where focus goes when the dialog closes (Radix onCloseAutoFocus). A dialog opened by a link has
   *  no trigger to return to, so the caller decides instead of focus dropping to <body>. */
  onCloseAutoFocus?: (event: Event) => void
  /** The admin's language: the dialog is portalled to <body>, so it carries its own lang / dir. */
  locale: Locale
}

export function ResourceEditDialog({
  open, resource, mode, onOpenChange, onSaved, onConfirm, onCloseAutoFocus, locale,
}: ResourceEditDialogProps) {
  const supabase = createClient()
  const t = (key: Parameters<typeof adminResourcesT>[1]) => adminResourcesT(locale, key)
  // Label ↔ field pairing: each Label's htmlFor names its control's id.
  const fieldId = useId()
  const idOf = (field: string) => `${fieldId}-${field}`

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

    if (!form.name.trim()) { setSaveError(adminResourcesT(locale, 'nameRequired')); return }
    if (!form.category) { setSaveError(adminResourcesT(locale, 'categoryRequired')); return }
    if (!form.status) { setSaveError(adminResourcesT(locale, 'statusRequired')); return }

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
    } catch {
      // runResourceSave has already written the admin.resource.save error row (with its code); the
      // server's message is never shown.
      setSaveError(adminResourcesT(locale, mode === 'approve' ? 'confirmFailed' : 'saveFailed'))
    } finally {
      setSaving(false)
    }
  }, [resource, form, saving, selectedSuggestion, supabase, mode, onConfirm, onSaved, onOpenChange, locale])

  const isApprove = mode === 'approve'

  const LABEL = 'text-xs text-stone-600'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent
        disableOutsideClose
        onCloseAutoFocus={onCloseAutoFocus}
        lang={locale}
        dir={dir(locale)}
        closeLabel={adminResourcesT(locale, 'close')}
        className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{isApprove ? t('dialogTitleApprove') : t('dialogTitleEdit')}</DialogTitle>
          <DialogDescription className="text-stone-600">
            {isApprove ? t('dialogDescApprove') : t('dialogDescEdit')}
          </DialogDescription>
        </DialogHeader>

        {form && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor={idOf('name')} className={LABEL}>
                {t('fieldName')} <span>({t('required')})</span>
              </Label>
              <Input id={idOf('name')} value={form.name} onChange={(e) => setField('name', e.target.value)}
                required aria-required="true" lang="" dir="auto"
                className="text-stone-900" />
            </div>

            <div className="space-y-1">
              <Label htmlFor={idOf('description')} className={LABEL}>{t('fieldDescription')}</Label>
              <Textarea id={idOf('description')} value={form.description} onChange={(e) => setField('description', e.target.value)}
                lang="" dir="auto"
                className="text-stone-900 min-h-[80px]" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={idOf('category')} className={LABEL}>{t('fieldCategory')}</Label>
                <select id={idOf('category')}
                  value={form.category}
                  onChange={(e) => setField('category', e.target.value)}
                  className="w-full text-sm border border-stone-500 rounded-lg px-3 py-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-700"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{resourceCategoryLabel(c, locale)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={idOf('status')} className={LABEL}>{t('fieldStatus')}</Label>
                <select id={idOf('status')}
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                  className="w-full text-sm border border-stone-500 rounded-lg px-3 py-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-700"
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>{resourceStatusLabel(st, locale)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Service mode — INV B: fixed 3-option selector, plain select. */}
            <div className="space-y-1">
              <Label htmlFor={idOf('service_mode')} className={LABEL}>{t('fieldServiceMode')}</Label>
              <select id={idOf('service_mode')}
                value={form.service_mode}
                onChange={(e) => setField('service_mode', e.target.value)}
                className="w-full text-sm border border-stone-500 rounded-lg px-3 py-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-700"
              >
                {SERVICE_MODES.map((m) => (
                  <option key={m} value={m}>{serviceModeLabel(m, locale)}</option>
                ))}
              </select>
              {form.service_mode === 'online' && (
                <p className="text-xs text-stone-600">{t('onlineHint')}</p>
              )}
            </div>

            {/* W1: 'location error' state — this row has no map pin. Shown in the
                editor so an admin knows to give it a locatable address; the row
                stays off the map and findable in search until then. */}
            {resource && needsLocation(resource.geocode_accuracy) && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-700 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t('needsLocationLong')}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor={idOf('address')} className={LABEL}>{t('fieldAddress')}</Label>
              {/* W2: live Mapbox v6 autocomplete. Typing shows suggestions;
                  picking one autofills City/State/ZIP below and stamps coords
                  on a strong match. Free typing still saves via on-save geocode. */}
              <AddressAutocomplete id={idOf('address')}
                value={form.address_line1}
                onChange={(v) => setAddressField('address_line1', v)}
                onSelect={handleSelectSuggestion}
                disabled={saving}
                locale={locale}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor={idOf('city')} className={LABEL}>{t('fieldCity')}</Label>
                <Input id={idOf('city')} value={form.city} onChange={(e) => setAddressField('city', e.target.value)}
                  lang="" dir="auto"
                  className="text-stone-900" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={idOf('state')} className={LABEL}>{t('fieldState')}</Label>
                <select id={idOf('state')}
                  value={normalizeState(form.state) ?? ''}
                  onChange={(e) => setAddressField('state', e.target.value)}
                  className="w-full text-sm border border-stone-500 rounded-lg px-3 py-2 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-700"
                >
                  <option value="">—</option>
                  {US_STATES.map((st) => (
                    <option key={st} value={STATE_TO_ABBR[st]}>{STATE_TO_ABBR[st]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={idOf('zip')} className={LABEL}>{t('fieldZip')}</Label>
                <Input id={idOf('zip')} value={form.zip_code} onChange={(e) => setAddressField('zip_code', e.target.value)}
                  dir="ltr"
                  className="text-stone-900" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={idOf('phone')} className={LABEL}>{t('fieldPhone')}</Label>
                <Input id={idOf('phone')} value={form.phone} onChange={(e) => setField('phone', e.target.value)}
                  type="tel" dir="ltr"
                  className="text-stone-900" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={idOf('email')} className={LABEL}>{t('fieldEmail')}</Label>
                <Input id={idOf('email')} value={form.email} onChange={(e) => setField('email', e.target.value)}
                  dir="ltr"
                  className="text-stone-900" />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor={idOf('website')} className={LABEL}>{t('fieldWebsite')}</Label>
              <Input id={idOf('website')} value={form.website} onChange={(e) => setField('website', e.target.value)}
                dir="ltr"
                className="text-stone-900" />
            </div>
          </div>
        )}

        {/* Inside the dialog (the page behind it is aria-hidden) and always mounted, so a failed
            save is announced when its line appears. */}
        <p role="alert" data-testid="resource-edit-alert" className={saveError ? 'text-sm text-red-700 flex items-center gap-1.5' : 'sr-only'}>
          {saveError && <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {saveError ?? ''}
        </p>

        <DialogFooter className="flex-wrap gap-2">
          {/* aria-disabled while saving (not disabled): the pressed button keeps focus. */}
          <Button variant="outline" className="border-stone-500" onClick={close} aria-disabled={saving || undefined}>
            <X className="h-4 w-4 me-1" aria-hidden="true" /> {t('cancel')}
          </Button>
          <Button
            onClick={() => void handleSave()}
            aria-disabled={saving || undefined}
            className="bg-lime-700 hover:bg-lime-800 text-white"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 me-2 animate-spin" aria-hidden="true" />{isApprove ? t('confirming') : t('saving')}</>
            ) : isApprove ? (
              <><CheckCheck className="h-4 w-4 me-2" aria-hidden="true" />{t('confirm')}</>
            ) : (
              <><Save className="h-4 w-4 me-2" aria-hidden="true" />{t('saveChanges')}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
