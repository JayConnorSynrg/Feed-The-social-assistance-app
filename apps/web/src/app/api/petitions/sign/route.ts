/**
 * POST /api/petitions/sign
 *
 * Server-side ESIGN/UETA-aligned petition signature handler.
 * Captures: intent/consent (affirmation_text), attribution (signer_display_name),
 * integrity (petition_version_hash), retention metadata (ip_address, user_agent, signed_at).
 *
 * All metadata is stamped SERVER-SIDE via service-role client — clients cannot forge
 * ip_address or user_agent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { Database } from '@feed/database'

// The exact affirmation text shown to and agreed to by the signer.
const AFFIRMATION_TEXT =
  'I add my verified signature of support to this petition.'

const QUERY_TIMEOUT_MS = 12_000

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function POST(req: NextRequest) {
  const start = performance.now()
  try {
    // ── Parse + validate body ──────────────────────────────────
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    }

    const { petitionId, affirmed } = body as Record<string, unknown>

    if (typeof petitionId !== 'string' || !petitionId.trim()) {
      return NextResponse.json({ error: 'petitionId_required' }, { status: 400 })
    }

    if (affirmed !== true) {
      return NextResponse.json(
        { error: 'affirmation_required', message: 'You must affirm to add your verified signature of support.' },
        { status: 400 }
      )
    }

    // ── Authenticate ───────────────────────────────────────────
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      logger.warn('petition.sign.unauthorized', { latencyMs: Math.round(performance.now() - start) })
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const serviceClient = getServiceClient()

    // ── Fetch petition ─────────────────────────────────────────
    const { data: petition, error: petitionError } = await serviceClient
      .from('petitions')
      .select('id, body_version_hash, status')
      .eq('id', petitionId.trim())
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
      .single()

    if (petitionError || !petition) {
      return NextResponse.json({ error: 'petition_not_found' }, { status: 404 })
    }

    if (petition.status !== 'approved') {
      return NextResponse.json({ error: 'petition_not_available' }, { status: 409 })
    }

    // ── Fetch signer profile ───────────────────────────────────
    // Name-privacy lockdown (#9): a petition signature is a PUBLIC surface
    // ("verified signature of support"), so the signer is shown FIRST NAME only
    // — consistent with every other cross-user/anon surface. (Surname stays
    // private; it reveals only inside a conversation per the asymmetric rule.)
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('first_name, username, full_name')
      .eq('id', user.id)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
      .single()

    const signerDisplayName =
      profile?.first_name?.trim() ||
      profile?.username?.trim() ||
      user.email?.split('@')[0] ||
      'Anonymous'

    // Full legal name SNAPSHOT at signing time. The service-role read bypasses
    // the full_name SELECT-revoke on the authenticated role; the snapshot is the
    // legal-record name surfaced only inside the admin signer export. Nullable —
    // pre-snapshot rows fall back to signer_display_name in the admin view.
    const signerFullName = profile?.full_name?.trim() || null

    // ── Capture server-stamped metadata ───────────────────────
    const forwarded = req.headers.get('x-forwarded-for')
    const real = req.headers.get('x-real-ip')
    const ipRaw = forwarded?.split(',')[0]?.trim() || real || null

    const userAgent = req.headers.get('user-agent') || null

    // ── Insert via service-role (bypasses RLS; ip/ua are server-stamped) ──
    const { error: insertError } = await serviceClient
      .from('petition_signatures')
      .insert({
        petition_id: petition.id,
        signer_id: user.id,
        signer_display_name: signerDisplayName,
        signer_full_name: signerFullName,
        affirmation_text: AFFIRMATION_TEXT,
        petition_version_hash: petition.body_version_hash,
        ip_address: ipRaw as string | null,
        user_agent: userAgent,
        signed_at: new Date().toISOString(),
      })

    if (insertError) {
      // UNIQUE violation → already signed (idempotent)
      if (insertError.code === '23505') {
        const { data: countData } = await serviceClient
          .rpc('get_petition_signature_count', { p_petition_id: petition.id })

        return NextResponse.json({ ok: true, alreadySigned: true, count: countData ?? 0 })
      }

      logger.error('petition.sign.failed', {
        petitionId: petition.id,
        signerId: user.id,
        error: insertError.message,
        code: insertError.code,
        latencyMs: Math.round(performance.now() - start),
      })
      return NextResponse.json({ error: 'sign_failed' }, { status: 500 })
    }

    // ── Return updated count ───────────────────────────────────
    const { data: countData } = await serviceClient
      .rpc('get_petition_signature_count', { p_petition_id: petition.id })

    const latencyMs = Math.round(performance.now() - start)
    logger.info('petition.sign', { petitionId: petition.id, signerId: user.id })
    logger.info('petition.sign.route.ok', { petitionId: petition.id, latencyMs })

    return NextResponse.json({ ok: true, alreadySigned: false, count: countData ?? 1 })
  } catch (err: unknown) {
    // Next.js AbortError on in-flight fetch during re-render — treat as transient
    if (
      (err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && err.message.includes('signal'))
    ) {
      return NextResponse.json({ ok: true, alreadySigned: false, count: 0 })
    }

    logger.error('petition.sign.unexpected', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'unexpected_error' }, { status: 500 })
  }
}
