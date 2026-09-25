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

// DELETE /api/admin/users/[id]/delete — permanently deletes a user (auth + profiles cascade).
//
// P3.1: platform-admin only; T3 (cannot delete an equal/higher tier or self); exactly one
// admin_actions row per attempt carrying the client's x-request-id. D7: on success one 'ok' row is
// written AFTER the delete (target_id has no FK, survives the cascade); one 'error' row on failure.
// Fails CLOSED (500) if the target-tier lookup errors.
export async function DELETE(
  _req: Request,
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

  const audit = async (outcome: 'ok' | 'denied' | 'error', reason: string | null) => {
    const { error: auditErr } = await adminClient.rpc('record_admin_action', {
      p_actor: user.id, p_action: 'user.delete', p_target_type: 'user', p_target_id: target,
      p_outcome: outcome, p_reason: reason, p_details: {}, p_request_id: rid ?? null,
    })
    if (auditErr) {
      logger.error('admin.audit.write_failed', {
        action: 'user.delete', outcome, target_id: target, error: auditErr.message, request_id: rid ?? null,
      })
    }
  }

  const { data: targetRow, error: targetErr } = await adminClient
    .from('profiles').select('admin_tier').eq('id', target).single()
  if (targetErr) {
    await audit('error', `target_lookup:${targetErr.message}`)
    logger.error('admin.user.delete.target_lookup_failed', {
      target_id: target, error: targetErr.message, request_id: rid ?? null,
    })
    return NextResponse.json({ error: 'Could not verify target account' }, { status: 500 })
  }
  const targetTier = (targetRow?.admin_tier as AdminTier | null) ?? null

  const decision = decideUserAction(actorTier, targetTier, user.id, target)
  if (!decision.allowed) {
    await audit('denied', decision.code ?? 'denied')
    logger.warn('admin.user.delete.denied', {
      actor_tier: actorTier, target_id: target, outcome: 'denied', code: decision.code ?? 'denied', request_id: rid ?? null,
    })
    return NextResponse.json({ error: 'Forbidden', code: decision.code }, { status: decision.code === 'self' ? 400 : 403 })
  }

  const { error } = await adminClient.auth.admin.deleteUser(target)
  if (error) {
    await audit('error', error.message)
    logger.error('admin.user.delete.failed', { target_id: target, outcome: 'error', error: error.message, request_id: rid ?? null })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await audit('ok', null)
  logger.info('admin.user.delete', { actor_tier: actorTier, target_id: target, outcome: 'ok', request_id: rid ?? null })
  return NextResponse.json({ success: true })
}
