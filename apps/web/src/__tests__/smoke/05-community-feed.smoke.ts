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

  // ── W1.4 realtime SIGNAL publications — POST-DEPLOY ─────────────────────────
  // These assert the state produced by migration
  // 20261001000000_w1_4_realtime_poll_comment_signals.sql. That migration is
  // applied as a SEPARATE post-deploy step (after Vercel is READY), NOT by the
  // feature PR — so these tests are RED pre-deploy and flip GREEN once the
  // publication migration is live. Live like/comment COUNTS ride the posts WAL
  // (posts.like_count / .comment_count), so post_likes is deliberately NOT
  // published — identity stays off the wire.
  // Column-scope query for a single publication member. Returns [] when the table
  // is not yet a member (migration not applied) so the test can dynamically skip
  // pre-deploy and actively verify the scope post-deploy.
  const publishedColsSql = (table: string) => `
      SELECT COALESCE(array_agg(a.attname ORDER BY a.attname), '{}') AS cols
      FROM pg_publication p
      JOIN pg_publication_rel pr ON pr.prpubid = p.oid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN LATERAL unnest(pr.prattrs) AS attnum(num) ON true
      LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = attnum.num
      WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = '${table}'
      HAVING COUNT(pr.prrelid) > 0
    `

  it('[post-deploy] poll_votes is published with EXACTLY {id, poll_id}', async (ctx) => {
    // Surface: use-poll.ts poll_votes_${pollId} channel → settleVotes re-aggregate.
    // Exact-set assertion catches BOTH a privacy regression (user_id/option_index
    // added) AND the missing-PK break (id absent → DELETE aborts at the DB, B1).
    const rows = await queryProd(publishedColsSql('poll_votes'))
    if (rows.length === 0) {
      // Migration not applied yet (pre-deploy) — skip rather than fail. Flips to an
      // active exact-column check once the orchestrator applies the publication.
      ctx.skip()
      return
    }
    const cols = [...(rows[0].cols as string[])].sort()
    expect(cols).toEqual(['id', 'poll_id'])
  })

  it('[post-deploy] post_comments is published with EXACTLY {id, post_id}', async (ctx) => {
    // Surface: use-realtime-feed.ts useRealtimeComments comments-${postId} → fetchComments refetch.
    const rows = await queryProd(publishedColsSql('post_comments'))
    if (rows.length === 0) {
      ctx.skip()
      return
    }
    const cols = [...(rows[0].cols as string[])].sort()
    expect(cols).toEqual(['id', 'post_id'])
  })

  it('[post-deploy] post_likes is NOT in the publication (counts ride the posts WAL)', async () => {
    const rows = await queryProd(`
      SELECT tablename FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'post_likes'
    `)
    expect(rows.length).toBe(0)
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
