// apps/web/src/lib/allow-messages-prefs.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Account-authoritative read/write for the single "Allow Messages" privacy flag
// (profiles.allow_messages), added by migration 20261013000000_allow_messages.sql.
// This flag gates NEW conversation requests server-side (the enforce_conversation_transition
// trigger); this lib is the client persistence path for the Settings → Privacy toggle.
//
// Read  → get_my_allow_messages() SECURITY DEFINER accessor (returns the caller's OWN value,
//         default true when absent). There is deliberately NO column SELECT grant on
//         profiles.allow_messages, so this RPC is the ONLY read path for the owner and no
//         other user can read the flag.
// Write → own-row UPDATE .update({allow_messages}).eq('id', userId). NOT an upsert:
//         profiles uses column-level grants and .upsert() under a column grant raises 42501
//         (pattern-postgrest-upsert-grant-trinity). Returns a success boolean so the toggle can
//         revert + surface a banner on failure (never show a value that did not persist).
//
// Default semantics: only an explicit false is OFF; NULL / absent / any read failure → true
// (default-ON), matching the DB COALESCE(...,true) gate so the toggle is never silently OFF.
//
// NOTE ON TYPES: allow_messages and get_my_allow_messages are added by this wave's migration;
// packages/database/types.ts is regenerated from prod AFTER the migration is applied. Until then
// the column and RPC are unknown to the generated Database type, so each call is made through a
// narrow, local structural cast (never a blanket `as any`) — the same approach as
// notification-prefs.ts for the Wave B accessor.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { logger } from '@/lib/logger'

/** The default when no explicit preference exists (default-ON). */
export const DEFAULT_ALLOW_MESSAGES = true

// Minimal structural views of the not-yet-regenerated calls (see NOTE ON TYPES).
type AllowRpcClient = {
  rpc: (fn: 'get_my_allow_messages') => PromiseLike<{ data: unknown; error: unknown }>
}
type AllowUpdateClient = {
  from: (table: 'profiles') => {
    update: (row: { allow_messages: boolean }) => {
      eq: (col: 'id', val: string) => PromiseLike<{ error: unknown }>
    }
  }
}

/**
 * Read the signed-in caller's allow_messages flag via the get_my_allow_messages() RPC (a scalar
 * boolean; NULL/absent synthesized as true by the accessor). Any failure resolves to the default
 * (true) so the toggle is never silently OFF.
 */
export async function readAllowMessages(
  supabase: SupabaseClient<Database>
): Promise<boolean> {
  try {
    const { data, error } = await (supabase as unknown as AllowRpcClient).rpc('get_my_allow_messages')
    if (error) throw error
    // Only an explicit `false` turns the flag off; anything else → default ON.
    return data === false ? false : true
  } catch (err: unknown) {
    logger.warn('allow_messages.read_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return DEFAULT_ALLOW_MESSAGES
  }
}

/**
 * Persist the signed-in caller's allow_messages flag with an own-row UPDATE. Returns whether the
 * write succeeded so the caller can revert/annotate the toggle on failure (never showing a value
 * that did not persist).
 */
export async function writeAllowMessages(
  supabase: SupabaseClient<Database>,
  userId: string | null,
  value: boolean
): Promise<boolean> {
  logger.info('allow_messages.changed', { allow_messages: value })

  if (!userId) {
    logger.error('allow_messages.write_failed', new Error('missing user id'), { user_present: false })
    return false
  }
  try {
    const { error } = await (supabase as unknown as AllowUpdateClient)
      .from('profiles')
      .update({ allow_messages: value })
      .eq('id', userId)
    if (error) throw error
    return true
  } catch (err: unknown) {
    logger.error('allow_messages.write_failed', err, { user_present: Boolean(userId) })
    return false
  }
}
