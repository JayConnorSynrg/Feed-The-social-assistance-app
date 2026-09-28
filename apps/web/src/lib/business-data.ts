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
import type {
  Business,
  BusinessHours,
  BusinessPhoto,
  BusinessService,
  NewBusinessInput,
  SubmitOutcome,
} from './business'
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
  'id, name, description, org_type, address, city, state, zip_code, phone, email, website, ' +
  'business_category, cost_model, service_radius_miles, attributes, social_links, location, resource_id'

// Child-table column projections — the exact fields BusinessHours / BusinessService / BusinessPhoto
// expose (the child readers never leak org_id / id / created_at into the client shapes).
const HOURS_COLUMNS = 'day_of_week, open_time, close_time'
const SERVICES_COLUMNS = 'name, description, sort_order'
const PHOTOS_COLUMNS = 'kind, url, storage_path, sort_order, caption'

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
  insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => LooseBuilder
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

/**
 * Normalize a social_links map at write. Every value runs through the SAME normalizeUrl helper the
 * website uses (INV2 — one source of truth for stored href safety): a scheme-less handle/domain is
 * https://-prefixed, an allowlisted scheme is preserved, a dangerous scheme becomes a non-executable
 * broken link. A value that normalizes to null (empty / whitespace) is DROPPED, so the stored jsonb
 * never carries an empty string that would later render a broken link. Returns a fresh object; the
 * input is never mutated.
 */
export function normalizeSocialLinks(
  links: Record<string, string> | null | undefined
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!links) return out
  for (const [key, value] of Object.entries(links)) {
    const normalized = normalizeUrl(value)
    if (normalized !== null) out[key] = normalized
  }
  return out
}

/** The bounded size buckets a photo-upload wide-event may report. */
export type PhotoSizeBucket = 'le_512k' | 'le_2m' | 'le_5m'

/**
 * Map a byte count to a bounded size bucket for the business.photo.upload label. The form caps
 * uploads at 5 MB, so anything above 2 MB reports as le_5m (the top legitimate bucket) — the label
 * vocabulary stays fixed at three values and never leaks a raw byte count.
 */
export function photoSizeBucket(bytes: number): PhotoSizeBucket {
  if (bytes <= 512 * 1024) return 'le_512k'
  if (bytes <= 2 * 1024 * 1024) return 'le_2m'
  return 'le_5m'
}

/** The bounded image types a photo-upload wide-event may report. */
export type PhotoImageType = 'jpeg' | 'png' | 'webp'

/**
 * Map a browser File MIME type to the bounded PhotoImageType vocabulary the upload metric reports.
 * The picker only admits jpeg/png/webp; anything else falls back to 'jpeg' so the label never leaks
 * an unbounded MIME string. Used by the form to label each withPhotoUploadMetric call.
 */
export function photoImageType(mime: string | null | undefined): PhotoImageType {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpeg'
}

/**
 * Wrap a single photo upload in a business.photo.upload wide-event. The form calls this around each
 * upload attempt; withMetric emits EXACTLY ONE event per call — `.complete` on success (outcome=ok)
 * and `.error` on a thrown failure (outcome=error) — so the ok|error outcome dimension rides on the
 * event suffix, exactly like business.submit's pending|error. Labels are bounded and PII-free:
 * image_type (jpeg|png|webp) and size_bucket (le_512k|le_2m|le_5m) — never a filename, url, or
 * storage path. Re-throws on failure so the caller's own error handling still runs.
 */
