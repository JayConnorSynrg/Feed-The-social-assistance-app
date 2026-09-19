// Load-bearing save orchestrator for the admin resource edit/approve dialog.
//
// Extracted from resource-edit-dialog.tsx (which cannot run in the node test
// env — it is a React component) so the two coupled behaviors this PR ships are
// unit-testable against injected deps, exactly like planSaveGeo before it:
//
//   W1 — ONE consistent geocode rule + a 'location error' state. Every geocode
//        write path (autocomplete-selected AND free-typed on-save) funnels
//        through decideGeoWrite() so a weak/failed result behaves identically:
//        never place coordinates, and flag the row 'unlocated' (server-gated to
//        rows with no existing pin). A strong result writes coords + the tier.
//
//   W2 — EXACTLY ONE structured event per outcome, reusing the existing logger
//        substrate. The geocode decision emits admin.resource.geocode; the RPC
//        emits admin.resource.save on success AND logger.error on failure (the
//        swallowed-catch gap the dialog had before). Field NAMES, lengths,
//        counts, latencies, coordinates and resource_id are logged; address /
//        email / phone / name VALUES never are.
import type { Database } from '@feed/database'
import type { GeocodeMatch, AddressSuggestion } from '@/lib/mapbox-geocode-v6'
import { LOCATION_ERROR_ACCURACY } from '@/lib/geocode-accuracy'
import {
  planSaveGeo, isStrongMatch, addressChanged,
  type AddressSnapshot,
} from './resource-edit-geo'

// ─────────────────────────────────────────────────────────────
// Shapes
// ─────────────────────────────────────────────────────────────

