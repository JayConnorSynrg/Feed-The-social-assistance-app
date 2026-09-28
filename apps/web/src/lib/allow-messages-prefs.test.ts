// apps/web/src/lib/allow-messages-prefs.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Unit tests for the account-authoritative "Allow Messages" pref lib. Assert the OUTCOME and the
// failure contract the Settings toggle depends on:
//   - absent / NULL reads as true (default-ON, matches the DB COALESCE gate) — never silently OFF
//   - an explicit false is honored on read
//   - a failed READ resolves true (default-ON), never OFF
//   - write uses .update({allow_messages}).eq('id', userId) — NOT .upsert (column-grant 42501)
//   - a failed WRITE returns false so the UI reverts the optimistic toggle + shows the banner
//     (never showing a value that did not persist) — SWALLOW-MUTATION GUARD below proves this RED.
//
// Run with: npx vitest run src/lib/allow-messages-prefs.test.ts

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import {
  readAllowMessages,
  writeAllowMessages,
  DEFAULT_ALLOW_MESSAGES,
} from './allow-messages-prefs'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Fake Supabase client: rpc() returns { data, error }; from().update().eq() records the update
// row + the eq filter and returns { error }. `state` lets a test assert what was reached.
function makeClient(opts: {
  rpcResult?: { data: unknown; error: unknown }
  updateError?: unknown
}) {
  const state = {
    rpcCalled: false,
    updateRow: null as { allow_messages: boolean } | null,
    eqColumn: '' as string,
    eqValue: '' as string,
  }
  const client = {
    state,
    rpc: () => {
      state.rpcCalled = true
      return Promise.resolve(opts.rpcResult ?? { data: null, error: null })
    },
    from: () => ({
      update: (row: { allow_messages: boolean }) => {
        state.updateRow = row
        return {
          eq: (col: string, val: string) => {
            state.eqColumn = col
            state.eqValue = val
            return Promise.resolve({ error: opts.updateError ?? null })
          },
        }
      },
    }),
  }
  return client as unknown as SupabaseClient<Database> & { state: typeof state }
}

describe('readAllowMessages', () => {
  it('returns true when the accessor returns true', async () => {
    const client = makeClient({ rpcResult: { data: true, error: null } })
    expect(await readAllowMessages(client)).toBe(true)
    expect(client.state.rpcCalled).toBe(true)
  })

  it('honors an explicit false', async () => {
    const client = makeClient({ rpcResult: { data: false, error: null } })
    expect(await readAllowMessages(client)).toBe(false)
  })

  it('defaults ON when the accessor returns null (absent → default-ON)', async () => {
    const client = makeClient({ rpcResult: { data: null, error: null } })
    expect(await readAllowMessages(client)).toBe(DEFAULT_ALLOW_MESSAGES)
  })

  it('resolves ON when the RPC errors (never silently OFF)', async () => {
    const client = makeClient({ rpcResult: { data: null, error: { message: 'boom' } } })
    expect(await readAllowMessages(client)).toBe(true)
  })
})

describe('writeAllowMessages', () => {
  it('updates the own row via .update().eq(id) — NOT upsert', async () => {
    const client = makeClient({})
    const ok = await writeAllowMessages(client, 'user-123', false)
    expect(ok).toBe(true)
    expect(client.state.updateRow).toEqual({ allow_messages: false })
    expect(client.state.eqColumn).toBe('id')
    expect(client.state.eqValue).toBe('user-123')
  })

  // SWALLOW-MUTATION GUARD. The UI (updatePrivacy in settings-panel.tsx) reverts the optimistic
  // toggle + shows the banner ONLY when this returns false. If the lib swallowed the update error
  // and returned true, the toggle would display a value that never persisted — this asserts the
  // opposite, so a swallow-mutation (return true on error) turns this test RED.
  it('returns false when the update errors, so the UI can revert / surface the failure', async () => {
    const client = makeClient({ updateError: { message: 'permission denied', code: '42501' } })
    expect(await writeAllowMessages(client, 'user-123', true)).toBe(false)
  })

  it('returns false without touching the client when there is no user id', async () => {
    const client = makeClient({})
    const ok = await writeAllowMessages(client, null, true)
    expect(ok).toBe(false)
    expect(client.state.updateRow).toBeNull()
  })
})
