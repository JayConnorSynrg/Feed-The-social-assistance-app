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

// POST /api/admin/users/[id]/ban
// Body: { ban_duration: 'none' | '24h' | '168h' | '720h' | '876000h' }
// 'none' = unban; '876000h' = effectively permanent
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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
    logger.error('[admin:users] ban_user unauthorized attempt', { actorId: user.id })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: targetId } = await params

  if (targetId === user.id) {
    return NextResponse.json({ error: 'Cannot modify your own account status' }, { status: 400 })
  }

  const body = await req.json()
  const ban_duration: string = body.ban_duration ?? 'none'

  const adminClient = getAdminClient()
  const { error } = await adminClient.auth.admin.updateUserById(targetId, { ban_duration } as Parameters<typeof adminClient.auth.admin.updateUserById>[1])

  if (error) {
    logger.error('[admin:users] ban_user failed', { targetId, ban_duration, error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const action = ban_duration === 'none' ? 'unban' : 'ban'
  logger.info('[admin:users] ban_user success', { targetId, ban_duration, action, adminId: user.id })
  return NextResponse.json({ success: true, action })
}
