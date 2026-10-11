// apps/web/src/lib/safety-alert-rpc.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ONE client path to safety alerts (specs/r3-contract.md, "Safety alerts").
//
// Reads: the single reader (bounding box for the map, top five for the feed strip, one id for the
// editor / map focus / admin link, top 200 for the admin list) and the history reader. Every reader row
// is copied field by field into a SafetyAlert, so nothing the server might add (and no reporter or
// verifier id, which no reader returns) reaches client state, and rows the shown rule calls gone
// (lib/safety-alert-live.ts) are dropped here, once, for every surface.
//
// Writes: place, update / escalate / de-escalate (one RPC, named by the severity move), resolve,
// withdraw and vote. Each is one privilegedRpc call (lib/privileged-action.ts): one request id sent
// as x-request-id and shared with withMetric, so every action persists exactly one `<op>.complete` or
// `<op>.error` row in app_logs with its duration. Labels are ids and enums only: the alert id, its
// type, the severity before and after, whether the caller owns it, and the surface. Descriptions,
// addresses and coordinates are never labels. The source guard (privileged-action-guard.ts) fails any
// alert write that bypasses this file.
//
// A refusal becomes a typed failure from the SQLSTATE + the contract's message token:
//   PT409 edit_conflict (+ details {"current_version","updated_at"})  -> conflict (compare, then choose)
//   PT410 alert is no longer live (+ details {"status"})                -> not_live (resolved, or gone)
//   PT404 alert_not_found                                               -> not_found
//   42501 Account required … | guest_refused | not_authenticated        -> guest
//   42501 not_alert_owner | self_moderation_refused | p3_denied:…       -> forbidden
//   22023 alert_field_invalid:<k> | alert_field_required:<k>            -> invalid
// A call that never reached the database (network, timeout) has no code -> network.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { privilegedRpc } from '@/lib/privileged-action'
import { withMetric } from '@/lib/logger'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'
import { isAlertShown, isResolvedStatus } from '@/lib/safety-alert-live'

type Client = SupabaseClient<Database>

export const ALERT_TYPES = ['weather', 'road_closure', 'speeding', 'general'] as const
export type AlertType = (typeof ALERT_TYPES)[number]

const isAlertType = (v: unknown): v is AlertType => (ALERT_TYPES as readonly unknown[]).includes(v)

/** An alert as the client holds it. Ownership is `is_mine` only: who reported or verified an alert
 *  never leaves the server. */
export interface SafetyAlert {
  id: string
  alert_type: AlertType
  severity: number
  description: string | null
  lng: number
  lat: number
  /** live | resolved from a reader; an RPC answer may also say cleared, removed, withdrawn, expired.
   *  'ended' is set only by the client (SafetyAlertStore) on an alert a read no longer returns. */
  status: string
  confirm_count: number
  clear_count: number
  created_at: string
  expires_at: string
  verified: boolean
  /** True when the signed-in member reported this alert (computed by the server). */
  is_mine: boolean
  /** The token every update and resolve sends back. */
  version: number
  /** Set by the first content update ("Updated" mark). */
  updated_at: string | null
  update_count: number
  resolved_at: string | null
}

/** One message of an alert's history: what the alert said from this version on, and what changed.
 *  It never says who wrote it. */
export interface AlertHistoryEntry {
  version: number
  msg_type: 'alert' | 'update' | 'all_clear' | 'cancel'
  sent_at: string
  alert_type: AlertType
  severity: number
  description: string | null
  expires_at: string
  /** Of: alert_type, severity, description, location, expires_at, status. */
  changed: string[]
  severity_change: 'escalated' | 'de_escalated' | 'same'
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const textOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const int = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const coord = (v: unknown): number => (typeof v === 'number' ? v : Number.NaN)

/** Copy the named fields of a reader row or an RPC answer; null when it is not an alert. */
export function toSafetyAlert(row: unknown): SafetyAlert | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const r = row as Record<string, unknown>
  if (typeof r.id !== 'string' || r.id === '') return null
  return {
    id: r.id,
    alert_type: isAlertType(r.alert_type) ? r.alert_type : 'general',
    severity: int(r.severity, 1),
    description: textOrNull(r.description),
    lng: coord(r.lng),
    lat: coord(r.lat),
    status: text(r.status),
    confirm_count: int(r.confirm_count),
    clear_count: int(r.clear_count),
    created_at: text(r.created_at),
    expires_at: text(r.expires_at),
    verified: r.verified === true,
    is_mine: r.is_mine === true,
    version: int(r.version, 1),
    updated_at: textOrNull(r.updated_at),
    update_count: int(r.update_count),
    resolved_at: textOrNull(r.resolved_at),
  }
}

