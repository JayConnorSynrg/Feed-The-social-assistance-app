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

  // Use SECURITY DEFINER RPC — enforces own-row access at the Postgres layer.
  // After PII hardening revokes direct is_admin column reads from authenticated role,
  // this RPC remains the only supported gate for admin status.
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin')

  if (!isAdmin) {
    redirect('/')
  }

  return <>{children}</>
}
