-- Migration: 20260608000400_safety_alerts.sql
-- Feature: All-roles safety pin / map marker
--
-- PURPOSE
--   Community-submitted safety alerts visible on the map to all users.
--   Publish-then-review: pins go live instantly, carry an "Unverified —
--   neighbor report" trust label, receive community confirm/clear votes,
--   decay via severity-scaled expires_at, and are subject to admin post-hoc
--   removal.
--
-- EXPIRY MODEL (no background cron needed)
--   safety_alerts_in_view already filters WHERE expires_at > now() so expired
--   pins disappear from the map automatically. No background job is required.
--   Severity → TTL mapping:  1=2h  2=6h  3=24h  4=72h
--
-- SECURITY
--   All writes go through SECURITY DEFINER RPCs (REVOKE from PUBLIC+anon,
--   GRANT to authenticated).  No direct client INSERT/UPDATE on either table.
--   Mirrors the opt_ins SECDEF pattern from 20260604140000.
--
-- IDEMPOTENCY
--   CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, OR REPLACE fns.

-- ============================================================
-- 1. safety_alerts table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.safety_alerts (
  id            uuid          NOT NULL DEFAULT gen_random_uuid(),
  alert_type    text          NOT NULL
                              CHECK (alert_type IN ('weather', 'road_closure', 'speeding', 'general')),
  severity      int           NOT NULL
                              CHECK (severity BETWEEN 1 AND 4),
  description   text,
  location      geography(POINT, 4326) NOT NULL,
  status        text          NOT NULL DEFAULT 'live'
                              CHECK (status IN ('live', 'expired', 'cleared', 'removed')),
  created_by    uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirm_count int           NOT NULL DEFAULT 0,
  clear_count   int           NOT NULL DEFAULT 0,
  expires_at    timestamptz   NOT NULL,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT safety_alerts_pkey PRIMARY KEY (id)
);

-- Spatial index for bbox queries (ST_MakeEnvelope)
CREATE INDEX IF NOT EXISTS idx_safety_alerts_location
  ON public.safety_alerts USING GIST (location);

-- Status index (most queries filter status='live')
CREATE INDEX IF NOT EXISTS idx_safety_alerts_status
  ON public.safety_alerts (status);

-- Expiry index (secondary filter on expires_at > now())
CREATE INDEX IF NOT EXISTS idx_safety_alerts_expires_at
  ON public.safety_alerts (expires_at);

