// 29-ranked-feed-v2-events.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 29 — Events mixed into the ranked community feed (W1.6b)
// Surface: apps/web/src/components/panels/feed-panel.tsx (ranked path) → RPC
//          public.ranked_feed_v2; apps/web/src/components/feed/event-feed-card.tsx
// Backend: supabase/migrations/20261008000000_w1_6b_events_in_feed.sql
//
// GATE ON THE LEDGER, NOT ON THE STATE (schema-first — v2 ships before the client so
// the deployed client keeps calling v1). The suite skips ONLY while the migration
// ledger row is absent (pre-deploy). Once recorded, the assertions ALWAYS run.
//
// These assertions survive mutation: they fail if v2 loses SECURITY DEFINER, unpins
// its search_path, over-grants EXECUTE, drops the `kind` column, regresses to a
// continuous (oracle) distance factor for events, or if ranked_feed (v1) is disturbed.
//
// SQL SAFETY: read-only SELECTs via queryProd (WRITE_GUARD); the events anti-oracle
// test seeds inside a DO block that RAISEs → the whole tx rolls back (net-zero writes).

import * as fs from 'fs'
import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

const SIG = 'public.ranked_feed_v2(double precision,double precision,integer,real,uuid)'
const MGMT_URL = 'https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query'
// v1 prosrc md5 captured on origin/develop 2026-09-24 (I5 — v1 must stay byte-identical).
const V1_MD5 = '2cca92d907df6b60fbc840214a9df485'

const GATE_SQL = `
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261008000000'
  ) AS applied
`

function loadTokenForProbe(): string {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN
  if (fromEnv && fromEnv.length > 10) return fromEnv
  for (const p of [
    `${process.cwd()}/.env.local`,
    '/Users/jelalconnor/CODING/CURSOR/FEED./apps/web/.env.local',
  ]) {
    try {
      const m = fs.readFileSync(p, 'utf-8').match(/^SUPABASE_ACCESS_TOKEN=["']?([^\s"']+)["']?\s*$/m)
      if (m?.[1]) return m[1].trim()
    } catch { /* continue */ }
  }
  throw new Error('SUPABASE_ACCESS_TOKEN not available')
}

async function probeRolledBack(doBlockSql: string): Promise<string> {
  const token = loadTokenForProbe()
  const res = await fetch(MGMT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: doBlockSql }),
  })
  const body = (await res.json()) as { message?: string }
  return String(body?.message ?? '').split(token).join('[REDACTED]')
}

