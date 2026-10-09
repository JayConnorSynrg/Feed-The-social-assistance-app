// apps/web/src/lib/privileged-action-guard.ts
// Pure source-scan used by the T5 bypass guard (privileged-action.test.ts). Kept out of the client
// helper so it has no runtime deps and can be unit-tested directly. A privileged call is legitimate
// ONLY as the 3rd argument of privilegedRpc(supabase, '<op>', '<name>', …); any other appearance of
// a privileged function-name string (dot/bracket/alias/template/variable call), or a bare fetch()
// to an /api/admin route, is a bypass.

// Names that write a public.admin_actions row (audited privileged actions). set_resource_location_by_id
// is audited on its admin branch; approve_form_template writes a form_template.approve row. The post
// editing writes (create_post … admin_set_comment_hidden) are listed so each one stays a single
// privilegedRpc call: its app_logs row and its post_revisions / admin_actions row share request_id.
export const AUDITED_PRIVILEGED = [
  'admin_remove_post',
  'admin_hold_post',
  'admin_authorize_post',
  'admin_resolve_report',
  'admin_verify_safety_alert',
  'admin_remove_safety_alert',
  'approve_resource',
  'reject_resource',
  'admin_update_resource',
  'approve_form_template',
  'admin_set_tier',
  'set_resource_location_by_id',
  'admin_save_organization',
  'admin_set_org_active',
  'create_org_event',
  'add_event_dates',
  'cancel_event_occurrence',
  'admin_update_event',
  'extend_event_series',
  // Post editing (PR-2): every post / comment write and redaction goes through lib/post-rpc.ts.
  'create_post',
  'edit_post',
  'delete_own_post',
  'edit_comment',
  'delete_own_comment',
  'redact_post_revision',
  'redact_comment_revision',
  'admin_set_comment_hidden',
]

const QUOTE = "[`'\"]"

/** Returns the bypass offenders found in one file's source text (empty = clean). */
export function scanForBypasses(text: string): string[] {
  const offenders: string[] = []
  for (const name of AUDITED_PRIVILEGED) {
    const literal = new RegExp(`${QUOTE}${name}${QUOTE}`, 'g')
    // Bracket-indexed occurrences are TypeScript type lookups, e.g.
    // Database['public']['Functions']['admin_update_resource'] — not RPC calls; ignore them.
    const typeLookup = new RegExp(`\\[\\s*${QUOTE}${name}${QUOTE}\\s*\\]`, 'g')
    const total = (text.match(literal) || []).length - (text.match(typeLookup) || []).length
    if (total <= 0) continue
    // Legit: the name is the 3rd positional arg of privilegedRpc[<Generic>](client, '<op>', '<name>', …).
    const legit = new RegExp(
      `privilegedRpc\\s*(?:<[^>]*>)?\\s*\\(\\s*[A-Za-z0-9_.]+\\s*,\\s*${QUOTE}[^\`'"]*${QUOTE}\\s*,\\s*${QUOTE}${name}${QUOTE}`,
      'g',
    )
    const legitCount = (text.match(legit) || []).length
    if (total > legitCount) offenders.push(name)
  }
  // A bare fetch() (never privilegedFetch — capital F) to an /api/admin route is a bypass.
  if (/\bfetch\s*\(\s*[`'"][^`'"]*\/api\/admin\//.test(text)) offenders.push('fetch:/api/admin')
  return offenders
}
