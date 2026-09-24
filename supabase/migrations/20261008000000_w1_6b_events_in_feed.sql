-- 20261008000000_w1_6b_events_in_feed.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
--
-- FULL-FEED W1.6b — community events mixed into the ranked community feed.
--
-- Adds public.ranked_feed_v2(...): the W1.3 posts ranking (BYTE-IDENTICAL to the
-- deployed public.ranked_feed) UNION ALL an events branch, one feed row per
-- eligible event = its next non-cancelled, not-ended occurrence within the same
-- 30-day horizon the events-panel uses. A single cross-kind keyset on
-- (score DESC, id DESC) pages posts and events together.
--
-- SCHEMA-FIRST: public.ranked_feed (v1) is left UNTOUCHED so the currently
-- deployed client keeps working until the W1.6b client deploys (I5). The v1
-- prosrc md5 must be unchanged before/after this migration.
--
-- Ranking rulings (LOCKED):
--   posts:  score = (1+log10(1+likes+2·comments)) · exp(-ln2·age_h/half_life)
--           · <bucketed distance factor> [+1e6 if pinned]
--           age_h = hours since created_at.
--   events: engagement term = 1 (no likes/comments); age_h = |now - starts_at|
--           in hours (peaks around start, same half-life fading before AND after);
--           SAME distance bucketing from the event's geocoded location (unknown
--           when null); never pinned.
--
-- Anti-oracle (SEV-HIGH, carried over from W1.3): the distance contribution is
-- QUANTIZED to the SAME coarse buckets as the returned distance_bucket, using a
-- representative distance per bucket (<2→1, 2-10→6, 10-50→30, >50→75 km). The
-- exact dist_km is computed once per row but NEVER returned, so score cannot be
-- inverted to recover an event's exact coordinates (multilateration). dist_factor
-- and distance_bucket derive from the SAME dist_km thresholds so they can never
-- disagree — for events exactly as for posts.
--
-- Events visibility replicates what the caller could SELECT on event_occurrences
-- (the RPC is SECURITY DEFINER, so it must reproduce the RLS the same way the
-- posts branch reproduces posts_select_public). The occurrence SELECT policies are
-- the UNION of:
--   occurrences_admin_select        -> is_current_user_admin()      (platform admin)
--   occurrences_org_admin_select    -> is_org_admin(ae.org_id)      (org admin, any state)
--   occurrences_select_active_event -> ae.is_active AND org.is_active (public)
--   occurrences_select_reachable_authed -> w1_6a_occ_authed_reachable(id)
--                                          (authed non-guest: in-progress occ of a
--                                           retired-event on an active org; org admin)
-- so an occurrence is feed-visible iff the OR of those four predicates holds.

