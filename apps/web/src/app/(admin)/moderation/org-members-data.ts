// apps/web/src/app/(admin)/moderation/org-members-data.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Roster reads and writes for ONE organization. Every statement is filtered by that organization's
// id, so a member id from another organization matches no row. RLS is the authority: members are
// readable by the organization's members and platform admins; every write is platform-admin only
// (org_members_{insert,update,delete}_platform_admin).
// A failure is returned (or thrown) as a CODE — PostgREST's SQLSTATE, or 'no_rows' for a write that
// matched nothing — never as server text: the roster maps the code to a sentence in the admin's
// language (lib/i18n-org-admin.ts) and logs only the code.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'

export type MemberRole = 'admin' | 'member'

export interface OrgMember {
  id: string
  user_id: string
  role: string
  joined_at: string
}

type Client = SupabaseClient<Database>

/** A failed roster write: the code the caller maps to a sentence ('no_rows' = refused or gone). */
export type RosterFailure = string

const codeOf = (error: { code?: string | null }): RosterFailure => error.code || 'unknown'

/** The organization's roster. Throws on a read error (carrying only its code) so the caller can show it. */
export async function fetchOrgMembers(supabase: Client, orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, user_id, role, joined_at')
    .eq('org_id', orgId)
    .order('joined_at', { ascending: true })
  if (error) throw Object.assign(new Error('organization_members read failed'), { code: codeOf(error) })
  return (data ?? []) as OrgMember[]
}

/** null on success, else the failure code. */
export async function addOrgMember(
  supabase: Client,
  orgId: string,
  userId: string,
  role: MemberRole,
  invitedBy: string | null
): Promise<RosterFailure | null> {
  const { error } = await supabase.from('organization_members').insert({
    org_id: orgId,
    user_id: userId,
    role,
    invited_by: invitedBy,
  })
  return error ? codeOf(error) : null
}

/** null on success, else the failure code (0 rows = refused or already gone: 'no_rows'). */
export async function removeOrgMember(supabase: Client, orgId: string, memberId: string): Promise<RosterFailure | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('org_id', orgId)
    .select('id')
  if (error) return codeOf(error)
  if (!data || data.length === 0) return 'no_rows'
  return null
}

/** null on success, else the failure code (0 rows = refused: 'no_rows'). */
export async function changeOrgMemberRole(
  supabase: Client,
  orgId: string,
  memberId: string,
  role: MemberRole
): Promise<RosterFailure | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('id', memberId)
    .eq('org_id', orgId)
    .select('id')
  if (error) return codeOf(error)
  if (!data || data.length === 0) return 'no_rows'
  return null
}
