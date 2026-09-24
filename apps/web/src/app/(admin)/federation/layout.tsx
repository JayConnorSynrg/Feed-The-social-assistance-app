import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// The (admin) group layout admits BOTH platform admins and non-platform org admins (the
// latter reach only the events surface at /moderation). Federation is a platform-only
// surface, so this nested layout tightens the gate: a non-platform org admin who navigates
// to /federation/* is redirected back to their events surface. Platform admins pass through.
export default async function FederationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: isAdmin } = await supabase.rpc('is_current_user_admin')
  if (isAdmin !== true) {
    redirect('/moderation')
  }

  return <>{children}</>
}
