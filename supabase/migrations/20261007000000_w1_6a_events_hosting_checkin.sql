-- 20261007000000_w1_6a_events_hosting_checkin.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Wave: feed-fullfeed-w1-6a-events-hosting
--
-- Event hosting + two-state check-in + attendance, on top of the W2/W3/W4 event
-- foundation and the P2.0/P2.1a/P2.1b engagement ledger.
--
-- USER RULINGS (verbatim intent):
--   R1  Only platform admins create organizations + assign org admins; org admins (and
--       platform admins) create/schedule events. No member-hosted events.
--   R2  Check-in has two states: EARLY ("I'm coming", any time before the window opens,
--       after the occurrence exists and is not cancelled/completed) and CONFIRMED
--       (presence). CONFIRMED is set by the member tapping again in the window
--       [starts_at - 30 min, ends_at], by a first check-in during the window (straight to
--       CONFIRMED), or by the organizer confirming the attendee from the kiosk. After
--       ends_at no new self check-ins / self-confirms; the organizer may still confirm
--       until ends_at + 24h so a busy kiosk can catch up. Cancelled rejects everything.
--   R3  An EARLY check-in never confirmed by ends_at is a NO-SHOW (DERIVED, no stored cron
--       mutation): on an ended occurrence, status='early' rows are no-shows.
--   R4  Person rate = confirmed / (early-or-confirmed check-ins on ENDED occurrences).
--       Per event: early count, confirmed count, no-show count, show rate.
--   R5  Org admins (+ platform admins) see per-event stats and each attendee's rate
--       computed ONLY over that org's events. A member sees their OWN overall rate.
--       No public / cross-org score.
--   R6  Only CONFIRMED attendance earns the private P2.1a event_checkin credit — exactly
--       once per (user, occurrence), at confirmation, never at early check-in. Reconcile agrees.
--   R7  Anonymous check-ins (user_id NULL, household only) stay available for SIGNED-IN
--       members — untracked, no credit, not part of attendance %.
--   R8  Guests (auth.users.is_anonymous) cannot check in.
--
-- INVARIANTS (this migration is the site that satisfies each):
--   I1  Every check-in write goes through a SECDEF RPC (check_in / organizer_confirm).
--       Clients hold NO INSERT/UPDATE/DELETE on event_checkins (grants revoked; write
--       policies dropped). SELECT stays (own + admin + org-admin). The P2.0 RESTRICTIVE
--       guest-INSERT block is kept (defence in depth; smoke 25 counts it).
--   I2  (user, occurrence) has at most one row (existing partial UNIQUE); state only moves
--       early -> confirmed (RPCs never set 'early' over 'confirmed'); confirm is idempotent
--       (the ledger's UNIQUE(actor,kind,target) makes the credit exactly-once).
--   I3  organizer_confirm records the ATTENDEE (p_user, or NULL for an anonymous household)
--       as user_id; confirmed_by = the organizer (auth.uid()); the P2.0 force trigger sets
--       checked_in_by = the caller. The organizer is never stored as the attendee.
--   I4  event_attendance is org-scoped (authorised to that org's admins only) and every
--       attendee rate it returns is computed ONLY over that event's org. my_attendance_rate
--       returns ONLY the caller's own overall rate. Neither leaks another person's cross-org
--       history: arguments cannot address another org/user's numbers.
--   I5  admin_create_event / admin_update_event store address fields + a geocoded location
--       ONLY from a strong (precise-tier) match; a weak/failed match leaves location NULL
--       and tags geocode_accuracy='approximate' (feed shows "unknown" distance).
--   I6  P2.0/P2.1a/P2.1b invariants still hold: the P2.0 force trigger + guest block are
--       untouched; enforce_opt_in_transition is untouched (its md5 is unchanged); the
--       P2.1a 16 source triggers still exist (trg_engagement_event_checkin still fires on
--       INSERT, now also on UPDATE); reconcile stays service_role-only; account deletion of
--       an attendee or organizer still succeeds (all new FKs are ON DELETE SET NULL/CASCADE).
--   I7  Every UI element activates a real capability (no placeholders).
--
-- Backfill-safe: prod has 0 event_checkins / 0 assistance_events / 0 organizations at apply
-- time, so the new NOT NULL status column (DEFAULT 'confirmed') and the new nullable columns
-- add cleanly with no data migration.

BEGIN;

-- ============================================================================
-- 1. SCHEMA — two-state check-in + event geocode tagging
-- ============================================================================

-- event_checkins: EARLY vs CONFIRMED state + confirmation attestation.
ALTER TABLE public.event_checkins
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('early','confirmed')),
  ADD COLUMN IF NOT EXISTS confirmed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_checkins_status
  ON public.event_checkins (occurrence_id, status);

-- assistance_events: geocode accuracy tagging (mirrors resources.geocode_accuracy).
ALTER TABLE public.assistance_events
  ADD COLUMN IF NOT EXISTS geocode_accuracy   text,
  ADD COLUMN IF NOT EXISTS geocode_confidence text;

-- ============================================================================
-- 2. I1 — lock down direct writes to event_checkins (RPC-only)
-- ============================================================================
-- Drop the permissive client write policies (writes go only through the SECDEF
-- RPCs below). Keep the three SELECT policies (own/admin/org-admin) and the
-- P2.0 RESTRICTIVE guest-INSERT block (event_checkins_block_anon_insert).
DROP POLICY IF EXISTS checkins_insert_auth  ON public.event_checkins;
DROP POLICY IF EXISTS checkins_update_own   ON public.event_checkins;
DROP POLICY IF EXISTS checkins_update_admin ON public.event_checkins;

-- Revoke every write privilege (table AND column level via ALL) from clients;
-- re-grant SELECT (RLS-scoped) + REFERENCES/TRIGGER defaults are dropped too — only
-- SELECT is needed by the app (own rows, org-admin rows).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.event_checkins FROM anon, authenticated;

-- ============================================================================
-- 3. R6 — move the P2.1a private credit to CONFIRMATION time
-- ============================================================================
-- Fires AFTER INSERT OR UPDATE. Credits ONLY when the row is CONFIRMED, identified,
-- and this statement is the confirming transition (INSERT straight to confirmed, or
-- early -> confirmed UPDATE). record_engagement_event is idempotent on
-- (actor,kind,target) so the credit is exactly-once per (user, occurrence).
-- Keeping the same trigger NAME + INSERT firing preserves smoke 26's 16-trigger shape.
CREATE OR REPLACE FUNCTION public.engagement_on_event_checkin()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  BEGIN
    IF NEW.user_id IS NOT NULL
       AND NEW.status = 'confirmed'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed') THEN
      PERFORM public.record_engagement_event(
        NEW.user_id, 'event_checkin', 'event', NEW.occurrence_id,
        'event_checkins', NEW.user_id::text || ':' || NEW.occurrence_id::text, NULL, false);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_engagement_failure('event_checkin', SQLERRM);
  END;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_engagement_event_checkin ON public.event_checkins;
CREATE TRIGGER trg_engagement_event_checkin
  AFTER INSERT OR UPDATE ON public.event_checkins
  FOR EACH ROW EXECUTE FUNCTION public.engagement_on_event_checkin();

-- The trigger function is internal-only (never client-executable).
REVOKE EXECUTE ON FUNCTION public.engagement_on_event_checkin() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 4. Check-in writers (SECDEF, RPC-only) — R2/R3/R7/R8, I2/I3
-- ============================================================================
-- Early window opens 30 minutes before starts_at.
--   now <  starts_at - 30m           -> EARLY   ("I'm coming")
--   starts_at - 30m <= now <= ends_at -> CONFIRMED (presence)
--   now >  ends_at                    -> ended (self actions rejected)

-- 4a. check_in — the signed-in member's own action.
CREATE OR REPLACE FUNCTION public.check_in(
  p_occurrence uuid,
  p_household_size int DEFAULT 1,
  p_anonymous boolean DEFAULT false)
  RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_starts timestamptz;
  v_ends   timestamptz;
  v_status text;
  v_now    timestamptz := now();
  v_window_open timestamptz;
  v_existing_status text;
BEGIN
  -- R8: only a real (non-guest) signed-in user may check in.
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to check in.' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid AND is_anonymous IS TRUE) THEN
    RAISE EXCEPTION 'Create a free account to check in.' USING ERRCODE='42501';
  END IF;
  IF p_household_size IS NULL OR p_household_size < 1 OR p_household_size > 20 THEN
    RAISE EXCEPTION 'Household size must be between 1 and 20.' USING ERRCODE='22003';
  END IF;

  SELECT eo.starts_at, eo.ends_at, eo.status
    INTO v_starts, v_ends, v_status
    FROM public.event_occurrences eo
   WHERE eo.id = p_occurrence;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found.' USING ERRCODE='P0002'; END IF;

  IF v_status = 'cancelled' THEN RAISE EXCEPTION 'This event was cancelled.' USING ERRCODE='P0001'; END IF;
  IF v_status = 'completed' OR v_now > v_ends THEN
    RAISE EXCEPTION 'This event has ended.' USING ERRCODE='P0001';
  END IF;

  v_window_open := v_starts - interval '30 minutes';

  -- R7: anonymous check-in is untracked (user_id NULL); only meaningful as presence,
  -- so it is allowed only once the window has opened. No credit (user_id NULL).
  IF p_anonymous THEN
    IF v_now < v_window_open THEN
      RAISE EXCEPTION 'Anonymous check-in opens when the event starts.' USING ERRCODE='P0001';
    END IF;
    INSERT INTO public.event_checkins
      (occurrence_id, user_id, household_size, status, confirmed_at, confirmed_by)
    VALUES (p_occurrence, NULL, p_household_size, 'confirmed', v_now, v_uid);
    RETURN 'confirmed_anonymous';
  END IF;

  -- Identified path. At most one row per (occurrence,user) — read the current state.
  SELECT status INTO v_existing_status
    FROM public.event_checkins
   WHERE occurrence_id = p_occurrence AND user_id = v_uid;

  IF v_existing_status IS NULL THEN
    -- No row yet: EARLY before the window, CONFIRMED once it is open.
    IF v_now < v_window_open THEN
      INSERT INTO public.event_checkins
        (occurrence_id, user_id, household_size, status)
      VALUES (p_occurrence, v_uid, p_household_size, 'early');
      RETURN 'early';
    ELSE
      INSERT INTO public.event_checkins
        (occurrence_id, user_id, household_size, status, confirmed_at, confirmed_by)
      VALUES (p_occurrence, v_uid, p_household_size, 'confirmed', v_now, v_uid);
      RETURN 'confirmed';
    END IF;
  ELSIF v_existing_status = 'confirmed' THEN
    -- Idempotent: never move back; keep the latest household size.
    UPDATE public.event_checkins
       SET household_size = p_household_size
     WHERE occurrence_id = p_occurrence AND user_id = v_uid;
    RETURN 'already_confirmed';
  ELSE
    -- Existing EARLY. Confirm it iff the window is open (the "I'm here" tap); otherwise
    -- it stays EARLY (idempotent) with the latest household size.
    IF v_now >= v_window_open THEN
      UPDATE public.event_checkins
         SET status = 'confirmed', confirmed_at = v_now, confirmed_by = v_uid,
             household_size = p_household_size
       WHERE occurrence_id = p_occurrence AND user_id = v_uid;
      RETURN 'confirmed';
    ELSE
      UPDATE public.event_checkins
         SET household_size = p_household_size
       WHERE occurrence_id = p_occurrence AND user_id = v_uid;
      RETURN 'already_early';
    END IF;
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.check_in(uuid,int,boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_in(uuid,int,boolean) TO authenticated;

-- 4b. organizer_confirm — the kiosk action, run by an org admin of the event's org
-- (or a platform admin). Confirms an ATTENDEE (p_user) or adds an anonymous household
-- (p_user NULL). checked_in_by is forced to the caller by the P2.0 trigger; confirmed_by
-- is the caller here. Allowed until ends_at + 24h so a busy kiosk can catch up.
CREATE OR REPLACE FUNCTION public.organizer_confirm(
  p_occurrence uuid,
  p_user uuid DEFAULT NULL,
  p_household_size int DEFAULT 1)
  RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid   uuid := auth.uid();
  v_org   uuid;
  v_ends  timestamptz;
  v_status text;
  v_now   timestamptz := now();
  v_existing_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to confirm attendance.' USING ERRCODE='42501'; END IF;
  IF p_household_size IS NULL OR p_household_size < 1 OR p_household_size > 20 THEN
    RAISE EXCEPTION 'Household size must be between 1 and 20.' USING ERRCODE='22003';
  END IF;

  SELECT ae.org_id, eo.ends_at, eo.status
    INTO v_org, v_ends, v_status
    FROM public.event_occurrences eo
    JOIN public.assistance_events ae ON ae.id = eo.event_id
   WHERE eo.id = p_occurrence;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found.' USING ERRCODE='P0002'; END IF;

  -- I3: only an org admin of this event's org (or a platform admin) may run the kiosk.
  IF NOT (public.is_current_user_admin() OR public.is_org_admin(v_org)) THEN
    RAISE EXCEPTION 'Only an organizer of this event may confirm attendance.' USING ERRCODE='42501';
  END IF;

  IF v_status = 'cancelled' THEN RAISE EXCEPTION 'This event was cancelled.' USING ERRCODE='P0001'; END IF;
  IF v_now > v_ends + interval '24 hours' THEN
    RAISE EXCEPTION 'The confirmation window for this event has closed.' USING ERRCODE='P0001';
  END IF;

  -- Anonymous household added by the organizer (never the organizer as attendee).
  IF p_user IS NULL THEN
    INSERT INTO public.event_checkins
      (occurrence_id, user_id, household_size, status, confirmed_at, confirmed_by)
    VALUES (p_occurrence, NULL, p_household_size, 'confirmed', v_now, v_uid);
    RETURN 'confirmed_anonymous';
  END IF;

  -- Identified attendee: confirm the existing (early) row or create a confirmed one.
  SELECT status INTO v_existing_status
    FROM public.event_checkins
   WHERE occurrence_id = p_occurrence AND user_id = p_user;

  IF v_existing_status IS NULL THEN
    INSERT INTO public.event_checkins
      (occurrence_id, user_id, household_size, status, confirmed_at, confirmed_by)
    VALUES (p_occurrence, p_user, p_household_size, 'confirmed', v_now, v_uid);
    RETURN 'confirmed';
  ELSIF v_existing_status = 'confirmed' THEN
    RETURN 'already_confirmed';  -- idempotent, no re-credit
  ELSE
    UPDATE public.event_checkins
       SET status = 'confirmed', confirmed_at = v_now, confirmed_by = v_uid,
           household_size = p_household_size
     WHERE occurrence_id = p_occurrence AND user_id = p_user;
    RETURN 'confirmed';
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.organizer_confirm(uuid,uuid,int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.organizer_confirm(uuid,uuid,int) TO authenticated;

-- ============================================================================
-- 5. Attendance reads (SECDEF) — R4/R5, I4
-- ============================================================================
-- 5a. Internal helper: a user's attendance rate computed ONLY over one org's ENDED
-- occurrences. SECDEF (reads event_checkins across users) but NOT client-executable —
-- it is called only from event_attendance, which has already authorised the caller as
-- an admin of exactly p_org. That gate is what makes exposing another user's number
-- here safe; the helper itself grants EXECUTE to nobody.
CREATE OR REPLACE FUNCTION public.w1_6a_user_org_rate(p_user uuid, p_org uuid)
  RETURNS numeric
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
  SELECT CASE WHEN count(*) FILTER (WHERE ec.status IN ('early','confirmed')) > 0
              THEN round(
                     count(*) FILTER (WHERE ec.status = 'confirmed')::numeric
                     / count(*) FILTER (WHERE ec.status IN ('early','confirmed')), 4)
              ELSE NULL END
    FROM public.event_checkins ec
    JOIN public.event_occurrences eo ON eo.id = ec.occurrence_id
    JOIN public.assistance_events ae ON ae.id = eo.event_id
   WHERE ec.user_id = p_user
     AND ae.org_id  = p_org
     AND eo.status <> 'cancelled'
     AND eo.ends_at < now();
$fn$;
REVOKE EXECUTE ON FUNCTION public.w1_6a_user_org_rate(uuid,uuid) FROM PUBLIC, anon, authenticated;

-- 5b. event_attendance — per-occurrence stats + attendee rows (each rate org-scoped).
-- Authorised to admins of the occurrence's org (or platform admins); anyone else gets
-- NULL. full_name is read through this SECDEF path (it is column-private to clients) so
-- an organizer can see who attended their event.
CREATE OR REPLACE FUNCTION public.event_attendance(p_occurrence uuid)
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_org   uuid;
  v_ends  timestamptz;
  v_status text;
  v_ended boolean;
  v_early int; v_confirmed int; v_anon int; v_people int; v_no_show int;
  v_show_rate numeric;
  v_attendees jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  SELECT ae.org_id, eo.ends_at, eo.status
    INTO v_org, v_ends, v_status
    FROM public.event_occurrences eo
    JOIN public.assistance_events ae ON ae.id = eo.event_id
   WHERE eo.id = p_occurrence;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- I4: org-scoped authorisation.
  IF NOT (public.is_current_user_admin() OR public.is_org_admin(v_org)) THEN
    RETURN NULL;
  END IF;

  v_ended := (v_status <> 'cancelled' AND v_ends < now());

  SELECT
    count(*) FILTER (WHERE status = 'early'     AND user_id IS NOT NULL),
    count(*) FILTER (WHERE status = 'confirmed' AND user_id IS NOT NULL),
    count(*) FILTER (WHERE user_id IS NULL),
    COALESCE(SUM(household_size) FILTER (WHERE status = 'confirmed'), 0)
    INTO v_early, v_confirmed, v_anon, v_people
    FROM public.event_checkins
   WHERE occurrence_id = p_occurrence;

  -- R3: no-shows are early rows on an ENDED occurrence.
  v_no_show := CASE WHEN v_ended THEN v_early ELSE 0 END;
  -- R4 per-event show rate (only meaningful once ended): confirmed / (confirmed + no-show).
  v_show_rate := CASE WHEN v_ended AND (v_confirmed + v_no_show) > 0
                      THEN round(v_confirmed::numeric / (v_confirmed + v_no_show), 4)
                      ELSE NULL END;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'user_id',        ec.user_id,
             'name',           COALESCE(pr.full_name, 'Member'),
             'status',         ec.status,
             'household_size', ec.household_size,
             'checked_in_at',  ec.checked_in_at,
             'confirmed_at',   ec.confirmed_at,
             'attendance_rate', public.w1_6a_user_org_rate(ec.user_id, v_org))
           ORDER BY ec.status DESC, ec.checked_in_at), '[]'::jsonb)
    INTO v_attendees
    FROM public.event_checkins ec
    LEFT JOIN public.profiles pr ON pr.id = ec.user_id
   WHERE ec.occurrence_id = p_occurrence
     AND ec.user_id IS NOT NULL;

  RETURN jsonb_build_object(
    'occurrence_id',      p_occurrence,
    'ended',              v_ended,
    'early',              v_early,
    'confirmed',          v_confirmed,
    'no_show',            v_no_show,
    'anonymous_confirmed', v_anon,
    'people_confirmed',   v_people,
    'show_rate',          v_show_rate,
    'attendees',          v_attendees);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.event_attendance(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.event_attendance(uuid) TO authenticated;

-- 5c. my_attendance_rate — the CALLER's own overall rate (all orgs), R5. Ended
-- occurrences only. Never takes a user argument (cannot address another person).
CREATE OR REPLACE FUNCTION public.my_attendance_rate()
  RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE v_uid uuid := auth.uid(); v_conf int; v_total int;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT
    count(*) FILTER (WHERE ec.status = 'confirmed'),
    count(*) FILTER (WHERE ec.status IN ('early','confirmed'))
    INTO v_conf, v_total
    FROM public.event_checkins ec
    JOIN public.event_occurrences eo ON eo.id = ec.occurrence_id
   WHERE ec.user_id = v_uid
     AND eo.status <> 'cancelled'
     AND eo.ends_at < now();
  RETURN jsonb_build_object(
    'confirmed', v_conf,
    'total',     v_total,
    'has_data',  v_total > 0,
    'rate',      CASE WHEN v_total > 0 THEN round(v_conf::numeric / v_total, 4) ELSE NULL END);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.my_attendance_rate() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_attendance_rate() TO authenticated;

-- ============================================================================
-- 6. Event hosting writers (SECDEF) — R1, I5 (geocode-on-save, strong-match only)
-- ============================================================================
-- The client forward-geocodes the address (Mapbox v6, resolveGeoPointV6) and passes the
-- classified result. The server writes location ONLY for a precise tier (rooftop/parcel/
-- point) with coords; a weak/failed match leaves location NULL and tags 'approximate'.
CREATE OR REPLACE FUNCTION public.admin_create_event(
  p_org_id uuid,
  p_title text,
  p_event_type text DEFAULT 'distribution',
  p_description text DEFAULT NULL,
  p_location_name text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip_code text DEFAULT NULL,
  p_rrule text DEFAULT NULL,
  p_default_capacity int DEFAULT NULL,
  p_requires_registration boolean DEFAULT false,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_geocode_accuracy text DEFAULT NULL,
  p_geocode_confidence text DEFAULT NULL)
  RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE v_uid uuid := auth.uid(); v_precise boolean; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required.' USING ERRCODE='42501'; END IF;
  -- R1: only a platform admin or an admin of this org may create events for it.
  IF NOT (public.is_current_user_admin() OR public.is_org_admin(p_org_id)) THEN
    RAISE EXCEPTION 'Only an organizer of this organization may create events.' USING ERRCODE='42501';
  END IF;
  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Event title is required.' USING ERRCODE='22004';
  END IF;

  v_precise := p_geocode_accuracy IN ('rooftop','parcel','point')
               AND p_lat IS NOT NULL AND p_lng IS NOT NULL;

  INSERT INTO public.assistance_events
    (org_id, title, event_type, description, location_name, address, city, state, zip_code,
     rrule, default_capacity, requires_registration, created_by,
     location, geocode_accuracy, geocode_confidence)
  VALUES
    (p_org_id, btrim(p_title), p_event_type, p_description, p_location_name, p_address,
     p_city, p_state, p_zip_code, p_rrule, p_default_capacity,
     COALESCE(p_requires_registration, false), v_uid,
     CASE WHEN v_precise THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography ELSE NULL END,
     CASE WHEN v_precise THEN p_geocode_accuracy
          WHEN p_address IS NOT NULL THEN 'approximate' ELSE NULL END,
     p_geocode_confidence)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.admin_create_event(uuid,text,text,text,text,text,text,text,text,text,int,boolean,double precision,double precision,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_create_event(uuid,text,text,text,text,text,text,text,text,text,int,boolean,double precision,double precision,text,text) TO authenticated;

-- admin_update_event — editing the address re-geocodes (client passes the new match);
-- a weak/failed re-geocode clears location and tags 'approximate'.
CREATE OR REPLACE FUNCTION public.admin_update_event(
  p_event_id uuid,
  p_title text DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_location_name text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip_code text DEFAULT NULL,
  p_rrule text DEFAULT NULL,
  p_default_capacity int DEFAULT NULL,
  p_requires_registration boolean DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_geocode_accuracy text DEFAULT NULL,
  p_geocode_confidence text DEFAULT NULL,
  p_regeocode boolean DEFAULT false)
  RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE v_uid uuid := auth.uid(); v_org uuid; v_precise boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required.' USING ERRCODE='42501'; END IF;
  SELECT org_id INTO v_org FROM public.assistance_events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found.' USING ERRCODE='P0002'; END IF;
  IF NOT (public.is_current_user_admin() OR public.is_org_admin(v_org)) THEN
    RAISE EXCEPTION 'Only an organizer of this organization may edit this event.' USING ERRCODE='42501';
  END IF;

  v_precise := p_geocode_accuracy IN ('rooftop','parcel','point')
               AND p_lat IS NOT NULL AND p_lng IS NOT NULL;

  UPDATE public.assistance_events SET
    title       = COALESCE(NULLIF(btrim(p_title), ''), title),
    event_type  = COALESCE(p_event_type, event_type),
    description = COALESCE(p_description, description),
    location_name = COALESCE(p_location_name, location_name),
    address     = COALESCE(p_address, address),
    city        = COALESCE(p_city, city),
    state       = COALESCE(p_state, state),
    zip_code    = COALESCE(p_zip_code, zip_code),
    rrule       = COALESCE(p_rrule, rrule),
    default_capacity = COALESCE(p_default_capacity, default_capacity),
    requires_registration = COALESCE(p_requires_registration, requires_registration),
    -- Only touch location/accuracy when a re-geocode was requested (address changed).
    location = CASE WHEN p_regeocode
                    THEN CASE WHEN v_precise
                              THEN ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
                              ELSE NULL END
                    ELSE location END,
    geocode_accuracy = CASE WHEN p_regeocode
                            THEN CASE WHEN v_precise THEN p_geocode_accuracy ELSE 'approximate' END
                            ELSE geocode_accuracy END,
    geocode_confidence = CASE WHEN p_regeocode THEN p_geocode_confidence ELSE geocode_confidence END
  WHERE id = p_event_id;
  RETURN p_event_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.admin_update_event(uuid,text,text,text,text,text,text,text,text,text,int,boolean,double precision,double precision,text,text,boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_update_event(uuid,text,text,text,text,text,text,text,text,text,int,boolean,double precision,double precision,text,text,boolean) TO authenticated;

-- ============================================================================
-- 7. R6 parity — reconcile credits ONLY confirmed check-ins
-- ============================================================================
-- CREATE OR REPLACE from the LATEST body (20261006000000 P2.1b), byte-for-byte, with the
-- SINGLE change: the event_checkin loop now filters status='confirmed' so the nightly
-- self-heal matches the confirmation-time trigger exactly (no early row is ever credited).
CREATE OR REPLACE FUNCTION public.reconcile_engagement(p_user uuid DEFAULT NULL)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  SET lock_timeout = '5s'
AS $fn$
DECLARE r record; v_family text; v_author uuid;
BEGIN
  -- like (A1: liker <> post author)
  FOR r IN SELECT pl.user_id, pl.post_id, p.user_id AS author, p.resource_id FROM public.post_likes pl
           JOIN public.posts p ON p.id = pl.post_id
           WHERE pl.user_id <> p.user_id AND (p_user IS NULL OR pl.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.user_id,'like','post',r.post_id,'post_likes',r.user_id::text||':'||r.post_id::text,v_family,false);
  END LOOP;
  -- poll_vote (A1: voter <> post author)
  FOR r IN SELECT pv.user_id, pv.poll_id, p.user_id AS author, p.resource_id FROM public.poll_votes pv
           JOIN public.polls pl ON pl.id = pv.poll_id JOIN public.posts p ON p.id = pl.post_id
           WHERE pv.user_id <> p.user_id AND (p_user IS NULL OR pv.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.user_id,'poll_vote','poll',r.poll_id,'poll_votes',r.user_id::text||':'||r.poll_id::text,v_family,false);
  END LOOP;
  -- follow (A1: follower <> following)
  FOR r IN SELECT follower_id, following_id FROM public.follows WHERE follower_id <> following_id AND (p_user IS NULL OR follower_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.follower_id,'follow','user',r.following_id,'follows',r.follower_id::text||':'||r.following_id::text,NULL,false);
  END LOOP;
  -- comment (A1: commenter <> post author; visible only)
  FOR r IN SELECT DISTINCT pc.user_id, pc.post_id, p.user_id AS author, p.resource_id FROM public.post_comments pc
           JOIN public.posts p ON p.id = pc.post_id
           WHERE (pc.is_hidden IS NOT TRUE) AND pc.user_id <> p.user_id AND (p_user IS NULL OR pc.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.user_id,'comment','post',r.post_id,'post_comments',r.user_id::text||':'||r.post_id::text,v_family,false);
  END LOOP;
  -- petition_signature (private; A1: signer <> petition creator)
  FOR r IN SELECT ps.signer_id, ps.petition_id FROM public.petition_signatures ps
           JOIN public.petitions pt ON pt.id = ps.petition_id
           WHERE ps.signer_id IS DISTINCT FROM pt.created_by AND (p_user IS NULL OR ps.signer_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.signer_id,'petition_signature','petition',r.petition_id,'petition_signatures',r.signer_id::text||':'||r.petition_id::text,NULL,false);
  END LOOP;
  -- event_checkin (private) — W1.6a R6: ONLY confirmed attendance earns the credit.
  FOR r IN SELECT user_id, occurrence_id FROM public.event_checkins WHERE user_id IS NOT NULL AND status = 'confirmed' AND (p_user IS NULL OR user_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.user_id,'event_checkin','event',r.occurrence_id,'event_checkins',r.user_id::text||':'||r.occurrence_id::text,NULL,false);
  END LOOP;
  -- safety_alert_vote (A1: voter <> alert creator; private)
  FOR r IN SELECT v.voter_id, v.alert_id FROM public.safety_alert_votes v JOIN public.safety_alerts a ON a.id = v.alert_id
           WHERE v.voter_id IS DISTINCT FROM a.created_by AND (p_user IS NULL OR v.voter_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.voter_id,'safety_alert_vote','safety_alert',r.alert_id,'safety_alert_votes',r.voter_id::text||':'||r.alert_id::text,NULL,false);
  END LOOP;
  -- message (private; once per conversation)
  FOR r IN SELECT DISTINCT sender_id, conversation_id FROM public.messages WHERE p_user IS NULL OR sender_id = p_user LOOP
    PERFORM public.record_engagement_event(r.sender_id,'message','conversation',r.conversation_id,'messages',r.sender_id::text||':'||r.conversation_id::text,NULL,false);
  END LOOP;
  -- resource_bookmark (A1: user <> resource submitter; private)
  FOR r IN SELECT rb.user_id, rb.resource_id, res.category, res.submitted_by FROM public.resource_bookmarks rb
           JOIN public.resources res ON res.id = rb.resource_id
           WHERE rb.user_id IS DISTINCT FROM res.submitted_by AND (p_user IS NULL OR rb.user_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.user_id,'resource_bookmark','resource',r.resource_id,'resource_bookmarks',r.user_id::text||':'||r.resource_id::text,public.engagement_category_family(r.category),false);
  END LOOP;
  -- saved_resource (A1: user <> resource submitter; private)
  FOR r IN SELECT sr.user_id, sr.resource_id, res.category, res.submitted_by FROM public.saved_resources sr
           JOIN public.resources res ON res.id = sr.resource_id
           WHERE sr.resource_id IS NOT NULL AND sr.user_id IS DISTINCT FROM res.submitted_by AND (p_user IS NULL OR sr.user_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.user_id,'saved_resource','resource',r.resource_id,'saved_resources',r.user_id::text||':'||r.resource_id::text,public.engagement_category_family(r.category),false);
  END LOOP;
  -- opt_in completed: provider (public) + seeker (private)
  FOR r IN SELECT oi.id, oi.seeker_id, oi.resource_id, p.user_id AS author FROM public.resource_opt_ins oi
           JOIN public.posts p ON p.id = oi.post_id
           WHERE oi.status = 'completed' AND (p_user IS NULL OR oi.seeker_id = p_user OR p.user_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.author,'opt_in_completed_provider','opt_in',r.id,'resource_opt_ins',r.id::text,v_family,false);
    PERFORM public.record_engagement_event(r.seeker_id,'opt_in_completed_seeker','opt_in',r.id,'resource_opt_ins',r.id::text,v_family,false);
  END LOOP;
  -- conversation completed: volunteer (public) + requester (private)
  FOR r IN SELECT c.id, c.volunteer_id, c.requester_id, c.resource_id FROM public.conversations c
           WHERE c.status = 'completed' AND (p_user IS NULL OR c.volunteer_id = p_user OR c.requester_id = p_user) LOOP
    SELECT public.engagement_category_family(res.category) INTO v_family FROM public.resources res WHERE res.id = r.resource_id;
    PERFORM public.record_engagement_event(r.volunteer_id,'conversation_completed_volunteer','conversation',r.id,'conversations',r.id::text,v_family,false);
    PERFORM public.record_engagement_event(r.requester_id,'conversation_completed_requester','conversation',r.id,'conversations',r.id::text,v_family,false);
  END LOOP;
  -- review_received (private; keyed on anchor)
  FOR r IN SELECT id, reviewee_id, opt_in_id, conversation_id FROM public.reviews WHERE p_user IS NULL OR reviewee_id = p_user LOOP
    v_family := NULL;
    IF r.opt_in_id IS NOT NULL THEN
      SELECT public.engagement_category_family(res.category) INTO v_family
      FROM public.resource_opt_ins oi LEFT JOIN public.resources res ON res.id = oi.resource_id WHERE oi.id = r.opt_in_id;
    ELSIF r.conversation_id IS NOT NULL THEN
      SELECT public.engagement_category_family(res.category) INTO v_family
      FROM public.conversations c JOIN public.resources res ON res.id = c.resource_id WHERE c.id = r.conversation_id;
    END IF;
    PERFORM public.record_engagement_event(r.reviewee_id,'review_received','review',COALESCE(r.opt_in_id, r.conversation_id),'reviews',COALESCE(r.opt_in_id, r.conversation_id)::text,v_family,true);
  END LOOP;
  -- safety_alert_verified (PRIVATE — reporter created_by has no client grant; admin; not self-verified)
  FOR r IN SELECT id, created_by FROM public.safety_alerts
           WHERE verified IS TRUE AND created_by IS NOT NULL AND verified_by IS NOT NULL AND verified_by <> created_by
             AND (p_user IS NULL OR created_by = p_user) LOOP
    PERFORM public.record_engagement_event(r.created_by,'safety_alert_verified','safety_alert',r.id,'safety_alerts',r.id::text,NULL,true);
  END LOOP;
  -- resource_approved (public; admin; not self-approved)
  FOR r IN SELECT id, submitted_by, category FROM public.resources
           WHERE status = 'approved' AND submitted_by IS NOT NULL AND moderated_by IS NOT NULL AND moderated_by <> submitted_by
             AND (p_user IS NULL OR submitted_by = p_user) LOOP
    PERFORM public.record_engagement_event(r.submitted_by,'resource_approved','resource',r.id,'resources',r.id::text,public.engagement_category_family(r.category),true);
  END LOOP;
  -- appreciation_gift (P2.1b, USER RULING) — PUBLIC badge level; edge stays private in
  -- appreciation_gifts. Credit the RECEIVER once per DISTINCT giver (target_id = giver_id), so
  -- the counter = number of distinct non-guest givers — byte-identical to give_appreciation's
  -- inline write (same actor/kind/target/source_pk). DISTINCT collapses repeat gifts from one
  -- giver to a single credit; record_engagement_event additionally skips any guest receiver.
  -- ADDITIVE-only (ON CONFLICT DO NOTHING): a credit for a giver whose account was later
  -- deleted (their gift rows CASCADE away) is never recreated here, but is also never removed —
  -- the surviving ledger row keeps it (target_id has no FK). See I3a in the header.
  FOR r IN SELECT DISTINCT receiver_id, giver_id FROM public.appreciation_gifts
           WHERE (p_user IS NULL OR receiver_id = p_user) LOOP
    PERFORM public.record_engagement_event(r.receiver_id,'appreciation_gift','user',r.giver_id,'appreciation_gifts',r.receiver_id::text||':'||r.giver_id::text,NULL,false);
  END LOOP;
  -- post_created (A2: author credited iff a QUALIFYING outside engagement exists by a
  -- non-guest ≠ author — a like, a NON-HIDDEN comment, a POLL VOTE, or an opt-in. This must
  -- match the live triggers exactly (poll_vote also credits post_created; hidden comments do
  -- not). The EXISTS proves outside engagement; family is derived from the post.
  FOR r IN SELECT p.id, p.user_id, p.resource_id, p.metadata FROM public.posts p
           WHERE (p_user IS NULL OR p.user_id = p_user)
             AND EXISTS (
               SELECT 1 FROM public.post_likes pl JOIN auth.users u ON u.id = pl.user_id
                 WHERE pl.post_id = p.id AND pl.user_id <> p.user_id AND u.is_anonymous IS NOT TRUE
               UNION ALL
               SELECT 1 FROM public.post_comments pc JOIN auth.users u ON u.id = pc.user_id
                 WHERE pc.post_id = p.id AND pc.user_id <> p.user_id AND u.is_anonymous IS NOT TRUE
                   AND pc.is_hidden IS NOT TRUE
               UNION ALL
               SELECT 1 FROM public.poll_votes pv JOIN public.polls pol ON pol.id = pv.poll_id
                 JOIN auth.users u ON u.id = pv.user_id
                 WHERE pol.post_id = p.id AND pv.user_id <> p.user_id AND u.is_anonymous IS NOT TRUE
               UNION ALL
               SELECT 1 FROM public.resource_opt_ins oi JOIN auth.users u ON u.id = oi.seeker_id
                 WHERE oi.post_id = p.id AND oi.seeker_id <> p.user_id AND u.is_anonymous IS NOT TRUE
             ) LOOP
    v_family := NULL;
    IF r.resource_id IS NOT NULL THEN
      SELECT public.engagement_category_family(category) INTO v_family FROM public.resources WHERE id = r.resource_id;
    END IF;
    IF v_family IS NULL AND r.metadata ? 'categories' AND jsonb_typeof(r.metadata->'categories') = 'array'
       AND jsonb_array_length(r.metadata->'categories') > 0 THEN
      v_family := public.engagement_family_from_chip(r.metadata->'categories'->>0);
    END IF;
    PERFORM public.record_engagement_event(r.user_id,'post_created','post',r.id,'posts',r.id::text,v_family,false);
  END LOOP;
END;
$fn$;

-- Reconcile stays non-client-executable (smoke 26/27 verify).
REVOKE EXECUTE ON FUNCTION public.reconcile_engagement(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reconcile_engagement(uuid) TO service_role;

COMMIT;
