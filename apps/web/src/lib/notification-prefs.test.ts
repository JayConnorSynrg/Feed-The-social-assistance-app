// apps/web/src/lib/notification-prefs.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Unit tests for the authenticated notification topic-preference lib. Assert the
// OUTCOME and the failure contract the UI depends on:
//   - absent preference reads as all-true (default-ON, matches the DB COALESCE gate)
//   - authed read maps the RPC row (explicit false honored) and write upserts
//   - a failed READ never yields a silently-OFF topic — it resolves all-true
//   - a failed WRITE returns false so the UI reverts the toggle / surfaces an error
//     (never showing a value that did not persist)
//
// Run with: npx vitest run src/lib/notification-prefs.test.ts

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import {
  readNotificationPrefs,
  writeNotificationPrefs,
  DEFAULT_TOPIC_PREFS,
} from './notification-prefs'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Fake Supabase client: rpc() returns { data, error }; from().upsert() records the
// row and returns { error }. `state` lets a test assert what was reached.
function makeClient(opts: { rpcResult?: { data: unknown; error: unknown }; upsertError?: unknown }) {
  const state = { rpcCalled: false, upsertRow: null as Record<string, unknown> | null, onConflict: '' }
  const client = {
    state,
    rpc: () => {
      state.rpcCalled = true
      return Promise.resolve(opts.rpcResult ?? { data: null, error: null })
    },
    from: () => ({
      upsert: (row: Record<string, unknown>, o: { onConflict: string }) => {
        state.upsertRow = row
        state.onConflict = o.onConflict
        return Promise.resolve({ error: opts.upsertError ?? null })
      },
    }),
  }
  return client as unknown as SupabaseClient<Database> & { state: typeof state }
}

describe('readNotificationPrefs', () => {
  it('maps the RPC row, honoring an explicit false and defaulting missing keys ON', async () => {
    // Row omits community_posts (→ default ON) and sets resource_alerts false.
    const client = makeClient({ rpcResult: { data: { resource_alerts: false, application_updates: true }, error: null } })
    const prefs = await readNotificationPrefs(client)
    expect(client.state.rpcCalled).toBe(true)
    expect(prefs).toEqual({ resourceAlerts: false, applicationUpdates: true, communityPosts: true })
  })

  it('returns all-true when the RPC returns no row (absent → default-ON, I2)', async () => {
    const client = makeClient({ rpcResult: { data: null, error: null } })
    expect(await readNotificationPrefs(client)).toEqual(DEFAULT_TOPIC_PREFS)
  })

  it('resolves all-true when the RPC errors (a topic is never silently OFF)', async () => {
    const client = makeClient({ rpcResult: { data: null, error: { message: 'boom' } } })
    expect(await readNotificationPrefs(client)).toEqual(DEFAULT_TOPIC_PREFS)
  })
})

describe('writeNotificationPrefs', () => {
  it('upserts the own row with snake_case columns and onConflict user_id', async () => {
    const client = makeClient({})
    const ok = await writeNotificationPrefs(client, 'user-123', {
      resourceAlerts: true, applicationUpdates: false, communityPosts: true,
    })
    expect(ok).toBe(true)
    expect(client.state.onConflict).toBe('user_id')
    expect(client.state.upsertRow).toMatchObject({
      user_id: 'user-123',
      resource_alerts: true,
      application_updates: false,
      community_posts: true,
    })
  })

  // FIX 2 — failure path. The UI (updateNotifications in settings-panel.tsx)
  // reverts the optimistic toggle and shows the error banner ONLY when this
  // returns false. Swallowing the upsert error (returning true) would let the
  // toggle display a value that never persisted — this test guards against that.
  it('returns false when the upsert errors, so the UI can revert / surface the failure', async () => {
    const client = makeClient({ upsertError: { message: 'permission denied', code: '42501' } })
    const ok = await writeNotificationPrefs(client, 'user-123', {
      resourceAlerts: false, applicationUpdates: true, communityPosts: true,
    })
    expect(ok).toBe(false)
  })

  it('returns false without touching the client when there is no user id', async () => {
    const client = makeClient({})
    const ok = await writeNotificationPrefs(client, null, DEFAULT_TOPIC_PREFS)
    expect(ok).toBe(false)
    expect(client.state.upsertRow).toBeNull()
  })
})
