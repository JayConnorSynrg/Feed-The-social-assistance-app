-- ============================================================================
-- Migration: Phase D2b geo-outreach RPCs
-- ----------------------------------------------------------------------------
-- PURPOSE
--   Two SECURITY DEFINER functions that let a post author (a) preview how many
--   seekers are within a radius of a linked resource, and (b) fan-out a
--   'general' notification to those seekers when they publish the post.
--
-- PRIVACY INVARIANT
--   Neither function ever returns seeker coordinates, profile ids, or any PII
--   to the caller. seekers_within_radius returns a plain INTEGER count only.
--   notify_seekers_near_resource inserts notifications into seekers' private
--   rows (which only those seekers can SELECT) and returns only the integer
--   count of notifications inserted.  All geographic math stays inside the DB.
--
-- SEEKER FILTER
--   profiles.user_role column (added in 20260214300000_add_profile_context.sql)
--   carries values ('seeking', 'providing', 'facilitator', 'both').  Both
--   functions filter to user_role IN ('seeking', 'both', 'facilitator') so that
--   providers-only are not notified about resources and the seeker-count
--   preview reflects the same audience as the fan-out.
--
-- SECURITY
--   Both functions pin SET search_path = public (guards against search-path
--   injection per Supabase linter 0011).  EXECUTE is revoked from PUBLIC and
--   anon; only authenticated (post owners calling the UI) and service_role
--   (e2e seed helpers) may invoke them.  PostGIS is in the public schema on
--   this project so no extensions alias is required.
--
-- IDEMPOTENCY
--   CREATE OR REPLACE FUNCTION: safe to re-run; no DROP required.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- (a) seekers_within_radius
--     Returns the integer count of seeker profiles whose location is within
--     p_radius_miles of the resource identified by p_resource_id.  The caller
--     (composer UI) never receives coordinates or identities.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seekers_within_radius(
    p_resource_id  uuid,
    p_radius_miles double precision
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_loc geography;
BEGIN
    -- Resolve the resource location; NULL means no geodata → return 0.
    SELECT location INTO v_loc
    FROM public.resources
    WHERE id = p_resource_id;

    IF v_loc IS NULL THEN
        RETURN 0;
    END IF;

    RETURN (
        SELECT count(*)::integer
        FROM public.profiles
        WHERE location IS NOT NULL
          -- Exclude the calling user if authenticated; include all if called as service_role
          -- (auth.uid() IS NULL for service_role; id <> NULL = NULL which is falsy in SQL)
          AND (auth.uid() IS NULL OR id <> auth.uid())
          -- Filter to seekers: user_role = 'seeking' | 'both' | 'facilitator'
          -- 'providing' profiles are not the intended audience for resource offers.
          AND user_role IN ('seeking', 'both', 'facilitator')
          AND ST_DWithin(location, v_loc, p_radius_miles * 1609.34)
    );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- (b) notify_seekers_near_resource
--     Fan-out: inserts a 'general' notification into each in-radius seeker's
--     row.  Only the post's author may call this (owner-check enforced in PL).
--     Dedup guard prevents double-notification if called more than once.
--     Returns the count of NEW notifications inserted.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_seekers_near_resource(
    p_post_id      uuid,
    p_radius_miles double precision
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_author uuid;
    v_loc    geography;
    v_rname  text;
    v_count  integer;
BEGIN
    -- Resolve post → resource location + resource name + ownership in one query.
    -- posts.user_id is the author column (confirmed from 20260220200000 schema).
    SELECT p.user_id,
           r.location,
           r.name
    INTO   v_author, v_loc, v_rname
    FROM   public.posts     p
    JOIN   public.resources r ON r.id = p.resource_id
    WHERE  p.id = p_post_id;

    -- Must be the post's author; also catches "post not found" (v_author IS NULL).
    IF v_author IS NULL OR v_author <> auth.uid() THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    -- No geodata on the resource → nothing to fan out.
    IF v_loc IS NULL THEN
        RETURN 0;
    END IF;

    -- Fan-out: insert for each in-radius seeker who doesn't already have this
    -- notification (dedup keyed on user_id + link + type).
    INSERT INTO public.notifications (user_id, type, title, message, link, is_read, created_at)
    SELECT
        s.id,
        'general'::notification_type,
        'A resource near you',
        'Someone shared "' || coalesce(v_rname, 'a resource') || '" that may help you. Tap to view.',
        '/?post=' || p_post_id::text,
        false,
        now()
    FROM public.profiles s
    WHERE s.location IS NOT NULL
      -- Exclude calling user if authenticated; include all if service_role (auth.uid()=NULL)
      AND (auth.uid() IS NULL OR s.id <> auth.uid())
      -- Same seeker filter as seekers_within_radius for consistent count vs fan-out.
      AND s.user_role IN ('seeking', 'both', 'facilitator')
      AND ST_DWithin(s.location, v_loc, p_radius_miles * 1609.34)
      -- Dedup guard: skip if seeker already has a notification for this exact post.
      AND NOT EXISTS (
          SELECT 1
          FROM public.notifications n
          WHERE n.user_id = s.id
            AND n.link    = '/?post=' || p_post_id::text
            AND n.type    = 'general'
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Least-privilege grants  (mirror nearby_resources pattern)
-- ─────────────────────────────────────────────────────────────────────────────

-- seekers_within_radius
REVOKE EXECUTE ON FUNCTION public.seekers_within_radius(uuid, double precision)
    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.seekers_within_radius(uuid, double precision)
    TO authenticated, service_role;

-- notify_seekers_near_resource
REVOKE EXECUTE ON FUNCTION public.notify_seekers_near_resource(uuid, double precision)
    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.notify_seekers_near_resource(uuid, double precision)
    TO authenticated, service_role;
