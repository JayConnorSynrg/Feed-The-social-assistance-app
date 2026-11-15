import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logEvent, logger } from '@/lib/logger'
import { safeRequestId } from '@/lib/request-id'
import { isUuid } from '@/lib/org-admin-paths'
import { buildPetitionSignaturesCsv, petitionCsvFilename, type PetitionSignatureRow } from '@/lib/petition-csv'
import { collectAllPages } from '@/lib/petition-export'

// POST /api/admin/petitions/[id]/export — the petition signatures CSV for an organizer.
//
// Who: platform admins only. The route refuses anyone else with 403 before it reads anything, using
// the same is_current_user_admin() that export_petition_signatures (SECURITY DEFINER) re-checks in
// its own body, so the database refuses a non-admin even if this check were skipped. Signatures are
// read through that RPC with the caller's own session; RLS on petition_signatures lets a member read
// only their own row.
//
// Side effect (unchanged, from migration 20260613000000): the first export sets petitions.exported_at,
// after which signers can no longer withdraw.
//
// Record: every attempt by a platform admin writes exactly one admin_actions row
// (action petition.export, target the petition, outcome ok | error) through record_admin_action, and
// the file is sent only after the ok row is written. Every attempt logs exactly one app_logs event
// admin.petition.export (outcome, row_count, duration_ms, request_id, code; no personal data). Both
// carry the client's x-request-id (sent by privilegedFetch).
//
// The file holds only the four columns in lib/petition-csv.ts; IP address and user agent are read
// by the RPC and dropped here, so they never leave the server.

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type Outcome = 'ok' | 'denied' | 'error'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const started = Date.now()
  const rid = safeRequestId((await headers()).get('x-request-id')) ?? null
  const petitionId = (await params).id

  const record = (outcome: Outcome, rowCount: number, code: string | null) =>
    logEvent('admin.petition.export', {
      outcome,
      row_count: rowCount,
      duration_ms: Date.now() - started,
      request_id: rid,
      code,
    })
  const fail = (status: number, code: string, rowCount = 0, outcome: Outcome = 'error') => {
    record(outcome, rowCount, code)
    return Response.json({ error: code, code }, { status })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return fail(401, 'auth', 0, 'denied')

  // Gate FIRST: a caller who is not a platform admin is refused before any read or audit write.
  const { data: isAdmin, error: gateErr } = await supabase.rpc('is_current_user_admin')
  if (gateErr) return fail(500, 'gate_failed')
  if (isAdmin !== true) return fail(403, 'insufficient_tier', 0, 'denied')

  const adminClient = getAdminClient()
  /** Writes the one admin_actions row for this attempt; false when the write failed. */
  const audit = async (outcome: 'ok' | 'error', reason: string | null, rowCount: number): Promise<boolean> => {
    const { error } = await adminClient.rpc('record_admin_action', {
      p_actor: user.id,
      p_action: 'petition.export',
      p_target_type: 'petition',
      p_target_id: isUuid(petitionId) ? petitionId : null,
      p_outcome: outcome,
      p_reason: reason,
      p_details: { row_count: rowCount },
      p_request_id: rid,
    })
    if (error) logger.error('admin.audit.write_failed', { action: 'petition.export', outcome, error: error.message, request_id: rid })
    return !error
  }
  const auditedFail = async (status: number, code: string, rowCount = 0) => {
    await audit('error', code, rowCount)
    return fail(status, code, rowCount)
  }

  if (!isUuid(petitionId)) return auditedFail(400, 'invalid_id')

  // Approved petitions only — the list the admin picks from. The explicit status filter matters:
  // RLS also shows a caller their own drafts (petitions_select_own_drafts), and exporting sets the
  // withdrawal lock, so a direct POST must not reach a draft.
  const { data: petition, error: petitionErr } = await supabase
    .from('petitions')
    .select('id')
    .eq('id', petitionId)
    .eq('status', 'approved')
    .maybeSingle()
  if (petitionErr) return auditedFail(500, 'read_failed')
  if (!petition) return auditedFail(404, 'not_found')

  const { data: expected, error: countErr } = await supabase.rpc('get_petition_signature_count', {
    p_petition_id: petitionId,
  })
  if (countErr || typeof expected !== 'number') return auditedFail(500, 'read_failed')

  const pages = await collectAllPages<PetitionSignatureRow>(
    async (from, to) => {
      const { data, error } = await supabase
        .rpc('export_petition_signatures', { p_petition_id: petitionId })
        .range(from, to)
      return { data: data ?? null, error }
    },
    expected,
  )
  if (!pages.ok) return auditedFail(500, pages.code, pages.read)

  const rowCount = pages.rows.length
  const csv = buildPetitionSignaturesCsv(pages.rows)

  // No disclosure without a record: the file goes out only once its ok row is written.
  if (!(await audit('ok', null, rowCount))) return fail(500, 'audit_failed', rowCount)

  record('ok', rowCount, null)
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${petitionCsvFilename(petitionId, new Date())}"`,
      'Cache-Control': 'no-store',
      'X-Row-Count': String(rowCount),
    },
  })
}
