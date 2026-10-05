// apps/web/src/lib/org-admin-rpc.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ONE typed boundary for the two platform-admin organization RPCs:
//   admin_save_organization(p_org_id uuid, p_payload jsonb) -> {id, created, removed_photo_paths}
//   admin_set_org_active(p_org_id uuid, p_active boolean)   -> void
// Both run through privilegedRpc so the x-request-id lands in the audit row and the app_logs row.
// The argument objects are checked against the generated Database Args types, so a signature change
// in packages/database/types.ts is a compile error here.
//
// mapSaveError turns a SQLSTATE (42501 denied, 22023 'org_save_invalid:<reason>') into a
// dictionary key the panel renders, so raw database text never reaches the UI.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@feed/database'
import { privilegedRpc } from './privileged-action'
import type { OrgFormMessages } from './i18n-org-forms'

type Rpc = Database['public']['Functions']

export type OrgPhotoPayload = {
  kind: 'logo' | 'cover' | 'gallery'
  url: string
  storage_path: string
  sort_order: number
  caption: string | null
}

/** The admin_save_organization payload for a NON-business org (business keys arrive in PR-B).
 *  A type alias (not an interface) so it is structurally assignable to the generated `Json`. */
export type OrgSavePayload = {
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
  /** Absent = keep the stored point; null = clear it; {lng,lat} = set it. */
  location?: { lng: number; lat: number } | null
  hours: Array<{ day_of_week: number; open_time: string; close_time: string }>
  photos: OrgPhotoPayload[]
  resource_ids: string[]
}

export interface OrgSaveResult {
  id: string
  created: boolean
  removed_photo_paths: string[]
}

export type RpcFailure = { ok: false; code: string | null; errorKey: keyof OrgFormMessages }

function asSaveResult(data: unknown, fallbackId: string): OrgSaveResult {
  const d = (data ?? {}) as Partial<OrgSaveResult>
  return {
    id: typeof d.id === 'string' ? d.id : fallbackId,
    created: d.created === true,
    removed_photo_paths: Array.isArray(d.removed_photo_paths)
      ? d.removed_photo_paths.filter((p): p is string => typeof p === 'string')
      : [],
  }
}

/** SQLSTATE / message -> the dictionary key the panel shows. Never surfaces database text. */
export function mapSaveError(error: { code?: string | null; message?: string | null }): keyof OrgFormMessages {
  const code = error.code ?? null
  const message = (error.message ?? '').toLowerCase()
  if (code === '42501') return 'saveErrDenied'
  if (code === '22023' || message.includes('org_save_invalid')) {
    if (message.includes('photo') || message.includes('logo')) return 'saveErrPhotos'
    if (message.includes('resource')) return 'saveErrResources'
    if (message.includes('hours') || message.includes('interval') || message.includes('24:00')) return 'saveErrHours'
    if (message.includes('location')) return 'saveErrLocation'
    if (message.includes('website')) return 'saveErrWebsite'
    if (message.includes('email')) return 'saveErrEmail'
    if (message.includes('name')) return 'saveErrName'
    return 'saveErrInvalid'
  }
  if (!code && /failed to fetch|network|load failed|timeout/.test(message)) return 'saveErrNetwork'
  return 'saveErrGeneric'
}

/** Create or update one organization atomically. p_org_id is client-generated on create. */
export async function adminSaveOrganization(
  supabase: SupabaseClient<Database>,
  orgId: string,
  payload: OrgSavePayload,
  mode: 'create' | 'edit',
): Promise<{ ok: true; result: OrgSaveResult } | RpcFailure> {
  const location = !('location' in payload) ? 'keep' : payload.location === null ? 'clear' : 'set'
  const args: Rpc['admin_save_organization']['Args'] = { p_org_id: orgId, p_payload: payload satisfies Json }
  const { data, error } = await privilegedRpc<Rpc['admin_save_organization']['Returns']>(
    supabase,
    'admin.org.save',
    'admin_save_organization',
    args,
    {
      target_id: orgId,
      mode,
      org_type: payload.org_type,
      hours_count: payload.hours.length,
      photo_count: payload.photos.length,
      resource_count: payload.resource_ids.length,
      location_op: location,
    },
  )
  if (error) return { ok: false, code: error.code ?? null, errorKey: mapSaveError(error) }
  return { ok: true, result: asSaveResult(data, orgId) }
}

/** Activate / deactivate. Deactivating cancels the org's upcoming and in-progress occurrences. */
export async function adminSetOrgActive(
  supabase: SupabaseClient<Database>,
  orgId: string,
  active: boolean,
): Promise<{ ok: true } | RpcFailure> {
  const args: Rpc['admin_set_org_active']['Args'] = { p_org_id: orgId, p_active: active }
  const { error } = await privilegedRpc<Rpc['admin_set_org_active']['Returns']>(
    supabase,
    'admin.org.set_active',
    'admin_set_org_active',
    args,
    { target_id: orgId, active },
  )
  if (error) return { ok: false, code: error.code ?? null, errorKey: mapSaveError(error) }
  return { ok: true }
}
