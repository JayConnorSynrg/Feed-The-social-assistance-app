// API Route: Account Lockout Check
// Queries account_lockouts and auth_login_attempts tables directly via service role.
// This route fires pre-login (no user JWT), so it cannot call auth-guard edge function.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'
import { withRateLimit } from '@/middleware/federation-rate-limit'
import { logger } from '@/lib/logger'
import type { Database } from '@feed/database'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function getServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const POST = withRateLimit(async (req: NextRequest) => {
  const timer = logger.time('auth.check-lockout')
  try {
    const body = await req.json()
    const { action, email, ip_address, user_agent, success, failure_reason } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    const clientIp = ip_address || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    const clientUserAgent = user_agent || req.headers.get('user-agent')

    const supabase = getServiceClient()

    // --- Record attempt (non-blocking) ---
    if (action === 'record_attempt') {
      await supabase.from('auth_login_attempts').insert({
        email,
        ip_address: clientIp,
        user_agent: clientUserAgent,
        success: success ?? false,
        failure_reason: failure_reason ?? null,
      })

      // On successful login, clear any active lockout
      if (success) {
        await supabase.from('account_lockouts').delete().eq('email', email)
        timer.end({ action, email })
        return NextResponse.json({ isLocked: false, remainingAttempts: MAX_ATTEMPTS })
      }

      // Count failures in rolling 15-minute window
      const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()
      const { count } = await supabase
        .from('auth_login_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('email', email)
        .eq('success', false)
        .gte('created_at', windowStart)

      const failures = count ?? 0

      if (failures >= MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + WINDOW_MS).toISOString()
        await supabase.from('account_lockouts').upsert({
          email,
          locked_until: lockedUntil,
          attempt_count: failures,
          last_attempt_at: new Date().toISOString(),
        })
        timer.end({ action, email, isLocked: true })
        return NextResponse.json({ isLocked: true, remainingAttempts: 0, lockedUntil })
      }

      timer.end({ action, email, isLocked: false })
      return NextResponse.json({ isLocked: false, remainingAttempts: MAX_ATTEMPTS - failures })
    }

    // --- Check lockout status (action === 'check') ---
    const { data: lockout } = await supabase
      .from('account_lockouts')
      .select('locked_until, attempt_count')
      .eq('email', email)
      .single()

    if (lockout && new Date(lockout.locked_until) > new Date()) {
      timer.end({ action, email, isLocked: true })
      return NextResponse.json({
        isLocked: true,
        remainingAttempts: 0,
        lockedUntil: lockout.locked_until,
      })
    }

    // Lockout expired or never set — count recent failures for remainingAttempts
    const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()
    const { count } = await supabase
      .from('auth_login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .eq('success', false)
      .gte('created_at', windowStart)

    const failures = count ?? 0
    timer.end({ action, email, isLocked: false })
    return NextResponse.json({
      isLocked: false,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - failures),
    })
  } catch (error) {
    timer.error(error, { user_ip: req.headers.get('x-forwarded-for') ?? undefined })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}, 'resource-api')
