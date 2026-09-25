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
// Body: { ban_duration: 'none' | '24h' | '168h' | '720h' | '876000h' }  ('none' = unban)
//
// P3.1: platform-admin only; T3 (cannot ban an equal/higher tier or self); every attempt —
// allowed, denied, or error — writes exactly one admin_actions row (service role) carrying the
// client's x-request-id. Fails CLOSED (500) if the target-tier lookup errors.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rid = (await headers()).get('x-request-id') ?? undefined
  const target = (await params).id
  const actorTierRes = await supabase.rpc('current_user_tier')
  const actorTier = (actorTierRes.data as AdminTier | null) ?? null

  const adminClient = getAdminClient()
  const body = await req.json().catch(() => ({}))
  const ban_duration: string = body.ban_duration ?? 'none'
  const action = ban_duration === 'none' ? 'user.unban' : 'user.ban'

  // One audit row per attempt; the write itself is checked (fail-loud on audit failure).
  const audit = async (outcome: 'ok' | 'denied' | 'error', reason: string | null) => {
    const { error: auditErr } = await adminClient.rpc('record_admin_action', {
      p_actor: user.id, p_action: action, p_target_type: 'user', p_target_id: target,
      p_outcome: outcome, p_reason: reason, p_details: { ban_duration }, p_request_id: rid ?? null,
    })
    if (auditErr) {
      logger.error('admin.audit.write_failed', {
        action, outcome, target_id: target, error: auditErr.message, request_id: rid ?? null,
      })
    }
  }

  // T3 needs the target's tier. Fail CLOSED if we cannot read it.
  const { data: targetRow, error: targetErr } = await adminClient
    .from('profiles').select('admin_tier').eq('id', target).single()
  if (targetErr) {
    await audit('error', `target_lookup:${targetErr.message}`)
    logger.error('admin.user.ban.target_lookup_failed', {
      target_id: target, error: targetErr.message, request_id: rid ?? null,
    })
    return NextResponse.json({ error: 'Could not verify target account' }, { status: 500 })
  }
  const targetTier = (targetRow?.admin_tier as AdminTier | null) ?? null

  const decision = decideUserAction(actorTier, targetTier, user.id, target)
  if (!decision.allowed) {
    await audit('denied', decision.code ?? 'denied')
    logger.warn('admin.user.ban.denied', {
      actor_tier: actorTier, target_id: target, outcome: 'denied', code: decision.code ?? 'denied', request_id: rid ?? null,
    })
    return NextResponse.json({ error: 'Forbidden', code: decision.code }, { status: decision.code === 'self' ? 400 : 403 })
  }

  const { error } = await adminClient.auth.admin.updateUserById(
    target, { ban_duration } as Parameters<typeof adminClient.auth.admin.updateUserById>[1]
  )
  if (error) {
    await audit('error', error.message)
    logger.error('admin.user.ban.failed', { target_id: target, ban_duration, outcome: 'error', error: error.message, request_id: rid ?? null })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await audit('ok', null)
  logger.info(action === 'user.unban' ? 'admin.user.unban' : 'admin.user.ban', {
    actor_tier: actorTier, target_id: target, ban_duration, outcome: 'ok', request_id: rid ?? null,
  })
  return NextResponse.json({ success: true, action: ban_duration === 'none' ? 'unban' : 'ban' })
}