function toHistoryEntry(row: unknown): AlertHistoryEntry | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (typeof r.version !== 'number') return null
  const msg = text(r.msg_type)
  const change = text(r.severity_change)
  return {
    version: r.version,
    msg_type: msg === 'update' || msg === 'all_clear' || msg === 'cancel' ? msg : 'alert',
    sent_at: text(r.sent_at),
    alert_type: isAlertType(r.alert_type) ? r.alert_type : 'general',
    severity: int(r.severity, 1),
    description: textOrNull(r.description),
    expires_at: text(r.expires_at),
    changed: Array.isArray(r.changed) ? r.changed.filter((c): c is string => typeof c === 'string') : [],
    severity_change: change === 'escalated' || change === 'de_escalated' ? change : 'same',
  }
}

// ---------------------------------------------------------------------------
// Failures
// ---------------------------------------------------------------------------

/** The error object supabase-js returns for a failed RPC (privilegedRpc preserves it). */
export interface AlertRpcError {
  code?: string
  message: string
  details?: string | null
}

export type AlertRpcFailure =
  | { kind: 'conflict'; currentVersion: number | null; updatedAt: string | null }
  /** The alert is not live any more. `resolved`: it was marked resolved (still shown, as resolved);
   *  otherwise it is gone (expired, cleared, removed, withdrawn). */
  | { kind: 'not_live'; resolved: boolean }
  | { kind: 'not_found' }
  | { kind: 'guest' }
  | { kind: 'forbidden'; token: string }
  | { kind: 'invalid'; field: string }
  | { kind: 'network' }
  | { kind: 'unknown'; code: string }

