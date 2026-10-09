// apps/web/src/app/(admin)/moderation/resource-focus-read.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Manage tab's by-id read for an "Edit in admin" link. The list (admin_list_resources) is paged
// 100 at a time by name and searches name/description only, so a linked resource is usually not on
// the first page: the tab reads the one row by id instead. Same predicate as the list — approved
// only — through the RLS policy "Approved resources are viewable by everyone" (the same read
// lib/map-focus.ts uses for the members' map). A pending or rejected id, or a missing one, is null:
// the Manage tab lists and edits approved resources only.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { parseGeographyPoint } from '@/lib/business'

/** One Manage-list row (the admin_list_resources shape the cards and the edit dialog use). */
export interface ManageResourceRow {
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
}

export const FOCUS_RESOURCE_COLUMNS =
  'id, name, description, category, address_line1, city, state, zip_code, phone, email, website, status, ' +
  'source, is_verified, moderated_at, location, service_mode, geocode_accuracy'

type Row = Record<string, unknown>
interface FocusQuery {
  abortSignal(signal: AbortSignal): FocusQuery
  eq(column: string, value: unknown): FocusQuery
  maybeSingle(): PromiseLike<{ data: Row | null; error: unknown }>
}
interface FocusClient {
  from(table: string): { select(columns: string): FocusQuery }
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** The approved resource `id` as a Manage row, or null (missing, not approved, or a failed read). */
export async function readFocusResource(
  supabase: SupabaseClient<Database>,
  id: string,
  signal: AbortSignal
): Promise<ManageResourceRow | null> {
  try {
    const { data, error } = await (supabase as unknown as FocusClient)
      .from('resources')
      .select(FOCUS_RESOURCE_COLUMNS)
      .abortSignal(signal)
      .eq('id', id)
      .eq('status', 'approved')
      .maybeSingle()
    if (error || !data || typeof data.id !== 'string' || typeof data.name !== 'string') return null
    const point = parseGeographyPoint(data.location as Parameters<typeof parseGeographyPoint>[0])
    return {
      id: data.id,
      name: data.name,
      description: str(data.description),
      category: str(data.category) ?? 'other',
      address_line1: str(data.address_line1),
      city: str(data.city),
      state: str(data.state),
      zip_code: str(data.zip_code),
      phone: str(data.phone),
      email: str(data.email),
      website: str(data.website),
      status: str(data.status) ?? 'approved',
      source: str(data.source),
      is_verified: typeof data.is_verified === 'boolean' ? data.is_verified : null,
      moderated_at: str(data.moderated_at),
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      service_mode: str(data.service_mode) ?? 'physical',
      geocode_accuracy: str(data.geocode_accuracy),
    }
  } catch {
    return null
  }
}