export function withPhotoUploadMetric<T>(
  imageType: PhotoImageType,
  bytes: number,
  fn: () => Promise<T>
): Promise<T> {
  return withMetric(
    'business.photo.upload',
    { image_type: imageType, size_bucket: photoSizeBucket(bytes) },
    fn
  )
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
    // ONE query, no N+1: embed the org's logo photo (PostgREST detects the business_photos→
    // organizations FK). The embedded-resource filter `business_photos.kind = logo` narrows the
    // nested rows to at most one (the DB partial-unique index guarantees ≤1 logo) WITHOUT dropping
    // logo-less businesses — it is a left embed, not an inner join. RLS admits a child row only when
    // its parent is an approved active business, which every row here already is.
    const { data, error } = await loose(supabase)
      .from('organizations')
      .select(`${BUSINESS_COLUMNS}, business_photos(url)`)
      .eq('org_type', 'business')
      .eq('status', 'approved')
      .eq('business_photos.kind', 'logo')
      .order('name', { ascending: true })
      .then((r) => r)
    if (error) throw new BusinessReadError(error.message)
    const rows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const photos = row.business_photos
      const logoUrl =
        Array.isArray(photos) && photos[0] && typeof (photos[0] as { url?: unknown }).url === 'string'
          ? (photos[0] as { url: string }).url
          : null
      // Drop the embedded array from the returned shape; expose only the flat logo_url the card reads.
      const { business_photos: _embedded, ...rest } = row
      return { ...(rest as unknown as Business), logo_url: logoUrl }
    })
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
  // diverge. Each social link runs through the identical helper (bare handle -> https://, empty ->
  // dropped) so the stored jsonb only ever holds safe absolute hrefs.
  const website = normalizeUrl(input.website)
  const socialLinks = normalizeSocialLinks(input.social_links)
  const attributes = input.attributes ?? {}
  const photos = input.photos ?? []
  const services = input.services ?? []
  const hours = input.hours ?? []
  // Bounded, PII-free labels only — booleans and counts describing the SHAPE of the submission, never
  // the name/email/url/address/user_id themselves. hours_days_set counts the DISTINCT days the member
  // set hours for; attribute_count counts the attributes toggled true.
  const attrs = {
    has_website: website !== null,
    has_logo: photos.some((p) => p.kind === 'logo'),
    has_cover: photos.some((p) => p.kind === 'cover'),
    gallery_count: photos.filter((p) => p.kind === 'gallery').length,
    hours_days_set: new Set(hours.map((h) => h.day_of_week)).size,
    service_count: services.length,
    attribute_count: Object.values(attributes).filter(Boolean).length,
    has_social: Object.keys(socialLinks).length > 0,
  }
  // Step 1 — the ORG insert, wrapped in the single business.submit wide event: .complete
  // (outcome=pending) on success, .error (error_code=BusinessWriteError) on failure. We throw
  // inside so the failure is recorded, then catch OUTSIDE to keep the non-throwing SubmitOutcome
  // contract the truthful revert needs (CINV4). The child inserts (step 2) run AFTER this wrap
  // resolves, so a child failure never flips this event to .error — the submission itself succeeded.
  let orgId: string
  try {
    orgId = await withMetric('business.submit', attrs, async () => {
      const { data, error } = await loose(supabase)
        .from('organizations')
        .insert({
          name: input.name.trim(),
          org_type: 'business',
          description: input.description?.trim() || null,
          address: input.address?.trim() || null,
          city: input.city?.trim() || null,
          state: input.state?.trim() || null,
          zip_code: input.zip_code?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          website,
          business_category: input.business_category?.trim() || null,
          cost_model: input.cost_model ?? null,
          service_radius_miles: input.service_radius_miles ?? null,
          attributes,
          social_links: socialLinks,
          created_by: createdBy,
        })
        .select('id')
        .single()
      if (error) throw new BusinessWriteError(error.message)
      if (!data?.id) throw new BusinessWriteError('Submission did not persist')
      return data.id
    })
  } catch (err) {
    // Org insert failed — nothing persisted. Never fabricate a success, and NEVER re-throw: the
    // withMetric wrap already observed the throw and emitted business.submit.error exactly once, so
    // here (OUTSIDE the wrap) we honor the non-throwing SubmitOutcome contract for ANY failure — a
    // Supabase-returned {error} (BusinessWriteError) OR a raw network/promise rejection — so the
    // caller's truthful revert always runs and the submit surface can never hang (CINV4).
    const message = err instanceof Error ? err.message : 'Submission failed'
    return { ok: false, error: message }
  }

  // Step 2 — child rows for the now-created (pending) org. Each writer is best-effort and no-ops on
  // an empty array. A child failure does NOT undo the pending business, so we DON'T flip the outcome
  // to ok:false; we record which kinds failed and surface them as a truthful `partial` so the user is
  // told the business was created but some profile data did not save (never a silent swallow, never a
  // claim of full success). Each is caught independently so one failing kind still lets the others
  // persist. The raw error rode the writer's own typed throw; here we keep only a bounded kind label.
  const failed: string[] = []
  try {
    await insertBusinessPhotos(supabase, orgId, photos)
  } catch {
    failed.push('photos')
  }
  try {
    await insertBusinessHours(supabase, orgId, hours)
  } catch {
    failed.push('hours')
  }
  try {
    await insertBusinessServices(supabase, orgId, services)
  } catch {
    failed.push('services')
  }

  if (failed.length > 0) {
    return {
      ok: true,
      id: orgId,
      partial: `Your business was submitted, but some details could not be saved (${failed.join(', ')}). You can add them later.`,
    }
  }
  return { ok: true, id: orgId }
}

