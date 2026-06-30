// 05-community-feed.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 05 — Community Feed
// Surface: apps/web/src/components/panels/feed-panel.tsx
// Upstream: Auth (M1), Realtime | Downstream: Notifications (M16), Moderation (M17)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('05 — Community Feed (PROD read-only)', () => {
  it('posts table is in supabase_realtime publication', async () => {
    // Backend: posts realtime publication — supabase/migrations/20260619000100_posts_realtime_publication.sql:14
    // Surface: use-realtime-feed.ts:72-92 → feed-panel.tsx live updates
    const rows = await queryProd(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'posts'
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].tablename).toBe('posts')
  })

  it.todo(
    // REAL GAP: post_likes and post_comments absent from supabase_realtime publication; live
    // like counts and comment counts will not update in real-time — feed-panel shows stale counts.
    // (use-realtime-feed.ts:152-166 likes, :207-221 comments)
    // fix = migration: ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes, public.post_comments
    // Live DB confirmed 2026-06-30: both tables absent from supabase_realtime.
    // No PII in WAL payloads (post_likes: id, post_id, user_id; post_comments: id, post_id, user_id, content, created_at).
    // RLS gating confirmed on both tables. Migration unblocked — track in backlog with M19 notifications gap.
    'post_likes and post_comments are in realtime publication (BLOCKED: absent — add migration ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes, public.post_comments)',
  )

  it('opt_in_to_post and withdraw_opt_in RPCs are SECDEF', async () => {
    // Backend: atomic slot decrement with SELECT FOR UPDATE + SECDEF
    // Surface: use-opt-ins.ts:89 (opt-in), :109 (withdraw)
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('opt_in_to_post', 'withdraw_opt_in')
    `)
    // May have 2 definitions each (base + guest-gating re-declare) — at least one per name
    const names = rows.map((r) => r.proname as string)
    expect(names).toContain('opt_in_to_post')
    expect(names).toContain('withdraw_opt_in')
    for (const row of rows) {
      expect(row.prosecdef, `${row.proname} must be SECDEF`).toBe(true)
    }
  })

  it('posts table has RLS enabled', async () => {
    // Backend: posts — RLS yes (per mission brief)
    // Surface: feed-panel.tsx post reads are auth.uid()-scoped
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.posts'::regclass
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('resource_opt_ins table has RLS enabled', async () => {
    // Backend: resource_opt_ins — one row per seeker↔post
    // Surface: opt-in button → use-opt-ins.ts
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.resource_opt_ins'::regclass
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('submit_content_report RPC exists and is SECDEF', async () => {
    // Backend: submit_content_report — files abuse report — SECDEF
    // Surface: feed-panel.tsx:1781 → rpc('submit_content_report')
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND proname = 'submit_content_report'
    `)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].prosecdef).toBe(true)
  })
})
