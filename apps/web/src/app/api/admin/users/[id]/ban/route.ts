import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { decideUserAction, type AdminTier } from '@/lib/admin-tier'

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
//
// P3.1: platform-admin only; T3 (cannot ban an equal/higher tier or self); every attempt —
// allowed or denied — writes exactly one admin_actions row (service role), sharing the
// proxy-stamped x-request-id with the app_logs telemetry.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rid = (await headers()).get('x-request-id') ?? undefined
  const target = (await params).id
  const actorTierRes = await supabase.rpc('current_user_tier')
  const actorTier = (actorTierRes.data as AdminTier | null) ?? null

  const adminClient = getAdminClient()

  const audit = (
    outcome: 'ok' | 'denied' | 'error',
    action: string,
    reason: string | null,
    details: Record<string, unknown>
  ) =>
    adminClient.rpc('record_admin_action', {
      p_actor: user.id,
      p_action: action,
      p_target_type: 'user',
      p_target_id: target,
      p_outcome: outcome,
      p_reason: reason,
      p_details: details,
      p_request_id: rid ?? null,
    })

  // Fetch target tier for T3.
  const { data: targetRow } = await adminClient
    .from('profiles')
    .select('admin_tier')
    .eq('id', target)
    .single()
  const targetTier = (targetRow?.admin_tier as AdminTier | null) ?? null

  const body = await req.json().catch(() => ({}))
  const ban_duration: string = body.ban_duration ?? 'none'
  const action = ban_duration === 'none' ? 'user.unban' : 'user.ban'

  // Actor gate + T3.
  const decision = decideUserAction(actorTier, targetTier, user.id, target)
  if (!decision.allowed) {
    await audit('denied', action, decision.code ?? 'denied', { ban_duration })
    logger.warn('admin.user.ban.denied', {
      actor_tier: actorTier, target_id: target, outcome: 'denied', code: decision.code ?? 'denied', request_id: rid ?? null,
    })
    const status = decision.code === 'self' ? 400 : 403
    return NextResponse.json({ error: 'Forbidden', code: decision.code }, { status })
  }

  const { error } = await adminClient.auth.admin.updateUserById(
    target,
    { ban_duration } as Parameters<typeof adminClient.auth.admin.updateUserById>[1]
  )

  if (error) {
    await audit('error', action, error.message, { ban_duration })
    logger.error('admin.user.ban.failed', { target_id: target, ban_duration, outcome: 'error', error: error.message, request_id: rid ?? null })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await audit('ok', action, null, { ban_duration })
  logger.info(action === 'user.unban' ? 'admin.user.unban' : 'admin.user.ban', {
    actor_tier: actorTier, target_id: target, ban_duration, outcome: 'ok', request_id: rid ?? null,
  })
  return NextResponse.json({ success: true, action: ban_duration === 'none' ? 'unban' : 'ban' })
}
