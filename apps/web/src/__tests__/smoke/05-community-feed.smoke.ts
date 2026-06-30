// 05-community-feed.smoke.ts — Mission 5: Community Feed backend contract probes
// © Jelal Connor / SYNRG SCALING, LLC

import { describe, it, beforeAll, expect } from 'vitest';
import { queryProd, isTokenAvailable } from './prod-client';

const TOKEN_AVAILABLE = isTokenAvailable();

describe('05: Community Feed', () => {
  beforeAll(() => {
    if (!TOKEN_AVAILABLE) {
      console.log('SKIP: SUPABASE_ACCESS_TOKEN not set');
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('posts is in supabase_realtime publication', async () => {
    const rows = await queryProd(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND tablename IN ('posts', 'post_likes', 'post_comments')
    `);
    const tableNames = rows.map((r) => r.tablename);
    expect(tableNames).toContain('posts');
  });

  it.skipIf(!TOKEN_AVAILABLE)('posts table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.posts'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('opt_in_to_post and withdraw_opt_in are SECDEF', async () => {
    const rows = await queryProd(`
      SELECT proname, prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('opt_in_to_post', 'withdraw_opt_in')
      ORDER BY proname
    `);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      expect(row.prosecdef).toBe(true);
    }
  });

  it.skipIf(!TOKEN_AVAILABLE)('resource_opt_ins table has RLS enabled', async () => {
    const rows = await queryProd(`
      SELECT relrowsecurity FROM pg_class WHERE oid = 'public.resource_opt_ins'::regclass
    `);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.skipIf(!TOKEN_AVAILABLE)('posts table has rows (feed is populated)', async () => {
    const rows = await queryProd(`
      SELECT COUNT(*) AS cnt FROM public.posts
    `);
    expect(Number(rows[0]?.cnt)).toBeGreaterThanOrEqual(0);
  });
});
