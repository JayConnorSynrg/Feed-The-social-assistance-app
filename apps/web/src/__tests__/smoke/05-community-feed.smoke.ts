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

  it('post_likes and post_comments are in supabase_realtime publication (live counts)', async () => {
    // Backend: supabase/migrations/20260630000100_realtime_publication_notifications_likes_comments.sql
    // Surface: use-realtime-feed.ts:171 (likes) / :225 (comments) — postgres_changes subscriptions
    // for live like/comment count updates in feed-panel.tsx.
    // WAL-safety confirmed 2026-06-30: post_likes (user_id, post_id, created_at — no PII),
    // post_comments (id, post_id, user_id, content, parent_id, is_hidden, created_at, updated_at —
    // content is public-facing comment text already displayed in the feed). RLS gating confirmed.
    const rows = await queryProd(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND tablename IN ('post_likes', 'post_comments')
      ORDER BY tablename
    `)
    const names = rows.map((r: { tablename: string }) => r.tablename)
    expect(names).toContain('post_comments')
    expect(names).toContain('post_likes')
    expect(rows.length).toBe(2)
  })

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
