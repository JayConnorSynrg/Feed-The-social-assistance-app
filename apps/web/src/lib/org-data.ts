// apps/web/src/lib/org-data.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The controlled Supabase WRITE boundary for NON-business organizations — the admin-intake sibling of
// business-data.ts. An organization is a row in the same `organizations` table with a non-'business'
// org_type (see org-vocab.ts); it is public as soon as is_active=true (the orgs_select_active RLS
// predicate has no approval gate for non-business rows).
//
// This module follows business-data.ts's pattern exactly:
//   * loose() confines the generic-erasure escape hatch HERE (the geography location column write is
//     not yet in the generated types.ts — that regen is deferred to a prod-apply), so callers stay
//     fully typed and never touch `as any` at the call site.
//   * each write is wrapped in withMetric with a bounded, PII-free label set (closed vocabulary:
//     only counts, booleans, and the closed-vocab org_type value — never a name/email/address/url/uid).
//
// The public-page READERS now live here: fetchOrganizationById + fetchOrgResources back the anon SSR
// /s/organization/[id] page (the anon read path for email/phone/website is grant-verified). The map/
// list readers (organizationsInBounds, fetchApprovedOrganizations) are still deferred to W5 alongside
// their map/subtab consumers, so they live nowhere until then.
//
// Two invariants live here as pure, unit-testable functions:
//   * INV-B (never business): buildOrgInsertPayload throws for org_type='business' or any value
//     outside org-vocab, so no admin-create code path can persist a business row.
//   * INV-D (one row per linked resource): buildOrgResourceRows emits exactly one row per distinct
//     resource id (the org_resources PK (org_id,resource_id) is the DB-side backstop).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { withMetric } from './logger'
import { normalizeUrl } from './utils/url'
import { NON_BUSINESS_ORG_TYPES, isNonBusinessOrgType } from './org-vocab'

/**
 * Typed read error so the withMetric error_code label buckets by kind (OrgReadError) instead of the
 * generic "Error". No PII in the name; the raw Supabase message rides in withMetric's error_message
 * field, never in a bounded label. Mirrors business-data.ts's BusinessReadError.
 */
export class OrgReadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrgReadError'
  }
}

/**
 * Typed write error so the withMetric error_code label buckets by kind (OrgWriteError) instead of the
 * generic "Error". No PII in the name; the raw Supabase message rides in withMetric's error_message
 * field, never in a bounded label. Mirrors business-data.ts's BusinessWriteError.
 */
export class OrgWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrgWriteError'
  }
}

// Column projection for a directory org — the exact columns the public /s/organization page renders
// (explicit, never *). status is intentionally omitted: a non-business org has no approval gate, so
// is_active alone governs public visibility (orgs_select_active).
const ORG_COLUMNS =
  'id, name, description, org_type, address, city, state, zip_code, phone, email, website, location, resource_id, is_active'

// The catalog fields a linked resource exposes on an org profile. Bounded, display-facing projection
// via the org_resources → resources embed; sort_order fixes the curator-set display order.
const ORG_RESOURCE_COLUMNS =
  'sort_order, resource:resources(id, name, category, description, address_line1, city, state, phone, website, service_mode, status)'

/** A directory organization (non-business). location is the PostGIS GEOGRAPHY (EWKB hex or GeoJSON). */
export interface Organization {
  id: string
  name: string
  description: string | null
  org_type: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  email: string | null
  website: string | null
  location: string | { coordinates?: [number, number] } | null
  resource_id: string | null
  is_active: boolean
}

/** A catalog resource linked to an org (the join target of org_resources → resources). */
export interface OrgLinkedResource {
  id: string
  name: string
  category: string
  description: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  phone: string | null
  website: string | null
  service_mode: string
  status: string
}

// Minimal structural view of the query builder for the geography write not yet in the generated
// types. Confined to this module; callers never see it (same discipline as business-data.ts's loose()).
type LooseResult<T> = Promise<{ data: T | null; error: { message: string } | null }>
interface LooseBuilder {
  select: (cols: string) => LooseBuilder
  insert: (rows: Record<string, unknown> | Record<string, unknown>[]) => LooseBuilder
  update: (patch: Record<string, unknown>) => LooseBuilder
  eq: (col: string, val: unknown) => LooseBuilder
  in: (col: string, vals: readonly unknown[]) => LooseBuilder
  order: (col: string, opts?: { ascending?: boolean }) => LooseBuilder
  single: () => LooseResult<Record<string, unknown>>
  then: <R>(cb: (r: { data: unknown; error: { message: string } | null }) => R) => Promise<R>
}
interface LooseClient {
  from: (table: string) => LooseBuilder
}

