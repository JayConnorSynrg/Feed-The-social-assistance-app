import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Use SECURITY DEFINER RPCs — enforce access at the Postgres layer. After PII hardening
  // revoked direct is_admin column reads, these RPCs are the only supported gate. Any tier
  // (P3.1: Community Moderator, Resource Admin, or Platform Admin) reaches the shell; a
  // non-tier user who administers at least one org reaches it too (the shell then shows only
  // the Events tab, scoped to their orgs). This group layout admits both; the platform-only
  // surfaces tighten the gate in their own nested layouts (see federation/layout.tsx),
  // redirecting lower tiers / org admins back to /moderation.
  const { data: tier } = await supabase.rpc('current_user_tier')
  let allowed = tier != null
  if (!allowed) {
    const { data: isOrgAdmin } = await supabase.rpc('is_org_admin_any')
    allowed = isOrgAdmin === true
  }

  if (!allowed) {
    redirect('/')
  }

  return <>{children}</>
}