function parseDetails(details: string | null | undefined): Record<string, unknown> | null {
  if (!details) return null
  try {
    const v = JSON.parse(details) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const GUEST_TOKENS = new Set(['Account required for this action', 'guest_refused', 'not_authenticated'])

/** Map a failed alert RPC's error to the typed failure a surface renders. */
export function parseAlertRpcError(error: AlertRpcError): AlertRpcFailure {
  const code = error.code ?? ''
  const message = (error.message ?? '').trim()
  if (!code) return { kind: 'network' }
  if (code === 'PT409') {
    const d = parseDetails(error.details)
    return {
      kind: 'conflict',
      currentVersion: typeof d?.current_version === 'number' ? d.current_version : null,
      updatedAt: typeof d?.updated_at === 'string' ? d.updated_at : null,
    }
  }
  if (code === 'PT410') {
    const d = parseDetails(error.details)
    return { kind: 'not_live', resolved: isResolvedStatus(typeof d?.status === 'string' ? d.status : null) }
  }
  if (code === 'PT404') return { kind: 'not_found' }
  if (code === '42501') {
    if (GUEST_TOKENS.has(message)) return { kind: 'guest' }
    return { kind: 'forbidden', token: /^[a-z0-9_:]+$/.test(message) ? message : 'permission' }
  }
  if (code === '22023') {
    const m = /^alert_field_(?:invalid|required):([a-z_]+)/.exec(message)
    if (m) return { kind: 'invalid', field: m[1] }
  }
  return { kind: 'unknown', code }
}

export type AlertOutcome<T> = { ok: true; value: T; requestId: string } | { ok: false; failure: AlertRpcFailure; requestId: string }

type RpcResult = { data: unknown; error: { code?: string; message: string } | null; requestId: string }

/** An RPC that answers one AlertPublic. An answer that is not an alert counts as a failure. */
function alertOutcome(res: RpcResult): AlertOutcome<SafetyAlert> {
  if (res.error) return { ok: false, failure: parseAlertRpcError(res.error as AlertRpcError), requestId: res.requestId }
  const alert = toSafetyAlert(res.data)
  if (!alert) return { ok: false, failure: { kind: 'unknown', code: 'bad_answer' }, requestId: res.requestId }
  return { ok: true, value: alert, requestId: res.requestId }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface ViewportBounds {
  west: number
  south: number
  east: number
  north: number
}

/** The feed strip shows at most this many alerts (live first, highest severity, newest). */
export const STRIP_ALERT_LIMIT = 5
/** The admin review list reads at most this many (live and resolved). */
export const ADMIN_ALERT_LIMIT = 200

type ReaderArgs = Database['public']['Functions']['safety_alerts_in_view']['Args']

/** A failed read, with the server's code (never shown to a member). */
export class AlertReadError extends Error {
  code: string
  constructor(error: { code?: string; message?: string }) {
    super(error.message || 'alert read failed')
    this.name = 'AlertReadError'
    this.code = error.code ?? ''
  }
}

/** The one reader call. Resolved alerts are always asked for; gone rows never leave this function. */
async function readAlerts(supabase: Client, args: ReaderArgs, signal?: AbortSignal): Promise<SafetyAlert[]> {
  const { data, error } = await supabase
    .rpc('safety_alerts_in_view', { ...args, p_include_resolved: true })
    .abortSignal(signal ?? AbortSignal.timeout(QUERY_TIMEOUT_MS))
  if (error) throw new AlertReadError(error)
  const now = Date.now()
  const alerts: SafetyAlert[] = []
  for (const row of (data ?? []) as unknown[]) {
    const alert = toSafetyAlert(row)
    if (alert && isAlertShown(alert, now)) alerts.push(alert)
  }
  return alerts
}

/** The map layer: every shown alert in the viewport. */
export function readSafetyAlertsInView(supabase: Client, bounds: ViewportBounds): Promise<SafetyAlert[]> {
  return readAlerts(supabase, { p_min_lng: bounds.west, p_min_lat: bounds.south, p_max_lng: bounds.east, p_max_lat: bounds.north })
}

/** The feed strip: the top five shown alerts, live first. */
export function readSafetyAlertStrip(supabase: Client): Promise<SafetyAlert[]> {
  return readAlerts(supabase, { p_limit: STRIP_ALERT_LIMIT })
}

/** The admin review list: live and resolved alerts, newest 200 by the reader's order. */
export function readSafetyAlertList(supabase: Client): Promise<SafetyAlert[]> {
  return readAlerts(supabase, { p_limit: ADMIN_ALERT_LIMIT })
}

/** One alert while it is shown (the editor's fresh read, a conflict's re-read, the map-focus link,
 *  the admin "Edit in admin" pin); null once it is gone. */
export async function readSafetyAlertById(supabase: Client, alertId: string, signal?: AbortSignal): Promise<SafetyAlert | null> {
  const rows = await readAlerts(supabase, { p_alert_id: alertId }, signal)
  return rows.find((a) => a.id === alertId) ?? null
}

export type AlertSurface = 'map' | 'strip' | 'admin'

/** The history of a shown alert, newest first (empty once the alert is gone). One persisted row per
 *  opening: alerts.history.open.complete / .error with its duration. */
export function readSafetyAlertHistory(supabase: Client, alertId: string, surface: AlertSurface): Promise<AlertHistoryEntry[]> {
  return withMetric('alerts.history.open', { target_id: alertId, surface }, async () => {
    const { data, error } = await supabase
      .rpc('safety_alert_history', { p_alert_id: alertId })
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
    if (error) throw new AlertReadError(error)
    const entries: AlertHistoryEntry[] = []
    for (const row of (data ?? []) as unknown[]) {
      const entry = toHistoryEntry(row)
      if (entry) entries.push(entry)
    }
    return entries.sort((a, b) => b.version - a.version)
  })
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface PlaceAlertInput {
  type: AlertType
  severity: number
  description: string
  lng: number
  lat: number
}

/** What an update changes. A key that is absent keeps the stored value. `description: null` clears
 *  the text. `lng` and `lat` travel together. */
export interface AlertChanges {
  type?: AlertType
  severity?: number
  description?: string | null
  lng?: number
  lat?: number
}

/** The alert as the member saw it when they acted: its id, the version token, and the labels. */
export type ActedAlert = Pick<SafetyAlert, 'id' | 'version' | 'alert_type' | 'severity' | 'is_mine'>

/** The arguments of an update: only what changed, plus the version the form opened with. The
 *  contract's clear value for the text is the empty string (an omitted or NULL argument keeps it;
 *  the server stores NULL for an empty text). */
export function alertUpdateArgs(alert: Pick<SafetyAlert, 'id' | 'version'>, changes: AlertChanges): Record<string, unknown> {
  const args: Record<string, unknown> = { p_alert_id: alert.id, p_expected_version: alert.version }
  if (changes.type !== undefined) args.p_type = changes.type
  if (changes.severity !== undefined) args.p_severity = changes.severity
  if (changes.description !== undefined) args.p_description = changes.description === null ? '' : changes.description
  if (changes.lng !== undefined && changes.lat !== undefined) {
    args.p_lng = changes.lng
    args.p_lat = changes.lat
  }
  return args
}

export async function placeSafetyAlert(supabase: Client, input: PlaceAlertInput, surface: AlertSurface): Promise<AlertOutcome<SafetyAlert>> {
  const res = await privilegedRpc(
    supabase,
    'alerts.place',
    'place_safety_alert',
    { p_type: input.type, p_severity: input.severity, p_description: input.description, p_lng: input.lng, p_lat: input.lat },
    { alert_type: input.type, severity_before: null, severity_after: input.severity, is_owner: true, surface },
  )
  return alertOutcome(res)
}

/** Update an alert. The row is named by what the severity does: alerts.escalate when it rises (the
 *  server restarts the expiry for the new level), alerts.deescalate when it falls (the server caps
 *  the time left), alerts.update otherwise (the expiry is kept). Read `expires_at` from the answer. */
export async function updateSafetyAlert(supabase: Client, alert: ActedAlert, changes: AlertChanges, surface: AlertSurface): Promise<AlertOutcome<SafetyAlert>> {
  const args = alertUpdateArgs(alert, changes)
  const after = changes.severity ?? alert.severity
  const labels = {
    target_id: alert.id,
    alert_type: changes.type ?? alert.alert_type,
    severity_before: alert.severity,
    severity_after: after,
    is_owner: alert.is_mine,
    surface,
  }
  if (after > alert.severity) return alertOutcome(await privilegedRpc(supabase, 'alerts.escalate', 'update_safety_alert', args, labels))
  if (after < alert.severity) return alertOutcome(await privilegedRpc(supabase, 'alerts.deescalate', 'update_safety_alert', args, labels))
  return alertOutcome(await privilegedRpc(supabase, 'alerts.update', 'update_safety_alert', args, labels))
}

/** Mark an alert resolved (an all-clear shown for six hours). There is no reopen. */
export async function resolveSafetyAlert(supabase: Client, alert: ActedAlert, surface: AlertSurface): Promise<AlertOutcome<SafetyAlert>> {
  const res = await privilegedRpc(
    supabase,
    'alerts.resolve',
    'resolve_safety_alert',
    { p_alert_id: alert.id, p_expected_version: alert.version },
    { target_id: alert.id, alert_type: alert.alert_type, severity_before: alert.severity, severity_after: alert.severity, is_owner: alert.is_mine, surface },
  )
  return alertOutcome(res)
}

/** The owner's delete: a recorded withdrawal. The alert leaves every reader at once. */
export async function withdrawSafetyAlert(supabase: Client, alert: ActedAlert, surface: AlertSurface): Promise<AlertOutcome<null>> {
  const res = await privilegedRpc(
    supabase,
    'alerts.withdraw',
    'delete_safety_alert',
    { p_alert_id: alert.id },
    { target_id: alert.id, alert_type: alert.alert_type, severity_before: alert.severity, severity_after: null, is_owner: alert.is_mine, surface },
  )
  if (res.error) return { ok: false, failure: parseAlertRpcError(res.error as AlertRpcError), requestId: res.requestId }
  return { ok: true, value: null, requestId: res.requestId }
}

export type AlertVote = 'confirm' | 'clear'

/** "Still here" / "Gone now". Three "Gone now" votes that outnumber "Still here" clear the alert at
 *  once: the answer then says `cleared`, which the shown rule calls gone. */
export async function voteSafetyAlert(supabase: Client, alert: ActedAlert, vote: AlertVote, surface: AlertSurface): Promise<AlertOutcome<SafetyAlert>> {
  const res = await privilegedRpc(
    supabase,
    'alerts.vote',
    'vote_safety_alert',
    { p_alert_id: alert.id, p_vote: vote },
    { target_id: alert.id, alert_type: alert.alert_type, severity_before: alert.severity, severity_after: alert.severity, is_owner: alert.is_mine, vote, surface },
  )
  return alertOutcome(res)
}