// ---------------------------------------------------------------------------
// Child-table writers. Called by the submit flow AFTER submitBusiness returns the new org id (RLS
// business_*_owner_all admits the insert only while auth.uid() = the org's submitted_by). Each is a
// batch insert; an empty array is a no-op (no query issued) so the caller need not guard. On a
// Supabase error each throws a typed BusinessWriteError so the form can revert and surface it.
// ---------------------------------------------------------------------------

/** Insert business_hours rows for an org. No-op on an empty array. */
export async function insertBusinessHours(
  supabase: SupabaseClient<Database>,
  orgId: string,
  rows: readonly BusinessHours[]
): Promise<void> {
  if (rows.length === 0) return
  const payload = rows.map((r) => ({
    org_id: orgId,
    day_of_week: r.day_of_week,
    open_time: r.open_time,
    close_time: r.close_time,
  }))
  const { error } = await loose(supabase).from('business_hours').insert(payload).then((r) => r)
  if (error) throw new BusinessWriteError(error.message)
}

/** Insert business_services rows for an org. No-op on an empty array. */
export async function insertBusinessServices(
  supabase: SupabaseClient<Database>,
  orgId: string,
  rows: readonly BusinessService[]
): Promise<void> {
  if (rows.length === 0) return
  const payload = rows.map((r) => ({
    org_id: orgId,
    name: r.name.trim(),
    description: r.description?.trim() || null,
    sort_order: r.sort_order,
  }))
  const { error } = await loose(supabase).from('business_services').insert(payload).then((r) => r)
  if (error) throw new BusinessWriteError(error.message)
}

/** Insert business_photos rows for an org. No-op on an empty array. */
export async function insertBusinessPhotos(
  supabase: SupabaseClient<Database>,
  orgId: string,
  rows: readonly BusinessPhoto[]
): Promise<void> {
  if (rows.length === 0) return
  const payload = rows.map((r) => ({
    org_id: orgId,
    kind: r.kind,
    url: r.url,
    storage_path: r.storage_path,
    sort_order: r.sort_order,
    caption: r.caption ?? null,
  }))
  const { error } = await loose(supabase).from('business_photos').insert(payload).then((r) => r)
  if (error) throw new BusinessWriteError(error.message)
}

// ---------------------------------------------------------------------------
// Child-table readers for the public page + card. RLS business_*_public_select admits a child row
// only when its parent is an approved, active business, so anon/authenticated see exactly the rows
// of a live business. Each is wrapped in a lean wide-event carrying only a bounded result_count.
// ---------------------------------------------------------------------------

/** Read business_hours for an org, ordered by day of week. */
export async function fetchBusinessHours(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<BusinessHours[]> {
  const attrs: Record<string, number> = { result_count: 0 }
  return withMetric('business.hours.fetch', attrs, async () => {
    const { data, error } = await loose(supabase)
      .from('business_hours')
      .select(HOURS_COLUMNS)
      .eq('org_id', orgId)
      .order('day_of_week', { ascending: true })
      .then((r) => r)
    if (error) throw new BusinessReadError(error.message)
    const rows = (data ?? []) as BusinessHours[]
    attrs.result_count = rows.length
    return rows
  })
}

/** Read business_services for an org, ordered by sort_order. */
export async function fetchBusinessServices(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<BusinessService[]> {
  const attrs: Record<string, number> = { result_count: 0 }
  return withMetric('business.services.fetch', attrs, async () => {
    const { data, error } = await loose(supabase)
      .from('business_services')
      .select(SERVICES_COLUMNS)
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .then((r) => r)
    if (error) throw new BusinessReadError(error.message)
    const rows = (data ?? []) as BusinessService[]
    attrs.result_count = rows.length
    return rows
  })
}

/** Read business_photos for an org, ordered by sort_order. */
export async function fetchBusinessPhotos(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<BusinessPhoto[]> {
  const attrs: Record<string, number> = { result_count: 0 }
  return withMetric('business.photos.fetch', attrs, async () => {
    const { data, error } = await loose(supabase)
      .from('business_photos')
      .select(PHOTOS_COLUMNS)
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .then((r) => r)
    if (error) throw new BusinessReadError(error.message)
    const rows = (data ?? []) as BusinessPhoto[]
    attrs.result_count = rows.length
    return rows
  })
}
