// apps/web/src/lib/business-data.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ONE controlled Supabase boundary for the P4a local-business columns/RPCs. The p4a
// migration is applied+proven in the DB, but the generated packages/database/types.ts regen
// is deferred to prod-apply, so `status` / `resource_id` / `submitted_by` and the
// businesses_in_bounds RPC are not yet in the generated types. Rather than sprinkle `as any`
// across call sites (the "as-any masks broken queries" failure mode), the generic erasure is
// confined HERE — exactly like privileged-action.ts and notification-prefs' PrefsUpsertClient —
// so every caller stays fully typed against the shapes in ./business.
//
// Writes/approvals do NOT live here: approve_business/reject_business go through
// privileged-action.ts (privilegedRpc) so they carry x-request-id + withMetric telemetry
// (CINV3). This module only reads (public showcase, map bbox, RA pending queue) and performs
// the member INSERT (whose safe shape is forced by the DB BEFORE-INSERT trigger).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import type { Business, NewBusinessInput, SubmitOutcome } from './business'
import { withMetric } from './logger'
import { normalizeUrl } from './utils/url'

/**
 * Typed errors so the withMetric error_code label buckets by kind (BusinessReadError vs
 * BusinessWriteError) instead of the generic "Error". No PII in the name; the raw Supabase
 * message rides in withMetric's error_message field, never in a bounded label.
 */
export class BusinessReadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BusinessReadError'
  }
}
export class BusinessWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BusinessWriteError'
  }
}

const BUSINESS_COLUMNS =
  'id, name, description, org_type, address, city, state, phone, website, location, resource_id'

// A pending row also carries moderation provenance the RA queue shows.
export interface PendingBusiness extends Business {
  submitted_by: string | null
  created_at: string | null
}

const PENDING_COLUMNS = `${BUSINESS_COLUMNS}, submitted_by, created_at`

// Minimal structural view of the query builder for the p4a columns not yet in the generated
// types. Confined to this module; callers never see it.
type LooseResult<T> = Promise<{ data: T | null; error: { message: string } | null }>
interface LooseBuilder {
  select: (cols: string) => LooseBuilder
  insert: (row: Record<string, unknown>) => LooseBuilder
  eq: (col: string, val: unknown) => LooseBuilder
  order: (col: string, opts?: { ascending?: boolean }) => LooseBuilder
  single: () => LooseResult<{ id: string }>
  then: <R>(cb: (r: { data: unknown; error: { message: string } | null }) => R) => Promise<R>
}
interface LooseClient {
  from: (table: string) => LooseBuilder
  rpc: (name: string, args: Record<string, unknown>) => LooseResult<Business[]>
}

function loose(supabase: SupabaseClient<Database>): LooseClient {
  return supabase as unknown as LooseClient
}

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

/**
 * Map bbox reader — approved business orgs only, via the SECDEF businesses_in_bounds RPC
 * (the sole reader the migration exposes for the map leaf layer). Arg names are the RPC's
 * own (min_lng/min_lat/max_lng/max_lat), distinct from resources_in_bounds.
 */
