// apps/web/src/app/(admin)/moderation/org-members-data.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Roster reads and writes for ONE organization. Every statement is filtered by that organization's
// id, so a member id from another organization matches no row. RLS is the authority: members are
// readable by the organization's members and platform admins; every write is platform-admin only
// (org_members_{insert,update,delete}_platform_admin).

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

/** The organization's roster. Throws on a read error so the caller can show it. */
export async function fetchOrgMembers(supabase: Client, orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, user_id, role, joined_at')
    .eq('org_id', orgId)
    .order('joined_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as OrgMember[]
}

/** null on success, else the message to show. */
export async function addOrgMember(
  supabase: Client,
  orgId: string,
  userId: string,
  role: MemberRole,
  invitedBy: string | null
): Promise<string | null> {
  const { error } = await supabase.from('organization_members').insert({
    org_id: orgId,
    user_id: userId,
    role,
    invited_by: invitedBy,
  })
  return error ? error.message : null
}

/** null on success, else the message to show (0 rows = refused or already gone). */
export async function removeOrgMember(supabase: Client, orgId: string, memberId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('org_id', orgId)
    .select('id')
  if (error) return error.message
  if (!data || data.length === 0) {
    return 'Could not remove that member — you may not have permission, or they were already removed.'
  }
  return null
}

/** null on success, else the message to show (0 rows = refused). */
export async function changeOrgMemberRole(
  supabase: Client,
  orgId: string,
  memberId: string,
  role: MemberRole
): Promise<string | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('id', memberId)
    .eq('org_id', orgId)
    .select('id')
  if (error) return error.message
  if (!data || data.length === 0) return 'Could not change that role — you may not have permission.'
  return null
}
