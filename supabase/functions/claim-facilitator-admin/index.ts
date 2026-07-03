// supabase/functions/claim-facilitator-admin/index.ts
//
// HASH CONTRACT (for provisioning):
//   FACILITATOR_ADMIN_CODE_HASH = hex(HMAC-SHA256(FACILITATOR_ADMIN_CODE_PEPPER, plaintext_code))
//   Both secrets are Supabase Edge Function secrets — never committed.
//   The pepper isolates the HMAC key from the code value. Rotation:
//     1. Generate new 24-char random code.
//     2. Compute hex(HMAC-SHA256(pepper, code)).
//     3. Set FACILITATOR_ADMIN_CODE_HASH secret to that hex string.
//     4. (Optionally rotate FACILITATOR_ADMIN_CODE_PEPPER too and recompute.)
//
// Auth model: deployed --no-verify-jwt; JWT verified in-code via auth.getUser().
// Anonymous users and non-authenticated callers are rejected before code check.
// Rate limit: 5 failures/hour per user_id (checked before code comparison).
// Grant-only: this function ONLY sets is_admin=true, NEVER sets is_admin=false.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { edgeLog, getCorrelationId } from '../_shared/log.ts'
import { createHmac, timingSafeEqual } from 'node:crypto'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FACILITATOR_ADMIN_CODE_HASH = Deno.env.get('FACILITATOR_ADMIN_CODE_HASH')
const FACILITATOR_ADMIN_CODE_PEPPER = Deno.env.get('FACILITATOR_ADMIN_CODE_PEPPER')

const MAX_CODE_LENGTH = 256
const RATE_LIMIT_FAILURES = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

serve(async (req: Request) => {
  const correlationId = getCorrelationId(req)
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin, 'claim-facilitator-admin')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // ── CONFIG GATE ──
    if (!FACILITATOR_ADMIN_CODE_HASH || !FACILITATOR_ADMIN_CODE_PEPPER) {
      edgeLog('warn', 'claim-facilitator-admin.not_configured', { correlationId })
      return new Response(JSON.stringify({ success: false, error: 'not_configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── AUTH GATE (in-code JWT verification) ──
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '').trim()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error: userErr } = await callerClient.auth.getUser(token)
    if (userErr || !user || user.is_anonymous) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = user.id
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const userAgent = req.headers.get('user-agent') ?? null

    // ── BODY PARSE ──
    const body = await req.json().catch(() => ({}))
    const rawCode = body?.code
    if (!rawCode || typeof rawCode !== 'string' || rawCode.trim().length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'missing_code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const code = String(rawCode).slice(0, MAX_CODE_LENGTH).trim()

    // ── SERVICE CLIENT (for all privileged DB ops) ──
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // ── RATE LIMIT (failures in last hour, checked BEFORE code comparison) ──
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
    const { count } = await admin
      .from('admin_code_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('success', false)
      .gte('created_at', windowStart)

    if ((count ?? 0) >= RATE_LIMIT_FAILURES) {
      await admin.from('admin_code_redemptions').insert({
        user_id: userId,
        success: false,
        failure_reason: 'rate_limited',
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      edgeLog('warn', 'claim-facilitator-admin.rate_limited', { userId, correlationId })
      return new Response(JSON.stringify({ success: false, error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── CONSTANT-TIME CODE CHECK ──
    // HASH CONTRACT: FACILITATOR_ADMIN_CODE_HASH = hex(HMAC-SHA256(FACILITATOR_ADMIN_CODE_PEPPER, code))
    const submittedHash = createHmac('sha256', FACILITATOR_ADMIN_CODE_PEPPER).update(code).digest()
    const storedHash = Buffer.from(FACILITATOR_ADMIN_CODE_HASH, 'hex')
    const ok = submittedHash.length === storedHash.length && timingSafeEqual(submittedHash, storedHash)

    if (!ok) {
      await admin.from('admin_code_redemptions').insert({
        user_id: userId,
        success: false,
        failure_reason: 'invalid_code',
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      edgeLog('warn', 'claim-facilitator-admin.invalid_code', { userId, correlationId })
      return new Response(JSON.stringify({ success: false, error: 'invalid_code' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── GRANT (ONLY sets is_admin=true — never sets false) ──
    const { error: grantErr } = await admin
      .from('profiles')
      .update({ is_admin: true, user_role: 'facilitator' })
      .eq('id', userId)

    if (grantErr) {
      edgeLog('error', 'claim-facilitator-admin.grant_failed', { userId, correlationId, error: grantErr.message })
      return new Response(JSON.stringify({ success: false, error: 'grant_failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── AUDIT INSERT ──
    await admin.from('admin_code_redemptions').insert({
      user_id: userId,
      success: true,
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    // ── AUDIT LOG ──
    await admin.rpc('log_audit_event', {
      p_user_id: userId,
      p_event_type: 'facilitator_admin_claimed',
      p_event_category: 'authorization',
      p_action: 'grant_facilitator_admin',
      p_severity: 'warning',
      p_resource_type: 'profiles',
      p_resource_id: userId,
      p_details: { via: 'claim-facilitator-admin' },
    })

    edgeLog('info', 'claim-facilitator-admin.granted', { userId, correlationId })
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // Never leak code/hash/pepper in logs
    edgeLog('error', 'claim-facilitator-admin.unhandled', { correlationId, message })
    return new Response(JSON.stringify({ success: false, error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
