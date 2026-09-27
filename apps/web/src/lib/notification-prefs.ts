// apps/web/src/lib/notification-prefs.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Single source of truth for the three DB-backed notification TOPIC preferences
// that Settings → Notifications exposes: Resource alerts, Application updates,
// Community posts. These gate the three server-side producers in
// supabase/migrations/20261011000000_notification_preferences_and_producers.sql.
//
// Authenticated-only: the only caller (settings-panel.tsx → NotificationSection)
// renders for signed-in users, so there is no guest path here.
//   - Read  → get_my_notification_prefs() SECDEF accessor (all-true row when absent).
//   - Write → own-row upsert into notification_preferences.
//
// Absent / malformed / any read failure → all-true defaults (a topic is ON until
// the user turns it OFF — matches the DB COALESCE(...,true) gate, I2). A write
// returns a success boolean so the UI can revert/annotate on failure (never show
// a value that did not persist).
//
// NOTE ON TYPES: the notification_preferences table and get_my_notification_prefs
// RPC are added by the Wave B migration; packages/database/types.ts is
// regenerated from prod AFTER that migration is applied. Until then those two
// calls are unknown to the generated Database type, so each is made through a
// narrow, local structural cast (never a blanket `as any` on the client).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { logger } from '@/lib/logger'

/** The three DB-backed topic preferences the Settings toggles control. */
export interface NotificationTopicPrefs {
  resourceAlerts: boolean
  applicationUpdates: boolean
  communityPosts: boolean
}

/** All topics ON — the default when no explicit preference exists. */
export const DEFAULT_TOPIC_PREFS: NotificationTopicPrefs = {
  resourceAlerts: true,
  applicationUpdates: true,
  communityPosts: true,
}

// The DB row shape (snake_case) for the columns this lib reads/writes.
interface NotificationPrefsRow {
  resource_alerts: boolean
  application_updates: boolean
  community_posts: boolean
}

// Minimal structural views of the not-yet-regenerated calls (see NOTE ON TYPES).
type PrefsRpcClient = {
  rpc: (fn: 'get_my_notification_prefs') => PromiseLike<{ data: unknown; error: unknown }>
}
type PrefsUpsertClient = {
  from: (table: 'notification_preferences') => {
    upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => PromiseLike<{ error: unknown }>
  }
}

function rowToTopicPrefs(row: Partial<NotificationPrefsRow> | null | undefined): NotificationTopicPrefs {
  if (!row || typeof row !== 'object') return { ...DEFAULT_TOPIC_PREFS }
  return {
    // Only an explicit `false` turns a topic off; anything else → default ON (I2).
    resourceAlerts: row.resource_alerts !== false,
    applicationUpdates: row.application_updates !== false,
    communityPosts: row.community_posts !== false,
  }
}

function topicPrefsToRow(prefs: NotificationTopicPrefs): NotificationPrefsRow {
  return {
    resource_alerts: prefs.resourceAlerts,
    application_updates: prefs.applicationUpdates,
    community_posts: prefs.communityPosts,
  }
}

/**
 * Read the signed-in caller's topic preferences via the get_my_notification_prefs()
 * RPC (which returns an all-true row when none exists). Any failure resolves to
 * all-true defaults so a topic is never silently OFF.
 */
export async function readNotificationPrefs(
  supabase: SupabaseClient<Database>
): Promise<NotificationTopicPrefs> {
  try {
    const { data, error } = await (supabase as unknown as PrefsRpcClient).rpc('get_my_notification_prefs')
    if (error) throw error
    // The SECDEF fn RETURNS a single row (object), not an array.
    const row = Array.isArray(data) ? data[0] : data
    return rowToTopicPrefs(row as Partial<NotificationPrefsRow> | null)
  } catch (err: unknown) {
    logger.warn('notif.pref.read_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return { ...DEFAULT_TOPIC_PREFS }
  }
}

/**
 * Persist the signed-in caller's topic preferences by upserting the own-row
 * notification_preferences record. Returns whether the write succeeded so the
 * caller can revert/annotate the toggle on failure (never showing a value that
 * did not persist).
 */
export async function writeNotificationPrefs(
  supabase: SupabaseClient<Database>,
  userId: string | null,
  prefs: NotificationTopicPrefs
): Promise<boolean> {
  logger.info('notif.pref.changed', {
    resource_alerts: prefs.resourceAlerts,
    application_updates: prefs.applicationUpdates,
    community_posts: prefs.communityPosts,
  })

  if (!userId) {
    logger.error('notif.pref.write_failed', new Error('missing user id'), { user_present: false })
    return false
  }
  try {
    const { error } = await (supabase as unknown as PrefsUpsertClient)
      .from('notification_preferences')
      .upsert(
        { user_id: userId, ...topicPrefsToRow(prefs), updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
    if (error) throw error
    return true
  } catch (err: unknown) {
    logger.error('notif.pref.write_failed', err, { user_present: Boolean(userId) })
    return false
  }
}