/** The editable fields the dialog form holds (structurally EditForm). */
export interface EditFormFields {
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

type AdminUpdateArgs = Database['public']['Functions']['admin_update_resource']['Args']
type AdminUpdateRow = Database['public']['Functions']['admin_update_resource']['Returns'][number]

/** Minimal logger surface — matches the real logger's info/error. */
export interface SaveLogger {
  info: (message: string, data?: Record<string, unknown>) => void
  error: (message: string, error?: unknown, data?: Record<string, unknown>) => void
}

// ─────────────────────────────────────────────────────────────
// Change detection (KEYS ONLY — never values)
// ─────────────────────────────────────────────────────────────

const EDITABLE_KEYS: (keyof EditFormFields)[] = [
  'name', 'description', 'category', 'address_line1', 'city', 'state',
  'zip_code', 'phone', 'email', 'website', 'status', 'service_mode',
]

/**
 * The names of the editable fields whose value differs between the opened
 * resource and the current form. Returns field NAMES only — callers log these
 * as `changed_fields` without ever logging the values themselves.
 */
export function changedFieldKeys(
  original: Partial<EditFormFields>,
  form: EditFormFields,
): string[] {
  const changed: string[] = []
  for (const k of EDITABLE_KEYS) {
    const before = (original[k] ?? '').toString().trim()
    const after = (form[k] ?? '').toString().trim()
    if (before !== after) changed.push(k)
  }
  return changed
}

// ─────────────────────────────────────────────────────────────
// Geocode decision (W1) — one rule, every path, both directions
// ─────────────────────────────────────────────────────────────

export type GeoOutcome = 'placed' | 'unlocated' | 'skipped'

export interface GeoDecision {
  /** Coordinates + tier to write (a strong match); undefined ⇒ no coordinates. */
  lat?: number
  lng?: number
  accuracy?: string
  confidence?: string
  /** Ask the RPC to set the 'location error' state — server writes it only if
   *  the row has no existing pin, so a good pin is never overwritten. */
  markUnlocated: boolean
  outcome: GeoOutcome
  /** Provisional source label finalized from the geocode result. */
  source: string
  /** Why an outcome was reached (weak_selection | weak_geocode | geocode_failed
   *  | the planSaveGeo skip source); undefined for a clean 'placed'. */
  reason?: string
  addressChanged: boolean
  queryLen: number
  featureCount: number
  geocodeLatencyMs: number
}

export interface DecideGeoArgs {
  serviceMode: string
  form: AddressSnapshot
  initialAddress: AddressSnapshot | null
  initialHasCoords: boolean
  selection: AddressSuggestion | null
}

export interface DecideGeoDeps {
  resolveGeoPoint: (query: string) => Promise<GeocodeMatch | null>
  now?: () => number
}

/**
 * Resolves the ONE geocode rule for a save, running the async forward geocode
 * only when planSaveGeo says to. Both write paths converge here:
 *   - strong (selected or forward)         → coords + precise tier  (outcome placed)
 *   - weak/failed (selected or forward)    → no coords + markUnlocated (outcome unlocated)
 *   - online / no-address / unchanged+pin  → no coords, no flag      (outcome skipped)
 */
export async function decideGeoWrite(args: DecideGeoArgs, deps: DecideGeoDeps): Promise<GeoDecision> {
  const now = deps.now ?? (() => Date.now())
  const plan = planSaveGeo(args)
  const changed = addressChanged(args.form, args.initialAddress ?? args.form)
  const base = {
    markUnlocated: false,
    addressChanged: changed,
    queryLen: plan.query.length,
    featureCount: 0,
    geocodeLatencyMs: 0,
  }

  // Strong selection — coords straight from the picked suggestion.
  if (plan.selected) {
    return {
      ...base,
      lat: plan.selected.lat,
      lng: plan.selected.lng,
      accuracy: plan.selected.accuracy,
      confidence: plan.selected.confidence,
      outcome: 'placed',
      source: plan.source,
    }
  }

  // Weak (or coordinate-less) selection — never place a pin; flag unlocated.
  if (plan.source === 'skipped_weak_match') {
    return { ...base, markUnlocated: true, outcome: 'unlocated', source: plan.source, reason: 'weak_selection' }
  }

  // Free-typed address — run the on-save forward geocode, gate on strength.
  if (plan.geocode) {
    const t0 = now()
    const point = await deps.resolveGeoPoint(plan.query)
    const geocodeLatencyMs = Math.round(now() - t0)
    const featureCount = point ? 1 : 0
    if (point && isStrongMatch(point)) {
      return {
        ...base,
        geocodeLatencyMs,
        featureCount,
        lat: point.lat,
        lng: point.lng,
        accuracy: point.accuracy,
        confidence: point.confidence,
        outcome: 'placed',
        source: 'mapbox_forward',
      }
    }
    // Weak (approximate) OR failed forward geocode — this is the symmetry fix:
    // the old on-save path placed even an 'approximate' pin. Now it never does.
    return {
      ...base,
      geocodeLatencyMs,
      featureCount,
      markUnlocated: true,
      outcome: 'unlocated',
      source: point ? 'geocode_weak' : 'geocode_failed',
      reason: point ? 'weak_geocode' : 'geocode_failed',
    }
  }

  // Online / no-address / unchanged-with-pin — nothing to write, nothing to flag.
  return { ...base, outcome: 'skipped', source: plan.source, reason: plan.source }
}

// ─────────────────────────────────────────────────────────────
// Event field builders (W2) — privacy-safe, pure, unit-testable
// ─────────────────────────────────────────────────────────────

export function buildGeocodeEvent(resourceId: string, serviceMode: string, geo: GeoDecision): Record<string, unknown> {
  const geocoded = geo.lat != null && geo.lng != null
  return {
    resource_id: resourceId,
    service_mode: serviceMode,
    tier: geo.accuracy ?? null,
    source: geo.source,
    geocoded,
    address_changed: geo.addressChanged,
    query_len: geo.queryLen,
    feature_count: geo.featureCount,
    geocode_latency_ms: geo.geocodeLatencyMs,
    outcome: geo.outcome,
    ...(geo.reason ? { reason: geo.reason } : {}),
  }
}

export function buildAutocompleteEvent(fields: {
  queryLen: number
  resultCount: number
  suggestLatencyMs?: number
  selectedIndex?: number
  outcome: 'suggest' | 'select'
}): Record<string, unknown> {
  return {
    query_len: fields.queryLen,
    result_count: fields.resultCount,
    suggest_latency_ms: fields.suggestLatencyMs ?? 0,
    selected_index: fields.selectedIndex ?? null,
    outcome: fields.outcome,
  }
}

export function buildSaveEvent(
  resourceId: string,
  mode: string,
  geo: GeoDecision,
  changedFields: string[],
  rpcLatencyMs: number,
  outcome: 'ok' | 'error',
  reason?: string,
): Record<string, unknown> {
  const wroteLocation = geo.lat != null && geo.lng != null
  return {
    resource_id: resourceId,
    mode,
    outcome,
    ...(reason ? { reason } : {}),
    rpc_latency_ms: rpcLatencyMs,
    fields_changed_count: changedFields.length,
    changed_fields: changedFields,
    geocoded: wroteLocation,
    wrote_location: wroteLocation,
    mark_unlocated: geo.markUnlocated,
  }
}

/**
 * A non-value-bearing failure identifier for logging: the Postgres SQLSTATE /
 * PostgREST error code when present, else the Error name, else 'unknown'. NEVER
 * the error message — a constraint-violation message can quote a column value.
 */
export function errorCode(err: unknown): string {
  if (err && typeof err === 'object') {
    const code = (err as { code?: unknown }).code
    if (typeof code === 'string' && code) return code
    const name = (err as { name?: unknown }).name
    if (typeof name === 'string' && name) return name
  }
  return 'unknown'
}

// ─────────────────────────────────────────────────────────────
// Save orchestrator (W1 + W2)
// ─────────────────────────────────────────────────────────────

export interface RunSaveInput {
  resourceId: string
  mode: 'edit' | 'approve'
  serviceMode: string
  /** Full payload for admin_update_resource EXCEPT the geocode outputs, which
   *  are filled from the geo decision. Built by the caller from the trimmed
   *  form so values never pass through this module's logging. */
  basePayload: Omit<AdminUpdateArgs, 'p_lat' | 'p_lng' | 'p_geocode_accuracy' | 'p_geocode_confidence' | 'p_mark_unlocated'>
  geo: GeoDecision
  changedFields: string[]
}

export interface RunSaveDeps {
  // PromiseLike so the supabase.rpc(...) builder (a thenable, not a Promise) can
  // be passed straight through; it is awaited exactly once below.
  rpc: (payload: AdminUpdateArgs) => PromiseLike<{ data: AdminUpdateRow[] | null; error: unknown }>
  onConfirm?: (resourceId: string) => Promise<void>
  logger: SaveLogger
  now?: () => number
}

/**
 * Persists the resource via admin_update_resource, emitting exactly one
 * admin.resource.save event (info on success, logger.error on failure — the
 * gap the dialog's local-only saveError left open). In approve mode it awaits
 * onConfirm AFTER the persist (INV D); an onConfirm throw propagates so the
 * dialog stays open and shows the error (its own approve_confirm event is
 * emitted by the caller). Returns the RPC row, or null when none came back.
 */
export async function runResourceSave(input: RunSaveInput, deps: RunSaveDeps): Promise<AdminUpdateRow | null> {
  const now = deps.now ?? (() => Date.now())
  const { resourceId, mode, geo, changedFields } = input

  const payload: AdminUpdateArgs = {
    ...input.basePayload,
    p_lat: geo.lat,
    p_lng: geo.lng,
    p_geocode_accuracy: geo.accuracy,
    p_geocode_confidence: geo.confidence,
    p_mark_unlocated: geo.markUnlocated,
  }

  let updated: AdminUpdateRow | null
  const t0 = now()
  try {
    const { data, error } = await deps.rpc(payload)
    if (error) throw error
    updated = (data ?? [])[0] ?? null
    deps.logger.info(
      'admin.resource.save',
      buildSaveEvent(resourceId, mode, geo, changedFields, Math.round(now() - t0), 'ok'),
    )
  } catch (err) {
    // Privacy: a Postgres/PostgREST error MESSAGE can echo a column VALUE — a
    // unique/constraint violation quotes the offending value, e.g.
    // "…(email)=(a@b.org)…". Log only a non-value-bearing identifier (SQLSTATE /
    // PostgREST code, else Error.name) plus a STATIC message; never raw
    // err.message. A scrubbed error is handed to logger.error so its own
    // error_message/stack serialization cannot leak the value into app_logs.
    // The original err is re-thrown so the dialog's user-facing saveError (UX,
    // not a log) still shows the full message.
    const code = errorCode(err)
    const safeErr = new Error('admin_update_resource RPC failed')
    safeErr.name = code
    deps.logger.error(
      'admin.resource.save',
      safeErr,
      buildSaveEvent(resourceId, mode, geo, changedFields, Math.round(now() - t0), 'error', code),
    )
    throw err
  }

  // INV D — approve confirms AFTER the edit persists; approve_confirm logging
  // lives in the caller (handleConfirmApprove) so failures there are recorded too.
  if (mode === 'approve' && deps.onConfirm) {
    await deps.onConfirm(resourceId)
  }

  return updated
}

export { LOCATION_ERROR_ACCURACY }
