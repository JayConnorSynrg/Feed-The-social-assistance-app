// apps/web/src/lib/org-data.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Supabase READERS for NON-business organizations — the sibling of business-data.ts. An
// organization is a row in the same `organizations` table with a non-'business' org_type (see
// org-vocab.ts); it is public as soon as is_active=true (orgs_select_active has no approval gate
// for non-business rows). loose() confines the generic-erasure escape hatch here, and every read is
// wrapped in withMetric with bounded, PII-free labels (result counts only).
//
// The public-page readers (fetchOrganizationById + fetchOrgResources) back the anon SSR
// /s/organization/[id] page; fetchApprovedOrganizations + organizationsInBounds back the
// Organizations feed subtab and the org map layer.
//
// Admin writes no longer live here: every create/update goes through the atomic
// admin_save_organization RPC (org-admin-rpc.ts). This module keeps the READERS, including the
// admin list/detail readers behind the moderation Organizations tab and its edit panel.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { withMetric } from './logger'
import { NON_BUSINESS_ORG_TYPES } from './org-vocab'
import { fetchBusinessHours, fetchBusinessPhotos } from './business-data'
import { parseGeographyPoint, type BusinessHours, type BusinessPhoto } from './business'
import { trimSeconds, minutesOf } from '@/components/org-form/hours-model'
import type { ResourceCategory } from './resource-directory'

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

/** A row returned by the organizations_in_bounds SECDEF RPC (its TABLE result shape). */
export interface OrgInBoundsRow {
  id: string
  name: string
  description: string | null
  org_type: string
  address: string | null
  city: string | null
  state: string | null
  phone: string | null
  website: string | null
  location: string | { coordinates?: [number, number] } | null
  resource_id: string | null
}

