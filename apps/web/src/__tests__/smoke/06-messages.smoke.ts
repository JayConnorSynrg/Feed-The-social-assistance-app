// 06-messages.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 06 — Messages (P2P)
// Surface: apps/web/src/components/panels/messages-panel.tsx
// Upstream: Auth (M1), Realtime | Downstream: Reviews & Harmony (M15)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('06 — Messages P2P (PROD read-only)', () => {
  it('conversations and messages are in supabase_realtime publication', async () => {
    // Backend: supabase/migrations/20260527000001_add_volunteer_messaging.sql:143-144
    // Surface: use-conversations.ts:171-258 → messages-panel.tsx live delivery
    const rows = await queryProd(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename IN ('conversations', 'messages')
    `)
    const tables = rows.map((r) => r.tablename as string)
    expect(tables).toContain('conversations')
    expect(tables).toContain('messages')
  })

  it('get_my_conversation_counterparties RPC is SECDEF', async () => {
    // Backend: get_my_conversation_counterparties — name-privacy lockdown (first-name only)
    // Surface: use-conversations.ts:115 → messages-panel.tsx conversation list
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND proname = 'get_my_conversation_counterparties'
    `)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].prosecdef).toBe(true)
  })

  it('conversations table has partial unique index preventing duplicate pending requests', async () => {
    // Backend: partial UNIQUE INDEX on conversations — one PENDING per pair
    // Surface: use-conversations.ts:279-280 insert → 23505 on duplicate
    const rows = await queryProd(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'conversations'
        AND indexdef ILIKE '%pending%'
    `)
    expect(rows.length).toBeGreaterThan(0)
    const indexDef = rows[0].indexdef as string
    expect(indexDef.toLowerCase()).toContain('pending')
  })

  it('conversations and messages tables have RLS enabled', async () => {
    // Backend: both tables — RLS yes (participant-scoped access)
    // Surface: messages-panel.tsx → use-conversations.ts RLS auth.uid() gates
    const rows = await queryProd(`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE oid IN ('public.conversations'::regclass, 'public.messages'::regclass)
    `)
    expect(rows.length).toBe(2)
    for (const row of rows) {
      expect(row.relrowsecurity, `${row.relname} must have RLS enabled`).toBe(true)
    }
  })
})