function loose(supabase: SupabaseClient<Database>): LooseClient {
  return supabase as unknown as LooseClient
}

// ---------------------------------------------------------------------------
// Pure builders (unit-testable; no Supabase, no browser globals) — the two invariants live here.
// ---------------------------------------------------------------------------

/** Fields the admin intake form fills in on an org create. org_type is validated against org-vocab. */
export interface NewOrgInput {
  name: string
  org_type: string
  description?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  createdBy: string | null
  /**
   * Geocoded location as an EWKT string 'SRID=4326;POINT(<lng> <lat>)', or null/undefined when the
   * org has no address or the geocode failed (INV-C — a failed geocode never fabricates a point).
   */
  location?: string | null
}

/** The exact row written to organizations on an admin org create. */
export interface OrgInsertRow {
  name: string
  org_type: string
  description: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  email: string | null
  website: string | null
  is_active: true
  created_by: string | null
}

/**
 * Build the organizations insert row from admin intake, enforcing INV-B: the org_type MUST be one of
 * the nine non-business types (org-vocab). A 'business' value — or any value outside the vocabulary —
 * throws before any query is issued, so the admin path can never persist a business row. is_active is
 * pinned true so the created org is publicly SELECT-able immediately (INV-A); website runs through the
 * same normalizeUrl helper the rest of the app uses so a stored href is always safe/absolute.
 */
export function buildOrgInsertPayload(input: NewOrgInput): OrgInsertRow {
  if (!isNonBusinessOrgType(input.org_type)) {
    throw new OrgWriteError(
      `Admin org create is non-business only; refusing org_type "${input.org_type}"`,
    )
  }
  return {
    name: input.name.trim(),
    org_type: input.org_type,
    description: input.description?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    zip_code: input.zip_code?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    website: normalizeUrl(input.website),
    is_active: true,
    created_by: input.createdBy,
  }
}

/** One org_resources row (matching the live table: org_id, resource_id, sort_order). */
export interface OrgResourceRow {
  org_id: string
  resource_id: string
  sort_order: number
}

/**
 * Build the org_resources rows for a set of selected catalog resources, enforcing INV-D: exactly one
 * row per DISTINCT resource id, sort_order assigned by first-seen position. A repeated id is dropped
 * (the org_resources PK (org_id,resource_id) is the DB-side backstop, so a duplicate would 23505
 * anyway) — so a selection of N distinct resources yields N rows, and deselecting an id removes
 * exactly that one row's contribution.
 */
export function buildOrgResourceRows(orgId: string, resourceIds: readonly string[]): OrgResourceRow[] {
  const seen = new Set<string>()
  const rows: OrgResourceRow[] = []
  for (const resourceId of resourceIds) {
    if (seen.has(resourceId)) continue
    seen.add(resourceId)
    rows.push({ org_id: orgId, resource_id: resourceId, sort_order: rows.length })
  }
  return rows
}

