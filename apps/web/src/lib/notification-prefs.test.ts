// apps/web/src/lib/notification-prefs.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Unit tests for the notification topic-preference lib. Assert the OUTCOME:
//   - absent preference reads as all-true (default-ON, matches the DB COALESCE gate)
//   - guest path round-trips through localStorage
//   - authed path reads the RPC row (explicit false honored) and upserts on write
//   - a failed read never yields a silently-OFF topic — it resolves all-true
//
// Run with: npx vitest run src/lib/notification-prefs.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import {
  readGuestTopicPrefs,
  writeGuestTopicPrefs,
  readNotificationPrefs,
  writeNotificationPrefs,
  DEFAULT_TOPIC_PREFS,
  NOTIFICATION_PREFS_KEY,
  type NotificationTopicPrefs,
} from './notification-prefs'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// localStorage + window mock (mirrors accessibility-prefs.test.ts)
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })
Object.defineProperty(globalThis, 'window', { value: globalThis, writable: true, configurable: true })

// Fake Supabase client: rpc() returns { data, error }; from().upsert() records the row.
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

describe('readGuestTopicPrefs', () => {
  beforeEach(() => localStorageMock.clear())

  it('returns all-true when nothing is stored (default-ON, I2)', () => {
    expect(readGuestTopicPrefs()).toEqual(DEFAULT_TOPIC_PREFS)
  })

  it('round-trips a stored preference and honors an explicit false', () => {
    const prefs: NotificationTopicPrefs = { resourceAlerts: false, applicationUpdates: true, communityPosts: false }
    writeGuestTopicPrefs(prefs)
    expect(localStorageMock.getItem(NOTIFICATION_PREFS_KEY)).toBeTruthy()
    expect(readGuestTopicPrefs()).toEqual(prefs)
  })

  it('returns all-true on malformed JSON', () => {
    localStorageMock.setItem(NOTIFICATION_PREFS_KEY, '{not valid')
    expect(readGuestTopicPrefs()).toEqual(DEFAULT_TOPIC_PREFS)
  })
})

describe('readNotificationPrefs', () => {
  beforeEach(() => localStorageMock.clear())

  it('guest path reads localStorage, never the client', async () => {
    writeGuestTopicPrefs({ resourceAlerts: false, applicationUpdates: false, communityPosts: true })
    const client = makeClient({})
    const prefs = await readNotificationPrefs(client, /* isGuest */ true)
    expect(prefs).toEqual({ resourceAlerts: false, applicationUpdates: false, communityPosts: true })
    expect(client.state.rpcCalled).toBe(false)
  })

  it('authed path maps the RPC row, honoring an explicit false and defaulting missing keys ON', async () => {
    // Row omits community_posts (→ default ON) and sets resource_alerts false.
    const client = makeClient({ rpcResult: { data: { resource_alerts: false, application_updates: true }, error: null } })
    const prefs = await readNotificationPrefs(client, false)
    expect(client.state.rpcCalled).toBe(true)
    expect(prefs).toEqual({ resourceAlerts: false, applicationUpdates: true, communityPosts: true })
  })

  it('resolves all-true when the RPC errors (a topic is never silently OFF)', async () => {
    const client = makeClient({ rpcResult: { data: null, error: { message: 'boom' } } })
    expect(await readNotificationPrefs(client, false)).toEqual(DEFAULT_TOPIC_PREFS)
  })
})

describe('writeNotificationPrefs', () => {
  beforeEach(() => localStorageMock.clear())

  it('authed path upserts the own row with snake_case columns and onConflict user_id', async () => {
    const client = makeClient({})
    const ok = await writeNotificationPrefs(client, false, 'user-123', {
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

  it('guest path writes localStorage and does not call the client', async () => {
    const client = makeClient({})
    const prefs: NotificationTopicPrefs = { resourceAlerts: false, applicationUpdates: true, communityPosts: false }
    const ok = await writeNotificationPrefs(client, true, null, prefs)
    expect(ok).toBe(true)
    expect(client.state.upsertRow).toBeNull()
    expect(readGuestTopicPrefs()).toEqual(prefs)
  })
})