/** Map viewport bounds (west/south/east/north), matching business-data.ts's Bounds. */
export interface Bounds {
  west: number
  south: number
  east: number
  north: number
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

// Minimal structural view of the query builder (the geography column and the org-admin tables are
// not fully in the generated types). Confined to this module; callers stay fully typed.
type LooseResult<T> = Promise<{ data: T | null; error: { message: string } | null }>
interface LooseBuilder {
  select: (cols: string) => LooseBuilder
  eq: (col: string, val: unknown) => LooseBuilder
  in: (col: string, vals: readonly unknown[]) => LooseBuilder
  order: (col: string, opts?: { ascending?: boolean }) => LooseBuilder
  single: () => LooseResult<Record<string, unknown>>
  then: <R>(cb: (r: { data: unknown; error: { message: string } | null }) => R) => Promise<R>
}
interface LooseClient {
  from: (table: string) => LooseBuilder
  rpc: (name: string, args: Record<string, unknown>) => LooseResult<unknown[]>
}

function loose(supabase: SupabaseClient<Database>): LooseClient {
  return supabase as unknown as LooseClient
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

/**
 * Public directory reader — every ACTIVE NON-business org, ordered by name. is_active alone gates
 * visibility (orgs_select_active admits a non-business row whenever is_active=true, with no approval
 * step), so this is the public "approved" set the Organizations subtab renders. The .in() filter to
 * the nine non-business org_types is INV-J's disjointness guard at the app layer: a 'business' row can
 * never satisfy it, so businesses never appear in the org list (RLS is the DB-side backstop). Selects
 * explicit columns (ORG_COLUMNS), never *. Throws OrgReadError so the caller can surface load failure.
 */
export async function fetchApprovedOrganizations(
  supabase: SupabaseClient<Database>,
): Promise<Organization[]> {
  const attrs: Record<string, number> = { result_count: 0 }
  return withMetric('organization.list.fetch', attrs, async () => {
    const { data, error } = await loose(supabase)
      .from('organizations')
      .select(ORG_COLUMNS)
      .in('org_type', [...NON_BUSINESS_ORG_TYPES])
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then((r) => r)
    if (error) throw new OrgReadError(error.message)
    const rows = (data ?? []) as Organization[]
    attrs.result_count = rows.length
    return rows
  })
}

/** One row of the platform-admin Organizations list. */
export interface AdminOrgListRow {
  id: string
  name: string
  org_type: string
  city: string | null
  state: string | null
  is_active: boolean
}

// Admin-list projection — exactly what a list row renders (explicit, never *).
const ADMIN_LIST_COLUMNS = 'id, name, org_type, city, state, is_active'

/**
 * Admin list reader — EVERY NON-business org, active OR inactive, ordered by name. Drops the
 * is_active gate (an admin manages inactive orgs too) but keeps the disjointness guard: the .in()
 * filter to the nine non-business org_types, so a business never appears in this tab (RLS
 * orgs_admin_select is the DB-side backstop). Throws OrgReadError so the caller renders an error
 * state instead of an empty list.
 */
export async function fetchAdminOrgList(
  supabase: SupabaseClient<Database>,
): Promise<AdminOrgListRow[]> {
  const attrs: Record<string, number> = { result_count: 0 }
  return withMetric('organization.roster.fetch', attrs, async () => {
    const { data, error } = await loose(supabase)
      .from('organizations')
      .select(ADMIN_LIST_COLUMNS)
      .in('org_type', [...NON_BUSINESS_ORG_TYPES])
      .order('name', { ascending: true })
      .then((r) => r)
    if (error) throw new OrgReadError(error.message)
    const rows = (data ?? []) as AdminOrgListRow[]
    attrs.result_count = rows.length
    return rows
  })
}

/** A linked resource as the edit panel shows it (the ResourceDirectory selection shape). */
export interface AdminLinkedResource {
  id: string
  name: string
  category: ResourceCategory
  city: string | null
  state: string | null
  /** The resource's moderation status — anything but 'approved' can no longer be linked. */
  status: string
}

/** Everything the edit panel prefills: the org row (active or not), its hours, photos and links. */
export interface AdminOrgDetail {
  id: string
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
  is_active: boolean
  location: { lng: number; lat: number } | null
  hours: BusinessHours[]
  photos: BusinessPhoto[]
  resources: AdminLinkedResource[]
}

const ADMIN_DETAIL_COLUMNS =
  'id, name, org_type, description, address, city, state, zip_code, phone, email, website, location, is_active'
const ADMIN_LINK_COLUMNS = 'sort_order, resource:resources(id, name, category, city, state, status)'

/** Hours ordered by day, then opening time, with seconds trimmed (Postgres returns HH:MM:SS). */
export function orderLoadedHours(rows: readonly BusinessHours[]): BusinessHours[] {
  return rows
    .map((r) => ({ day_of_week: r.day_of_week, open_time: trimSeconds(r.open_time), close_time: trimSeconds(r.close_time) }))
    .sort((a, b) => a.day_of_week - b.day_of_week || (minutesOf(a.open_time) ?? 0) - (minutesOf(b.open_time) ?? 0))
}

/**
 * Admin detail reader for the edit panel — one NON-business org by id, ACTIVE OR INACTIVE, plus its
 * hours, photos and linked resources (admin RLS *_admin_all policies admit every child row). The
 * location arrives as EWKB and is parsed to {lng,lat}. Returns null for a missing id or a business.
 */
export async function fetchAdminOrgDetail(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<AdminOrgDetail | null> {
  const attrs: Record<string, number> = { result_count: 0 }
  return withMetric('organization.admin_detail.fetch', attrs, async () => {
    const { data, error } = await loose(supabase)
      .from('organizations')
      .select(ADMIN_DETAIL_COLUMNS)
      .eq('id', id)
      .in('org_type', [...NON_BUSINESS_ORG_TYPES])
      .single()
    if (error || !data) return null
    const org = data as unknown as Omit<AdminOrgDetail, 'location' | 'hours' | 'photos' | 'resources'> & {
      location: Organization['location']
    }
    const [hours, photos, links] = await Promise.all([
      fetchBusinessHours(supabase, id),
      fetchBusinessPhotos(supabase, id),
      loose(supabase)
        .from('org_resources')
        .select(ADMIN_LINK_COLUMNS)
        .eq('org_id', id)
        .order('sort_order', { ascending: true })
        .then((r) => r),
    ])
    if (links.error) throw new OrgReadError(links.error.message)
    const resources = ((links.data ?? []) as Array<{ resource: AdminLinkedResource | null }>)
      .map((r) => r.resource)
      .filter((r): r is AdminLinkedResource => r != null)
    attrs.result_count = 1
    return {
      ...org,
      location: parseGeographyPoint(org.location),
      hours: orderLoadedHours(hours),
      photos,
      resources,
    }
  })
}

/** One entry of the duplicate-name index (every org the admin can read, business included). */
export interface OrgNameIndexRow {
  id: string
  name: string
  org_type: string
  status: string | null
}

/** Load every org name once per panel open, for the duplicate-name warning. */
export async function fetchOrgNameIndex(
  supabase: SupabaseClient<Database>,
): Promise<OrgNameIndexRow[]> {
  const attrs: Record<string, number> = { result_count: 0 }
  return withMetric('organization.name_index.fetch', attrs, async () => {
    const { data, error } = await loose(supabase)
      .from('organizations')
      .select('id, name, org_type, status')
      .order('name', { ascending: true })
      .then((r) => r)
    if (error) throw new OrgReadError(error.message)
    const rows = (data ?? []) as OrgNameIndexRow[]
    attrs.result_count = rows.length
    return rows
  })
}

/**
 * Map bbox reader — active, located, NON-business orgs via the organizations_in_bounds SECDEF RPC
 * (the sole reader the migration exposes for the org map layer). The RPC predicate is_active=true AND
 * org_type<>'business' AND location IS NOT NULL AND bbox is authoritative (INV-K): a business, an
 * inactive org, or a located-but-inactive org is never returned. Arg names are the RPC's own.
 */
export async function organizationsInBounds(
  supabase: SupabaseClient<Database>,
  bounds: Bounds,
  maxResults = 500,
): Promise<OrgInBoundsRow[]> {
  const attrs: Record<string, number> = { result_count: 0 }
  return withMetric('map.orgs_in_bounds', attrs, async () => {
    const { data, error } = await loose(supabase).rpc('organizations_in_bounds', {
      min_lng: bounds.west,
      min_lat: bounds.south,
      max_lng: bounds.east,
      max_lat: bounds.north,
      max_results: maxResults,
    })
    if (error) throw new OrgReadError(error.message)
    const rows = (data ?? []) as OrgInBoundsRow[]
    attrs.result_count = rows.length
    return rows
  })
}