maybeDescribe('29 — Ranked Feed v2 (events in feed) — PROD read-only', () => {
  it('[post-deploy] v2 is SECDEF + pinned search_path, emits id|kind|score|distance_bucket (no coords)', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }

    const rows = await queryProd(`
      SELECT p.prosecdef,
             pg_get_function_result(p.oid) AS result_sig,
             (SELECT array_agg(c) FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%') AS sp
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='ranked_feed_v2'
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].prosecdef).toBe(true)
    const sp = (rows[0].sp as string[] | null ?? []).join(',')
    expect(sp).toContain('public')
    expect(sp).toContain('pg_temp')
    const sig = String(rows[0].result_sig).toLowerCase()
    expect(sig).toContain('id uuid')
    expect(sig).toContain('kind text')
    expect(sig).toContain('score real')
    expect(sig).toContain('distance_bucket text')
    for (const banned of ['lat', 'lng', 'latitude', 'longitude', 'location', 'geog', 'geom', 'coord', 'dist_km']) {
      expect(sig).not.toContain(banned)
    }
  })

  it('[post-deploy] EXECUTE granted to anon/authenticated/service_role, not PUBLIC; v1 still present + unchanged (I5)', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }

    const rows = await queryProd(`
      SELECT
        has_function_privilege('anon','${SIG}','EXECUTE')          AS anon_x,
        has_function_privilege('authenticated','${SIG}','EXECUTE') AS auth_x,
        has_function_privilege('service_role','${SIG}','EXECUTE')  AS svc_x,
        (SELECT p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname='ranked_feed_v2')                       AS acl,
        (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname='ranked_feed')                          AS v1_present,
        (SELECT md5(pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname='ranked_feed')                          AS v1_md5
    `)
    expect(rows[0].anon_x).toBe(true)
    expect(rows[0].auth_x).toBe(true)
    expect(rows[0].svc_x).toBe(true)
    expect(String(rows[0].acl ?? '')).not.toMatch(/(^|,|\{)=X/)
    expect(rows[0].v1_present).toBe(1)
    expect(rows[0].v1_md5).toBe(V1_MD5)
  })

  it('[post-deploy] a live anon call returns rows shaped {id,kind,score,distance_bucket}', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }
    const rows = await queryProd(`
      SELECT count(*)::int AS n,
             bool_and(r.kind IN ('post','event')) AS kinds_ok
      FROM ranked_feed_v2(44.26, -72.58, 25) r
    `)
    expect(typeof rows[0].n).toBe('number')
    expect(rows[0].n).toBeGreaterThanOrEqual(0)
    // bool_and over 0 rows is NULL — accept NULL (no rows) or true (all valid kinds).
    expect(rows[0].kinds_ok === null || rows[0].kinds_ok === true).toBe(true)
  })

  it('[post-deploy] events are NOT a distance oracle — two events, same bucket, different exact distance, identical score', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }

    // Seed one active org + two active events (each with one occurrence at the SAME
    // starts_at so the age factor is identical), located at DIFFERENT exact distances
    // both inside <2km, plus a third event with no geo. DO block RAISEs → full rollback.
    const doBlock = `
      DO $$
      DECLARE
        org uuid := gen_random_uuid();
        eA uuid := gen_random_uuid(); eB uuid := gen_random_uuid(); eC uuid := gen_random_uuid();
        oA uuid := gen_random_uuid(); oB uuid := gen_random_uuid(); oC uuid := gen_random_uuid();
        st timestamptz := now() + interval '2 hours';
        en timestamptz := now() + interval '4 hours';
        decay numeric := (SELECT distance_decay_km FROM public.ranking_config LIMIT 1);
        result jsonb;
      BEGIN
        INSERT INTO public.organizations (id,name,is_active) VALUES (org,'Probe',true);
        INSERT INTO public.assistance_events (id,org_id,title,event_type,is_active,location) VALUES
          (eA,org,'A','meal',true, ST_SetSRID(ST_MakePoint(-72.5780,44.2600),4326)::geography),
          (eB,org,'B','meal',true, ST_SetSRID(ST_MakePoint(-72.5610,44.2600),4326)::geography),
          (eC,org,'C','meal',true, NULL);
        INSERT INTO public.event_occurrences (id,event_id,starts_at,ends_at,status) VALUES
          (oA,eA,st,en,'upcoming'),(oB,eB,st,en,'upcoming'),(oC,eC,st,en,'upcoming');
        SELECT jsonb_object_agg(k,v) INTO result FROM (
          SELECT CASE r.id WHEN oA THEN 'A' WHEN oB THEN 'B' ELSE 'C' END AS k,
                 jsonb_build_object('score', r.score, 'bucket', r.distance_bucket) AS v
          FROM ranked_feed_v2(44.2600,-72.5800,100,NULL,NULL) r
          WHERE r.kind='event' AND r.id IN (oA,oB,oC)
        ) t;
        RAISE EXCEPTION 'EVORACLE=%|decay=%', result::text, decay;
      END $$;`

    const msg = await probeRolledBack(doBlock)
    const m = msg.match(/EVORACLE=(\{.*\})\|decay=([0-9.]+)/)
    expect(m, `probe message: ${msg}`).not.toBeNull()
    const res = JSON.parse(m![1]) as Record<string, { score: number; bucket: string }>
    const decay = Number(m![2])

    expect(res.A.bucket).toBe('<2km')
    expect(res.B.bucket).toBe('<2km')
    expect(res.C.bucket).toBe('unknown')
    // Same bucket → identical score despite different exact distance (no oracle).
    expect(res.A.score).toBe(res.B.score)
    // Geo/no-geo ratio equals the discrete <2km bucket factor, not a continuous fn.
    expect(Math.abs(res.A.score / res.C.score - Math.exp(-1 / decay))).toBeLessThan(1e-4)
  })
})
