import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// DELETE /api/admin/users/[id]/delete
// Permanently deletes a user account (auth + cascades to profiles via trigger)
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    logger.error('[admin:users] delete_user unauthorized attempt', { actorId: user.id })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const targetId = params.id

  if (targetId === user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const adminClient = getAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(targetId)

  if (error) {
    logger.error('[admin:users] delete_user failed', { targetId, error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logger.info('[admin:users] delete_user success', { targetId, adminId: user.id })
  return NextResponse.json({ success: true })
}
