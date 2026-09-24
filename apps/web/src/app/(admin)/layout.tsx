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
  // revoked direct is_admin column reads, these RPCs are the only supported gate. A
  // platform admin reaches the full shell; a non-platform-admin who administers at least
  // one org reaches it too (the shell then shows only the Events tab, scoped to their orgs).
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin')
  let allowed = isAdmin === true
  if (!allowed) {
    const { data: isOrgAdmin } = await supabase.rpc('is_org_admin_any')
    allowed = isOrgAdmin === true
  }

  if (!allowed) {
    redirect('/')
  }

  return <>{children}</>
}
