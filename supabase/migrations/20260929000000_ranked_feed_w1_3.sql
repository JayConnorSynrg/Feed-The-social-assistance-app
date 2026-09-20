-- W1.3 — Ranked community feed RPC + posts.location column-privacy CONTRACT (V1b)
-- + Realtime WAL column gate. Builds directly on 20260928000000 (the schema spine).
--
-- APPLIED-TO-PROD ORDERING (see DEPLOY SEQUENCE in the wave brief):
--   • Section 1 (ranked_feed RPC) is SAFE + non-breaking and IS applied to prod at
--     build time (via Management API) so it can be contract-probed before merge.
--   • Section 2 (V1b REVOKE→GRANT) and Section 3 (Realtime WAL column gate) are the
--     BREAKING column-privacy contract. They are present in this file but are
--     applied to prod ONLY AFTER the app-side EXPAND (the 4 anon-facing posts
--     `.select('*')` reads → explicit column lists omitting `location`) has shipped
--     to prod. Applying Section 2 while any anon `select('*')` on posts is live would
--     401 the whole request (PostgREST does NOT narrow `*` under column grants).
--
-- Empirical baseline verified live against ndtpovonpadugthmcntl on 2026-09-20:
--   posts has 19 columns (location=col21 geography, like_count/comment_count present),
--   only TABLE-level SELECT granted to anon+authenticated (posts.location attacl = NULL,
--   i.e. no column grant yet → anon CAN read location today), posts is in the
--   supabase_realtime publication with NO column list (ships every column incl. location),
--   ranking_config singleton = {half_life_hours:24, distance_decay_km:20, comment_weight:2}.

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — ranked_feed RPC  (SAFE / non-breaking / applied to prod at build).
-- ─────────────────────────────────────────────────────────────────────────────
-- Ranking-config schema note (decision on brief step 3a): NO null_distance_factor
-- column is added. A post with no location (or a caller with no geo) uses a neutral
-- distance factor of 1.0 INLINE. Adding a column for a constant that never varies
-- would be speculative scope; the three tunable constants already live in
-- ranking_config and are read below.
--
-- SECURITY DEFINER (owned by postgres, rolbypassrls) — REQUIRED, not INVOKER:
--   after V1b (Section 2) an invoker=anon loses SELECT on posts.location, so an
--   INVOKER function could not compute distance. As DEFINER the function reads
--   location internally and emits ONLY a coarse distance_bucket string — never a
--   raw latitude/longitude/distance (INV-A). search_path is pinned to a NON-mutable
--   'public','pg_temp'; EXECUTE is revoked from PUBLIC then granted to the three
--   real roles (INV-D, the repo SECDEF-hardening pattern).
--
-- Row visibility (INV-B): because DEFINER bypasses RLS, the WHERE clause reproduces
-- the live posts_select_public policy EXACTLY:
--   (NOT is_hidden) OR (user_id = auth.uid())
--   OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_staff = true)
-- auth.uid() still resolves to the CALLING user inside a DEFINER function (it reads
-- the request JWT claim GUC, independent of the function owner), so owner/staff
-- visibility is preserved and anon sees only non-hidden rows.
--
-- Ordering + keyset (INV-C): pinned-first is retained by folding a large additive
-- boost (1e6, which dominates any realistic organic score) into the returned score
-- for pinned posts. The sort then collapses to a single monotonic key (score DESC,
-- id DESC), so the keyset cursor is a clean 2-tuple compare — every eligible post
-- is returned exactly once across pages, no duplicate and no skip. The client passes
-- back the last row's returned score (already boosted) + id as the next cursor.
--   forward page (descending): rows AFTER the cursor satisfy
--     (score, id) < (p_cursor_score, p_cursor_id)
--   which is exactly  score < cursor_score OR (score = cursor_score AND id < cursor_id).
-- Score is a computed expression, so it is materialised in the `scored` CTE and the
-- keyset predicate is applied in the outer query where the alias is in scope.

