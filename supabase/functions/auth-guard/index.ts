// Auth Guard Edge Function
// Handles account lockout logic, login attempt tracking, and brute-force protection
// POST /auth-guard with action: check-lockout | record-attempt | get-status

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// CORS configuration - restrict to app domains
const ALLOWED_ORIGINS = [
  Deno.env.get('APP_URL') || 'http://localhost:3000',
  'capacitor://localhost',  // Mobile app (iOS)
  'http://localhost',       // Mobile app (Android webview)
  'ionic://localhost',      // Ionic dev
]

// Get CORS headers with validated origin
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] // Default to APP_URL

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  }
}

// Progressive lockout thresholds
const LOCKOUT_RULES = {
  // Level 1: 5 failures in 15 min → lock for 15 min
  level1: {
    maxAttempts: 5,
    windowMinutes: 15,
    lockoutMinutes: 15,
  },
  // Level 2: 10 failures in 1 hour → lock for 1 hour
  level2: {
    maxAttempts: 10,
    windowMinutes: 60,
    lockoutMinutes: 60,
  },
  // Level 3: 20 failures in 24 hours → lock for 24 hours
  level3: {
    maxAttempts: 20,
    windowMinutes: 1440,
    lockoutMinutes: 1440,
  },
}

interface AuthGuardRequest {
  action: 'check-lockout' | 'record-attempt' | 'get-status'
  email: string
  ip_address?: string
  user_agent?: string
  success?: boolean
  failure_reason?: string
}

interface LockoutStatus {
  is_locked: boolean
  locked_until?: string
  lockout_level?: number
  minutes_remaining?: number
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body: AuthGuardRequest = await req.json()
    const { action, email, ip_address, user_agent, success, failure_reason } = body

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Route to appropriate handler
    let result
    switch (action) {
      case 'check-lockout':
        result = await checkLockout(supabase, email)
        break
      case 'record-attempt':
        result = await recordAttempt(
          supabase,
          email,
          ip_address,
          user_agent,
          success || false,
          failure_reason
        )
        break
      case 'get-status':
        result = await getLockoutStatus(supabase, email)
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Auth guard error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Check if an account is currently locked out
 */
async function checkLockout(supabase: any, email: string): Promise<LockoutStatus> {
  // Use the helper function from migration
  const { data, error } = await supabase.rpc('is_account_locked', {
    p_email: email,
  })

  if (error) {
    console.error('Error checking lockout:', error)
    throw error
  }

  // The function returns an array with one row (or empty)
  if (data && data.length > 0) {
    const lockout = data[0]
    if (lockout.is_locked) {
      const lockedUntil = new Date(lockout.locked_until)
      const now = new Date()
      const minutesRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / (1000 * 60))

      return {
        is_locked: true,
        locked_until: lockout.locked_until,
        lockout_level: lockout.lockout_level,
        minutes_remaining: Math.max(0, minutesRemaining),
      }
    }
  }

  return { is_locked: false }
}

/**
 * Get current lockout status for an account
 */
async function getLockoutStatus(supabase: any, email: string): Promise<LockoutStatus> {
  return checkLockout(supabase, email)
}

/**
 * Record a login attempt and apply progressive lockout rules
 */
async function recordAttempt(
  supabase: any,
  email: string,
  ip_address?: string,
  user_agent?: string,
  success?: boolean,
  failure_reason?: string
): Promise<{ recorded: boolean; lockout_applied?: LockoutStatus }> {
  // 1. Record the attempt
  const { error: insertError } = await supabase.from('auth_login_attempts').insert({
    email,
    ip_address,
    user_agent,
    success,
    failure_reason,
  })

  if (insertError) {
    console.error('Error recording login attempt:', insertError)
    throw insertError
  }

  // 2. If success, remove any existing lockout
  if (success) {
    await supabase.from('account_lockouts').delete().eq('email', email)
    return { recorded: true }
  }

  // 3. If failure, check if we need to apply lockout
  const lockout = await evaluateLockoutRules(supabase, email)

  if (lockout) {
    return { recorded: true, lockout_applied: lockout }
  }

  return { recorded: true }
}

/**
 * Evaluate progressive lockout rules based on recent failed attempts
 */
async function evaluateLockoutRules(supabase: any, email: string): Promise<LockoutStatus | null> {
  const now = new Date()

  // Check each lockout level (from most severe to least severe)
  const rules = [
    { level: 3, config: LOCKOUT_RULES.level3 },
    { level: 2, config: LOCKOUT_RULES.level2 },
    { level: 1, config: LOCKOUT_RULES.level1 },
  ]

  for (const { level, config } of rules) {
    const windowStart = new Date(now.getTime() - config.windowMinutes * 60 * 1000)

    // Count failed attempts in this time window
    const { count, error } = await supabase
      .from('auth_login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('email', email)
      .eq('success', false)
      .gte('created_at', windowStart.toISOString())

    if (error) {
      console.error('Error counting login attempts:', error)
      continue
    }

    // If threshold exceeded, apply lockout
    if (count && count >= config.maxAttempts) {
      const lockedUntil = new Date(now.getTime() + config.lockoutMinutes * 60 * 1000)

      // Insert or update lockout
      const { error: lockoutError } = await supabase
        .from('account_lockouts')
        .upsert({
          email,
          locked_until: lockedUntil.toISOString(),
          attempt_count: count,
          lockout_level: level,
          last_attempt_at: now.toISOString(),
        })

      if (lockoutError) {
        console.error('Error applying lockout:', lockoutError)
        continue
      }

      console.log(`Applied level ${level} lockout for ${email} (${count} attempts in ${config.windowMinutes} minutes)`)

      return {
        is_locked: true,
        locked_until: lockedUntil.toISOString(),
        lockout_level: level,
        minutes_remaining: config.lockoutMinutes,
      }
    }
  }

  return null
}