/** Build the EWKT geography literal PostgREST accepts for organizations.location. */
export function ewktPoint(lng: number, lat: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`
}

// ---------------------------------------------------------------------------
// Public readers — anon-safe SSR reads for the public /s/organization page. Each is wrapped in a lean
// wide-event carrying only bounded, PII-free labels (a result_count). The anon role holds column-level
// SELECT on every projected organizations column (email/phone/website included) and table SELECT on
// org_resources + resources, so a logged-out visitor's read returns the full rendered shape.
// ---------------------------------------------------------------------------

/**
 * Public single-org reader by id — active NON-business only. Filtering to the nine non-business
 * org_types AND is_active=true means a business id, an inactive org, or a missing id resolves to null,
 * so the page can notFound() (INV-F). RLS (orgs_select_active) enforces the same gate at the DB, so
 * this filter is the app-layer mirror of the policy, not the sole guard. Selects explicit columns
 * (ORG_COLUMNS), never *. Returns null on any error/miss so the caller never renders a partial page.
 */
export async function fetchOrganizationById(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<Organization | null> {
  const attrs: Record<string, number> = { result_count: 0 }
  return withMetric('org.read.by_id', attrs, async () => {
    const { data, error } = await loose(supabase)
      .from('organizations')
      .select(ORG_COLUMNS)
      .eq('id', id)
      .in('org_type', [...NON_BUSINESS_ORG_TYPES])
      .eq('is_active', true)
      .single()
    if (error || !data) return null
    attrs.result_count = 1
    return data as unknown as Organization
  })
}

/**
 * Read the catalog resources linked to an org, ordered by the curator-set sort_order (INV-H). RLS
 * (org_resources_public_select + resources' own public select) admits only visible rows, so a
 * logged-out visitor sees exactly the org's linked, publicly-visible resources. A null embed (a linked
 * resource RLS hides) is dropped so the list never carries a dangling entry.
 */
export async function fetchOrgResources(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<OrgLinkedResource[]> {
  const attrs: Record<string, number> = { result_count: 0 }
  return withMetric('org.resources.fetch', attrs, async () => {
    const { data, error } = await loose(supabase)
      .from('org_resources')
      .select(ORG_RESOURCE_COLUMNS)
      .eq('org_id', orgId)
      .order('sort_order', { ascending: true })
      .then((r) => r)
    if (error) throw new OrgReadError(error.message)
    const rows = ((data ?? []) as Array<{ resource: OrgLinkedResource | null }>)
      .map((r) => r.resource)
      .filter((r): r is OrgLinkedResource => r != null)
    attrs.result_count = rows.length
    return rows
  })
}

// ---------------------------------------------------------------------------
// Admin writers — authorized by orgs_admin_insert / orgs_admin_update (is_current_user_admin()).
// ---------------------------------------------------------------------------

/**
 * Truthful outcome of an admin org create (mirrors business-data's SubmitOutcome discipline):
 *  - { ok:true, id, locationSet, warning? } — the org row persisted; locationSet says whether the
 *    geocoded point was written; warning is a bounded, PII-free message when the org was created but
 *    its location UPDATE failed (never a silent swallow, never a claim the pin was placed).
 *  - { ok:false, error } — the insert (or the INV-B guard) rejected; nothing persisted.
 */
export type OrgCreateOutcome =
  | { ok: true; id: string; locationSet: boolean; warning?: string }
  | { ok: false; error: string }

/**
 * Create a directory organization as a platform admin. The org insert is wrapped in the single
 * org.admin.upsert wide event (.complete on success, .error on the INV-B guard throw or an insert
 * failure). When input.location is present it is written via the direct admin UPDATE
 * (orgs_admin_update authorizes it) AFTER the insert — a location-write failure does NOT undo the
 * created org, so it is surfaced as a truthful warning rather than flipping the outcome to error
 * (INV-C keeps a failed geocode's null location distinct from a wrong point). Never throws — the
 * non-throwing outcome lets the caller's form revert/surface without hanging.
 */
export async function adminCreateOrganization(
  supabase: SupabaseClient<Database>,
  input: NewOrgInput,
): Promise<OrgCreateOutcome> {
  // Bounded, PII-free labels only: the closed-vocab org_type value plus booleans describing the
  // SHAPE of the submission — never the name/email/address/url/user_id.
  const attrs = {
    org_type: input.org_type,
    has_address: Boolean(input.address?.trim()),
    has_location: input.location != null,
    has_contact: Boolean(input.phone?.trim() || input.email?.trim() || input.website?.trim()),
  }
  try {
    return await withMetric('org.admin.upsert', attrs, async () => {
      // INV-B: buildOrgInsertPayload throws for 'business'/unknown before any query is issued.
      const payload = buildOrgInsertPayload(input)
      const { data, error } = await loose(supabase)
        .from('organizations')
        .insert(payload as unknown as Record<string, unknown>)
        .select('id')
        .single()
      if (error) throw new OrgWriteError(error.message)
      const orgId = typeof data?.id === 'string' ? data.id : null
      if (!orgId) throw new OrgWriteError('Organization did not persist')

      let locationSet = false
      let warning: string | undefined
      if (input.location) {
        const { error: locErr } = await loose(supabase)
          .from('organizations')
          .update({ location: input.location })
          .eq('id', orgId)
          .then((r) => r)
        if (locErr) {
          warning = 'The organization was created, but its map location could not be saved.'
        } else {
          locationSet = true
        }
      }
      return { ok: true as const, id: orgId, locationSet, warning }
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Create failed' }
  }
}

/**
 * Link a set of catalog resources to an org (INV-D). Builds exactly one row per distinct resource id
 * and batch-inserts them (org_resources_admin_all authorizes it), wrapped in org.resources.attach.
 * No-op on an empty selection. Throws OrgWriteError on a Supabase failure so the caller can surface
 * the partial-failure honestly.
 */
export async function attachOrgResources(
  supabase: SupabaseClient<Database>,
  orgId: string,
  resourceIds: readonly string[],
): Promise<void> {
  const rows = buildOrgResourceRows(orgId, resourceIds)
  if (rows.length === 0) return
  await withMetric('org.resources.attach', { resource_count: rows.length }, async () => {
    const { error } = await loose(supabase)
      .from('org_resources')
      .insert(rows as unknown as Record<string, unknown>[])
      .then((r) => r)
    if (error) throw new OrgWriteError(error.message)
  })
}