-- ============================================================
-- 2. safety_alert_votes table (one vote-state per user per alert)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.safety_alert_votes (
  id         uuid         NOT NULL DEFAULT gen_random_uuid(),
  alert_id   uuid         NOT NULL REFERENCES public.safety_alerts(id) ON DELETE CASCADE,
  voter_id   uuid         NOT NULL REFERENCES public.profiles(id)       ON DELETE CASCADE,
  vote       text         NOT NULL CHECK (vote IN ('confirm', 'clear')),
  created_at timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT safety_alert_votes_pkey PRIMARY KEY (id),
  CONSTRAINT safety_alert_votes_uniq UNIQUE (alert_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_safety_alert_votes_alert_id
  ON public.safety_alert_votes (alert_id);

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE public.safety_alerts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_alert_votes ENABLE ROW LEVEL SECURITY;

-- safety_alerts: authenticated users can SELECT live rows
--   (RPC is the canonical read path; direct SELECT of live rows is allowed)
DROP POLICY IF EXISTS "safety_alerts_select" ON public.safety_alerts;
CREATE POLICY "safety_alerts_select" ON public.safety_alerts
  FOR SELECT
  TO authenticated
  USING (status = 'live');

-- No direct INSERT/UPDATE/DELETE — all writes via SECDEF RPCs

-- safety_alert_votes: users can SELECT their own votes (no direct INSERT)
DROP POLICY IF EXISTS "safety_alert_votes_select_own" ON public.safety_alert_votes;
CREATE POLICY "safety_alert_votes_select_own" ON public.safety_alert_votes
  FOR SELECT
  TO authenticated
  USING (voter_id = auth.uid());

-- ============================================================
-- 4. SECDEF RPC: place_safety_alert
--    Inserts a new safety alert with expires_at derived from severity.
-- ============================================================

CREATE OR REPLACE FUNCTION public.place_safety_alert(
  p_type        text,
  p_severity    int,
  p_description text,
  p_lng         float8,
  p_lat         float8
)
RETURNS public.safety_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ttl     interval;
  v_row     public.safety_alerts;
BEGIN
  -- Validate inputs
  IF p_type NOT IN ('weather', 'road_closure', 'speeding', 'general') THEN
    RAISE EXCEPTION 'invalid alert_type: %', p_type;
  END IF;
  IF p_severity < 1 OR p_severity > 4 THEN
    RAISE EXCEPTION 'severity must be between 1 and 4';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Severity → TTL:  1=2h  2=6h  3=24h  4=72h
  v_ttl := CASE p_severity
    WHEN 1 THEN interval '2 hours'
    WHEN 2 THEN interval '6 hours'
    WHEN 3 THEN interval '24 hours'
    WHEN 4 THEN interval '72 hours'
  END;

  INSERT INTO public.safety_alerts
    (alert_type, severity, description, location, status, created_by, expires_at)
  VALUES
    (p_type, p_severity, p_description,
     ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
     'live', auth.uid(), now() + v_ttl)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_safety_alert(text, int, text, float8, float8) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.place_safety_alert(text, int, text, float8, float8) FROM anon;
GRANT  EXECUTE ON FUNCTION public.place_safety_alert(text, int, text, float8, float8) TO authenticated;

-- ============================================================
-- 5. SECDEF RPC: safety_alerts_in_view
--    Returns live non-expired alerts within a bbox.
--    Returns lng/lat as float8 so the client never handles geography.
-- ============================================================

CREATE OR REPLACE FUNCTION public.safety_alerts_in_view(
  p_min_lng float8,
  p_min_lat float8,
  p_max_lng float8,
  p_max_lat float8
)
RETURNS TABLE(
  id            uuid,
  alert_type    text,
  severity      int,
  description   text,
  lng           float8,
  lat           float8,
  status        text,
  confirm_count int,
  clear_count   int,
  created_by    uuid,
  created_at    timestamptz,
  expires_at    timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.alert_type,
    sa.severity,
    sa.description,
    ST_X(sa.location::geometry)::float8 AS lng,
    ST_Y(sa.location::geometry)::float8 AS lat,
    sa.status,
    sa.confirm_count,
    sa.clear_count,
    sa.created_by,
    sa.created_at,
    sa.expires_at
  FROM public.safety_alerts sa
  WHERE sa.status = 'live'
    AND sa.expires_at > now()
    AND ST_Intersects(
      sa.location,
      ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.safety_alerts_in_view(float8, float8, float8, float8) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.safety_alerts_in_view(float8, float8, float8, float8) FROM anon;
GRANT  EXECUTE ON FUNCTION public.safety_alerts_in_view(float8, float8, float8, float8) TO authenticated;

-- ============================================================
-- 6. SECDEF RPC: vote_safety_alert
--    Upserts a vote (confirm/clear), recomputes counts,
--    and auto-clears if clear_count >= 3 and clears > confirms.
-- ============================================================

CREATE OR REPLACE FUNCTION public.vote_safety_alert(
  p_alert_id uuid,
  p_vote     text
)
RETURNS public.safety_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     public.safety_alerts;
BEGIN
  IF p_vote NOT IN ('confirm', 'clear') THEN
    RAISE EXCEPTION 'vote must be confirm or clear';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Verify the alert exists and is live
  SELECT * INTO v_row FROM public.safety_alerts WHERE id = p_alert_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'alert not found';
  END IF;
  IF v_row.status <> 'live' THEN
    RAISE EXCEPTION 'alert is no longer live';
  END IF;

  -- Upsert vote (one per user per alert)
  INSERT INTO public.safety_alert_votes (alert_id, voter_id, vote)
  VALUES (p_alert_id, auth.uid(), p_vote)
  ON CONFLICT (alert_id, voter_id) DO UPDATE
    SET vote = EXCLUDED.vote;

  -- Recompute counts atomically
  UPDATE public.safety_alerts
  SET
    confirm_count = (
      SELECT count(*) FROM public.safety_alert_votes
      WHERE alert_id = p_alert_id AND vote = 'confirm'
    ),
    clear_count = (
      SELECT count(*) FROM public.safety_alert_votes
      WHERE alert_id = p_alert_id AND vote = 'clear'
    ),
    -- Auto-clear: >= 3 clear votes and clears outweigh confirms
    status = CASE
      WHEN (
        (SELECT count(*) FROM public.safety_alert_votes WHERE alert_id = p_alert_id AND vote = 'clear') >= 3
        AND
        (SELECT count(*) FROM public.safety_alert_votes WHERE alert_id = p_alert_id AND vote = 'clear')
          > (SELECT count(*) FROM public.safety_alert_votes WHERE alert_id = p_alert_id AND vote = 'confirm')
      ) THEN 'cleared'
      ELSE status
    END
  WHERE id = p_alert_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vote_safety_alert(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vote_safety_alert(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.vote_safety_alert(uuid, text) TO authenticated;

-- ============================================================
-- 7. SECDEF RPC: admin_remove_safety_alert
--    Admin-only: set status='removed' for post-hoc moderation.
--    Gated to is_staff=true (mirrors moderation-queue auth pattern).
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_remove_safety_alert(
  p_alert_id uuid
)
RETURNS public.safety_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
  v_row      public.safety_alerts;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Verify caller is staff
  SELECT is_staff INTO v_is_staff
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_staff, false) THEN
    RAISE EXCEPTION 'forbidden: staff access required';
  END IF;

  UPDATE public.safety_alerts
  SET status = 'removed'
  WHERE id = p_alert_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'alert not found';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_remove_safety_alert(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_remove_safety_alert(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_remove_safety_alert(uuid) TO authenticated;

-- ============================================================
-- 8. Realtime publication (idempotent DO block)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'safety_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.safety_alerts;
  END IF;
END;
$$;