CREATE OR REPLACE FUNCTION public.ranked_feed_v2(
  p_lat double precision DEFAULT NULL::double precision,
  p_lng double precision DEFAULT NULL::double precision,
  p_limit integer DEFAULT 25,
  p_cursor_score real DEFAULT NULL::real,
  p_cursor_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(id uuid, kind text, score real, distance_bucket text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
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
  -- ===================================================================
  -- POSTS branch — BYTE-IDENTICAL to public.ranked_feed (W1.3). Any change
  -- here breaks I1; the harness compares the post rows of v2 against v1.
  -- ===================================================================
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
            WHEN v.dist_km IS NULL THEN 1.0
            WHEN v.dist_km < 2     THEN exp( -1.0  / cfg.distance_decay_km )
            WHEN v.dist_km < 10    THEN exp( -6.0  / cfg.distance_decay_km )
            WHEN v.dist_km < 50    THEN exp( -30.0 / cfg.distance_decay_km )
            ELSE                        exp( -75.0 / cfg.distance_decay_km )
          END
        + CASE WHEN v.is_pinned THEN 1000000.0 ELSE 0 END
      ) AS raw_score
    FROM visible v
    CROSS JOIN cfg
  ),
  scored AS (
    SELECT
      b.id,
      b.dist_km,
      (CASE WHEN b.raw_score < 1e-20 THEN 0.0 ELSE b.raw_score END)::real AS score
    FROM base b
  ),
  posts_ranked AS (
    SELECT
      s.id,
      'post'::text AS kind,
      s.score,
      CASE
        WHEN s.dist_km IS NULL   THEN 'unknown'
        WHEN s.dist_km < 2       THEN '<2km'
        WHEN s.dist_km < 10      THEN '2-10km'
        WHEN s.dist_km < 50      THEN '10-50km'
        ELSE                          '>50km'
      END AS distance_bucket
    FROM scored s
  ),
  -- ===================================================================
  -- EVENTS branch — one row per eligible event (its NEXT non-cancelled,
  -- not-ended occurrence within the 30-day horizon), scored per the event
  -- ruling, distance bucketed like posts. dist_km NEVER returned (anti-oracle).
  -- ===================================================================
  ev_eligible AS (
    SELECT
      eo.id        AS occ_id,
      eo.event_id  AS event_id,
      eo.starts_at AS starts_at,
      CASE
        WHEN o.geo IS NOT NULL AND ae.location IS NOT NULL
        THEN ST_Distance(ae.location, o.geo) / 1000.0
        ELSE NULL
      END AS dist_km
    FROM public.event_occurrences eo
    JOIN public.assistance_events ae ON ae.id = eo.event_id
    JOIN public.organizations org    ON org.id = ae.org_id
    CROSS JOIN origin o
    WHERE eo.status = 'upcoming'                          -- not cancelled, not completed
      AND eo.ends_at   >= now()                            -- not ended (in-progress or upcoming)
      AND eo.starts_at <= now() + interval '30 days'       -- horizon (matches events-panel)
      AND (                                                -- caller-could-SELECT (union of RLS)
             public.is_current_user_admin()                                       -- occurrences_admin_select (platform admin)
          OR public.is_org_admin(ae.org_id)                                       -- occurrences_org_admin_select (org admin, any state)
          OR (ae.is_active AND org.is_active)                                      -- occurrences_select_active_event (public, incl. anon)
          OR ((SELECT auth.uid()) IS NOT NULL                                      -- occurrences_select_reachable_authed is TO authenticated:
              AND public.w1_6a_occ_authed_reachable(eo.id))                        -- gate on a real session so a null-uid anon never gets the
      )                                                                            -- in-progress-retired path (the helper's guest-exclusion is
                                                                                   -- vacuously true when auth.uid() is NULL).
  ),
  ev_next AS (
    -- The NEXT occurrence per event = earliest eligible starts_at. An in-progress
    -- occurrence (starts_at in the past, ends_at in the future) has the earliest
    -- starts_at, so it wins over a later upcoming one — matching "ranks highest
    -- around its start".
    SELECT DISTINCT ON (n.event_id)
      n.occ_id, n.event_id, n.starts_at, n.dist_km
    FROM ev_eligible n
    ORDER BY n.event_id, n.starts_at ASC, n.occ_id ASC
  ),
  ev_base AS (
    SELECT
      x.occ_id,
      x.dist_km,
      (
          1.0                                              -- engagement term: events have none
        * exp( -ln(2.0)
               * ( abs(EXTRACT(EPOCH FROM (now() - x.starts_at))) / 3600.0 )  -- age_h = |now - starts_at|
               / cfg.half_life_hours )
        * CASE
            WHEN x.dist_km IS NULL THEN 1.0
            WHEN x.dist_km < 2     THEN exp( -1.0  / cfg.distance_decay_km )
            WHEN x.dist_km < 10    THEN exp( -6.0  / cfg.distance_decay_km )
            WHEN x.dist_km < 50    THEN exp( -30.0 / cfg.distance_decay_km )
            ELSE                        exp( -75.0 / cfg.distance_decay_km )
          END
      ) AS raw_score                                       -- never pinned
    FROM ev_next x
    CROSS JOIN cfg
  ),
  events_ranked AS (
    SELECT
      eb.occ_id AS id,                                     -- feed row id = occurrence id
      'event'::text AS kind,
      (CASE WHEN eb.raw_score < 1e-20 THEN 0.0 ELSE eb.raw_score END)::real AS score,
      CASE
        WHEN eb.dist_km IS NULL THEN 'unknown'
        WHEN eb.dist_km < 2     THEN '<2km'
        WHEN eb.dist_km < 10    THEN '2-10km'
        WHEN eb.dist_km < 50    THEN '10-50km'
        ELSE                         '>50km'
      END AS distance_bucket
    FROM ev_base eb
  ),
  merged AS (
    SELECT id, kind, score, distance_bucket FROM posts_ranked
    UNION ALL
    SELECT id, kind, score, distance_bucket FROM events_ranked
  )
  SELECT
    m.id,
    m.kind,
    m.score,
    m.distance_bucket
  FROM merged m
  -- Single cross-kind keyset (INV-C): (score, id) < cursor in the same (DESC, DESC)
  -- order. occ_id / post_id are distinct UUIDs so the (score, id) key is unique
  -- across kinds; the id tiebreak keeps it strictly monotonic on score ties.
  WHERE
    p_cursor_score IS NULL
    OR (m.score, m.id) < (p_cursor_score, p_cursor_id)
  ORDER BY m.score DESC, m.id DESC
  LIMIT greatest(coalesce(p_limit, 25), 1);
$function$;

-- Least-privilege EXECUTE, matching public.ranked_feed exactly.
REVOKE EXECUTE ON FUNCTION public.ranked_feed_v2(double precision, double precision, integer, real, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ranked_feed_v2(double precision, double precision, integer, real, uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.ranked_feed_v2(double precision, double precision, integer, real, uuid) IS
  'W1.6b: ranked community feed = W1.3 posts (byte-identical to ranked_feed) UNION ALL one row per eligible event (next non-cancelled/not-ended occurrence within 30d), single cross-kind keyset on (score DESC, id DESC). Events: engagement=1, age_h=|now-starts_at|, quantized distance bucket (no oracle). Visibility replicates the occurrence SELECT policies.';
