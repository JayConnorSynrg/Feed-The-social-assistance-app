// 16-notifications.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 16 — Notifications
// Surface: Notification bell in FeedShell header
// Upstream: Auth (M1), SECDEF inserters | Downstream: Map (M4), Applications (M10)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('16 — Notifications (PROD read-only)', () => {
  it('notifications is in supabase_realtime publication (live bell)', async () => {
    // Backend: supabase/migrations/20260630000100_realtime_publication_notifications_likes_comments.sql
    // Surface: use-notifications.ts:244 — postgres_changes subscription for live bell updates
    // WAL-safety confirmed 2026-06-30: all columns safe (id uuid, user_id uuid, type, title text,
    // message text, link text, application_id uuid, is_read boolean, created_at timestamptz).
    // RLS gates rows to auth.uid() — select/update/delete own only; no INSERT policy (forge-proof).
    const rows = await queryProd(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].tablename).toBe('notifications')
  })

  it('notifications table has NO INSERT policy (forge-proof)', async () => {
    // Backend: notifications_insert_system policy DROPPED — no replacement
    // Surface: security_advisor_remediation.sql:45-49 — client INSERT denied
    // Critical: client must not forge notifications into another user's feed
    const rows = await queryProd(`
      SELECT polname, polcmd
      FROM pg_policy
      WHERE polrelid = 'public.notifications'::regclass
    `)
    const insertPolicies = rows.filter((r) => r.polcmd === 'a') // 'a' = INSERT
    expect(insertPolicies.length).toBe(0)
  })

  it('notifications table has RLS enabled', async () => {
    // Backend: notifications — RLS yes (select/update/delete own policies)
    // Surface: use-notifications.ts:94-100 → own notifications only
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notifications'::regclass
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('notify_seekers_near_resource RPC is SECDEF', async () => {
    // Backend: notify_seekers_near_resource — SECDEF INSERT into notifications
    // Surface: feed-panel.tsx:369 → fires after new resource post
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND proname = 'notify_seekers_near_resource'
    `)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].prosecdef).toBe(true)
  })

  it('reminders table has RLS enabled', async () => {
    // Backend: reminders — row-scoped (per mission brief)
    // Surface: use-notifications.ts:185-233 reminder CRUD
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.reminders'::regclass
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })
})