CREATE OR REPLACE FUNCTION public.ranked_feed(
  p_lat          double precision DEFAULT NULL,
  p_lng          double precision DEFAULT NULL,
  p_limit        integer          DEFAULT 25,
  p_cursor_score real             DEFAULT NULL,
  p_cursor_id    uuid             DEFAULT NULL
)
RETURNS TABLE(id uuid, score real, distance_bucket text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH cfg AS (
    SELECT half_life_hours, distance_decay_km, comment_weight
    FROM public.ranking_config
    LIMIT 1
  ),
  caller AS (
    SELECT (SELECT auth.uid()) AS uid
  ),
  origin AS (
    SELECT CASE
             WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
             THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
             ELSE NULL
           END AS geo
  ),
  -- `visible` computes the exact distance in km ONCE per row that passes the row
  -- filter (posts_select_public reproduced). dist_km stays internal — it is used
  -- only to derive the coarse bucket; it is NEVER returned.
  visible AS (
    SELECT
      p.id,
      p.is_pinned,
      p.like_count,
      p.comment_count,
      p.created_at,
      CASE
        WHEN o.geo IS NOT NULL AND p.location IS NOT NULL
        THEN ST_Distance(p.location, o.geo) / 1000.0
        ELSE NULL
      END AS dist_km
    FROM public.posts p
    CROSS JOIN origin o
    CROSS JOIN caller c
    WHERE
         (NOT p.is_hidden)
      OR (p.user_id = c.uid)
      OR EXISTS (
           SELECT 1 FROM public.profiles pr
           WHERE pr.id = c.uid AND pr.is_staff = true
         )
  ),
  -- `base` computes the raw (double precision) score ONCE per visible post.
  --
  -- ANTI-ORACLE (SEV-HIGH fix): the distance contribution is QUANTIZED to the SAME
  -- coarse buckets as the returned distance_bucket, using a representative distance
  -- per bucket — NOT the continuous exp(-exact_dist/decay). A continuous factor made
  -- `score` a distance oracle: with decay_km readable from ranking_config and the
  -- caller controlling the origin, `d = -decay*ln(S_origin/S_null)` recovers exact
  -- distance, and three origins multilaterate any geo-tagged post's coordinates.
  -- With the step function, two posts in the same bucket at different exact distances
  -- get the IDENTICAL factor, so the score ratio can only take the handful of discrete
  -- bucket values → no exact distance is recoverable. dist_factor and distance_bucket
  -- are both derived from the SAME dist_km thresholds below, so they can never disagree.
  -- Representative distances (bucket midpoints, km): <2→1, 2-10→6, 10-50→30, >50→75.
  base AS (
    SELECT
      v.id,
      v.dist_km,
      (
          (1 + log(10.0, 1 + v.like_count + cfg.comment_weight * v.comment_count))
        * exp( -ln(2.0)
               * (EXTRACT(EPOCH FROM (now() - v.created_at)) / 3600.0)
               / cfg.half_life_hours )
        * CASE
            WHEN v.dist_km IS NULL THEN 1.0                                  -- unknown / no geo
            WHEN v.dist_km < 2     THEN exp( -1.0  / cfg.distance_decay_km ) -- <2km   rep 1km
            WHEN v.dist_km < 10    THEN exp( -6.0  / cfg.distance_decay_km ) -- 2-10km rep 6km
            WHEN v.dist_km < 50    THEN exp( -30.0 / cfg.distance_decay_km ) -- 10-50km rep 30km
            ELSE                        exp( -75.0 / cfg.distance_decay_km ) -- >50km  rep 75km
          END
        -- Pinned-first: a boost that dominates any realistic organic score, so the
        -- sort collapses to a single monotonic key (score DESC, id DESC) and the
        -- keyset cursor stays a clean 2-tuple (INV-C).
        + CASE WHEN v.is_pinned THEN 1000000.0 ELSE 0 END
      ) AS raw_score
    FROM visible v
    CROSS JOIN cfg
  ),
  scored AS (
    SELECT
      b.id,
      b.dist_km,
      -- Clamp to 0 below 1e-20 BEFORE the ::real cast: a very old post's time-decay
      -- factor can be a valid double that underflows float4, which Postgres raises as
      -- "value out of range: underflow". Such scores are negligible; flooring them to
      -- 0 keeps the row (ranked last, ordered by id) instead of erroring the whole
      -- page. 1e-20 sits far above the float4 minimum (~1.2e-38) so no representable
      -- meaningful score is lost.
      (CASE WHEN b.raw_score < 1e-20 THEN 0.0 ELSE b.raw_score END)::real AS score
    FROM base b
  )
  SELECT
    s.id,
    s.score,
    -- SAME thresholds as the dist_factor above, so bucket and factor never disagree.
    CASE
      WHEN s.dist_km IS NULL   THEN 'unknown'
      WHEN s.dist_km < 2       THEN '<2km'
      WHEN s.dist_km < 10      THEN '2-10km'
      WHEN s.dist_km < 50      THEN '10-50km'
      ELSE                          '>50km'
    END AS distance_bucket
  FROM scored s
  -- Keyset (INV-C): (score, id) < cursor in the same (DESC, DESC) order. score is now
  -- a STEP function of the bucket, so many rows share a score; the id tiebreak keeps
  -- the key strictly monotonic and every row is returned exactly once (no cursor stall
  -- on ties). OBS-1 (accepted by design): score reflects like/comment counts captured
  -- at query time, so a post gaining engagement mid-pagination can shift buckets of
  -- the sort key between pages and be skipped or repeated across a Load-More boundary.
  WHERE
    p_cursor_score IS NULL
    OR (s.score, s.id) < (p_cursor_score, p_cursor_id)
  ORDER BY s.score DESC, s.id DESC
  LIMIT greatest(coalesce(p_limit, 25), 1);
$$;

-- INV-D grant hardening: drop the implicit PUBLIC execute, grant only to the real
-- client + service roles.
REVOKE EXECUTE ON FUNCTION public.ranked_feed(double precision, double precision, integer, real, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ranked_feed(double precision, double precision, integer, real, uuid) TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — V1b CONTRACT: close posts.location to public roles (BREAKING).
-- ⚠️ NOT applied to prod at build time. Apply ONLY after the app-side EXPAND ships.
--
-- posts currently has only a TABLE-level SELECT grant to anon/authenticated (every
-- column attacl is NULL), so a bare column REVOKE is inert. Closing the exposure is
-- the atomic expand/contract below: REVOKE the table-level SELECT, then GRANT SELECT
-- on every column EXCEPT location. Enumerated dynamically so the list stays correct
-- as columns are added (INV-A: location is the only column with no anon/authenticated
-- grant afterward). One DO block = one implicit transaction → no window in which
-- location is public-readable mid-apply.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  col_list text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO col_list
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'posts'
     AND column_name <> 'location';
  IF col_list IS NULL THEN
    RAISE EXCEPTION 'W1.3 V1b: refusing to re-grant — enumerated posts column list is empty';
  END IF;
  EXECUTE 'REVOKE SELECT ON public.posts FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.posts TO anon, authenticated', col_list);
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — Realtime WAL column gate (BREAKING for the WAL payload shape).
-- ⚠️ NOT applied to prod at build time. Apply together with Section 2.
--
-- Column-level GRANTs do NOT cover the logical-replication (Realtime) payload:
-- posts is in the supabase_realtime publication with no column list, so the WAL
-- ships every column INCLUDING location. Postgres 15+ lets a publication carry a
-- per-table column list; set it to the safe columns (every column except location).
-- The table's replica identity is its primary key (id), which is included in the
-- list, so INSERT/UPDATE/DELETE continue to replicate for the safe columns (INV-A:
-- the publication no longer ships the location column).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  col_list text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO col_list
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'posts'
     AND column_name <> 'location';
  IF col_list IS NULL THEN
    RAISE EXCEPTION 'W1.3 WAL gate: empty posts column list';
  END IF;
  EXECUTE format('ALTER PUBLICATION supabase_realtime SET TABLE public.posts (%s)', col_list);
END $$;