export async function businessesInBounds(
  supabase: SupabaseClient<Database>,
  bounds: Bounds,
  maxResults = 500
): Promise<Business[]> {
  const { data, error } = await loose(supabase).rpc('businesses_in_bounds', {
    min_lng: bounds.west,
    min_lat: bounds.south,
    max_lng: bounds.east,
    max_lat: bounds.north,
    max_results: maxResults,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as Business[]
}

/**
 * Public showcase reader — every approved business (RLS admits approved business rows to
 * anon + authenticated). Direct select is RLS-safe: the orgs_select_active policy only lets
 * business rows through when status='approved'.
 */
export async function fetchApprovedBusinesses(
  supabase: SupabaseClient<Database>
): Promise<Business[]> {
  // Bounded, PII-free label. with-metric-core spreads `attrs` AFTER fn() resolves, so mutating
  // result_count in place before returning lands the real count on the .complete wide-event.
  const attrs: Record<string, number> = { result_count: 0 }
  return withMetric('business.list.fetch', attrs, async () => {
    const { data, error } = await loose(supabase)
      .from('organizations')
      .select(BUSINESS_COLUMNS)
      .eq('org_type', 'business')
      .eq('status', 'approved')
      .order('name', { ascending: true })
      .then((r) => r)
    if (error) throw new BusinessReadError(error.message)
    const rows = (data ?? []) as Business[]
    attrs.result_count = rows.length
    return rows
  })
}

/**
 * Public single-business reader by id — approved business orgs only. Used by the standalone
 * public page + OG route (outside FeedShell). Returns null when the org is missing or not an
 * approved business, so callers can notFound() (CINV5). RLS also enforces the approved gate.
 */
export async function fetchApprovedBusinessById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<Business | null> {
  const { data, error } = await loose(supabase)
    .from('organizations')
    .select(BUSINESS_COLUMNS)
    .eq('id', id)
    .eq('org_type', 'business')
    .eq('status', 'approved')
    .single()
  if (error || !data) return null
  return data as unknown as Business
}

/**
 * RA review-queue reader — pending business submissions. Visible to a moderator with the
 * is_admin flag (orgs_admin_select). Residual: the fixed contract ships no SECDEF
 * admin_list_pending_businesses, so a future resource_admin whose is_admin=false would read
 * zero rows here; closing that needs a DB-layer list RPC (out of this PR's scope).
 */
export async function fetchPendingBusinesses(
  supabase: SupabaseClient<Database>
): Promise<PendingBusiness[]> {
  const attrs: Record<string, number> = { result_count: 0 }
  return withMetric('business.pending.fetch', attrs, async () => {
    const { data, error } = await loose(supabase)
      .from('organizations')
      .select(PENDING_COLUMNS)
      .eq('org_type', 'business')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .then((r) => r)
    if (error) throw new BusinessReadError(error.message)
    const rows = (data ?? []) as PendingBusiness[]
    attrs.result_count = rows.length
    return rows
  })
}

/**
 * Member submit. Inserts an org_type='business' row; the DB BEFORE-INSERT trigger forces
 * status='pending' + submitted_by=auth.uid() and NULLs every moderation field, so the client
 * cannot forge a pre-approval. Returns a discriminated SubmitOutcome — on a Supabase error it
 * returns { ok:false, error } (it never swallows the failure into a success), which is exactly
 * what the truthful-optimistic revert depends on (CINV4).
 */
export async function submitBusiness(
  supabase: SupabaseClient<Database>,
  input: NewBusinessInput,
  createdBy: string | null
): Promise<SubmitOutcome> {
  // Normalize-at-write (INV2): store a scheme-prefixed absolute URL or null — never a bare domain
  // that would later resolve app-relative. The SAME helper feeds the display href so they can't
  // diverge.
  const website = normalizeUrl(input.website)
  // Bounded, PII-free label — a boolean, never the URL/name/address itself.
  const attrs = { has_website: website !== null }
  try {
    // withMetric emits exactly one wide event: .complete (outcome=pending) on success, .error
    // (error_code=BusinessWriteError) on failure. We throw inside so the failure is recorded, then
    // catch OUTSIDE to keep the non-throwing SubmitOutcome contract the truthful revert needs
    // (CINV4) — the component keys on outcome.ok === false, never on an exception.
    return await withMetric('business.submit', attrs, async () => {
      const { data, error } = await loose(supabase)
        .from('organizations')
        .insert({
          name: input.name.trim(),
          org_type: 'business',
          description: input.description?.trim() || null,
          address: input.address?.trim() || null,
          city: input.city?.trim() || null,
          state: input.state?.trim() || null,
          phone: input.phone?.trim() || null,
          website,
          created_by: createdBy,
        })
        .select('id')
        .single()
      if (error) throw new BusinessWriteError(error.message)
      if (!data?.id) throw new BusinessWriteError('Submission did not persist')
      return { ok: true, id: data.id } as SubmitOutcome
    })
  } catch (err) {
    if (err instanceof BusinessWriteError) return { ok: false, error: err.message }
    throw err
  }
}
