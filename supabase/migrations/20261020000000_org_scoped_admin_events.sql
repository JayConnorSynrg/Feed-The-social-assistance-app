-- 20261020000000_org_scoped_admin_events.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Objective: an organization-scoped admin page where an org admin (or a platform admin) manages
-- ONE organization and creates events that appear on the community feed.
--
-- What this migration does
--   (a) Events are created in ONE step: create_org_event writes the event, its first date and
--       one audit row together. Times are entered as local wall-clock time in the venue's IANA
--       time zone (assistance_events.time_zone, fixed after create). A local time that does not
--       exist (DST gap) or happens twice (DST repeat) is refused with SQLSTATE 22023.
--       A repeated call with the same idempotency key returns the same event and writes nothing.
--   (b) Dates are added with add_event_dates (a start time the event already has scheduled is
--       ignored; one that was cancelled is scheduled again; a retired event is refused) and
--       cancelled with cancel_event_occurrence. Clients no longer write
--       event_occurrences directly: the 6 write policies are dropped and the table privileges
--       revoked. Audit: exactly one admin_actions row per write (event.create /
--       event.add_dates / occurrence.cancel, and event.update / event.retire from
--       admin_update_event), carrying the request's request_id; an idempotent replay of
--       create_org_event returns the existing id and writes nothing.
--   (c) Who may write events: a platform admin for any non-business organization (active or
--       not), or an admin of THAT organization while it is active and non-business. A guest
--       (anonymous sign-in) session is refused even if it holds an admin row. Everyone else
--       gets 42501 and nothing is written. Business organizations keep their existing paths.
--       Events of an inactive organization never reach the feed (f).
--   (d) Event location: p_location_source 'org' copies the organization's map pin; 'address'
--       takes a point the person confirmed through FEED's Census geocoder (/api/geocode). Stored
--       with geocode_accuracy 'point'. The Mapbox tier parameters are gone.
--   (e) admin_create_event is dropped; admin_update_event loses the rrule + Mapbox parameters,
--       takes the same write authority and now writes one audit row per call
--       (event.update / event.retire).
--       The never-expanded recurrence columns assistance_events.rrule and
--       event_occurrences.rrule_dtstart are dropped (0 non-null rows in production, 2026-10-06).
--   (f) Feed: ranked_feed_v2 shows an event to EVERY viewer (anon, guest, member, admin) exactly
--       when the event is active, its organization is active, and it has an upcoming date within
--       30 days. Events rank with their own half-life ranking_config.event_half_life_hours
--       (default 168 h = one week). Both former extra paths leave the predicate: the
--       platform-admin / org-admin bypass and the signed-in "in-progress date of a retired event"
--       path. The posts branch text and ranked_feed (v1) are unchanged. ranking_config grants
--       (anon/authenticated SELECT + MAINTAIN) are left as they are.
--   (g) can_admin_org(org_id) answers the org admin page's route gate with the same rule as (c):
--       a platform admin for any non-business organization; an org admin for their own active
--       non-business organization.
--   (h) Org admins edit their own organization's profile: admin_save_organization accepts an
--       admin of an active, non-business organization for that organization only (create stays
--       platform-only; org_type stays platform-only; guests are refused; is_active and the admin
--       roster are never written by it);
--       can_manage_org_photos admits the same org admin. The direct-UPDATE policy
--       orgs_update_org_admin is dropped (it let an org admin set org_type='business' and
--       submitted_by=self, which unlocked the business owner policies).
--
-- Migration order (5-step): (1) no extensions; (2) column + constraint changes on existing
-- tables; (3)-(4) no new tables; functions; (5) RLS policy changes last. ONE transaction; the
-- schema_migrations ledger row is written in the SAME transaction.

BEGIN;
-- Fail fast instead of queueing behind long reads when a lock is contended.
SET LOCAL lock_timeout = '5s';

-- ============================================================================
-- 2. Tables (existing) — columns + constraints
-- ============================================================================

-- Events rank with their own half-life (posts keep half_life_hours).
ALTER TABLE public.ranking_config
  ADD COLUMN event_half_life_hours numeric NOT NULL DEFAULT 168;

-- time_zone: the IANA zone the event's local times are entered in (NOT NULL; production holds 0
-- events). The CHECK enforces the Area/Location shape; the RPCs additionally require the name to
-- exist in pg_timezone_names. idempotency_key: one key per org makes create exactly-once.
ALTER TABLE public.assistance_events
  ADD COLUMN time_zone text NOT NULL,
  ADD COLUMN idempotency_key uuid,
  ADD CONSTRAINT assistance_events_time_zone_shape
    CHECK (time_zone ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$'),
  ADD CONSTRAINT assistance_events_org_idempotency_key UNIQUE (org_id, idempotency_key),
  DROP COLUMN rrule;

ALTER TABLE public.event_occurrences
  ADD CONSTRAINT event_occurrences_ends_after_starts CHECK (ends_at > starts_at),
  ADD CONSTRAINT event_occurrences_event_starts_key UNIQUE (event_id, starts_at),
  DROP COLUMN rrule_dtstart;

-- An event's time zone is fixed once it is created (its dates were entered in that zone).
CREATE OR REPLACE FUNCTION public.assistance_events_time_zone_fixed()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.time_zone IS DISTINCT FROM OLD.time_zone THEN
    RAISE EXCEPTION 'event_invalid: an event''s time zone is fixed when the event is created'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.assistance_events_time_zone_fixed() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_assistance_events_time_zone_fixed
  BEFORE UPDATE ON public.assistance_events
  FOR EACH ROW EXECUTE FUNCTION public.assistance_events_time_zone_fixed();

-- ============================================================================
-- 3. Internal helpers (not client-executable)
-- ============================================================================

-- event_local_to_utc: a local wall-clock time in an IANA zone -> the instant. Refuses (22023) a
-- time that does not exist (spring-forward gap) and a time that happens twice (fall-back
-- repeat). Detection: a gap time does not round-trip; an ambiguous time round-trips under BOTH
-- the offset in force a day before and the offset in force a day after (works for 30-minute
-- shifts such as Australia/Lord_Howe). Independent of the session TimeZone.
CREATE OR REPLACE FUNCTION public.event_local_to_utc(p_local timestamp, p_time_zone text)
  RETURNS timestamptz
  LANGUAGE plpgsql
  STABLE
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_inst   timestamptz;
  v_before interval;
  v_after  interval;
BEGIN
  IF p_local IS NULL THEN
    RAISE EXCEPTION 'event_invalid: start and end times are required' USING ERRCODE = '22023';
  END IF;
  v_inst := p_local AT TIME ZONE p_time_zone;
  IF (v_inst AT TIME ZONE p_time_zone) <> p_local THEN
    RAISE EXCEPTION 'event_time_invalid: % does not exist in % (the clocks skip ahead for daylight saving time); choose another time',
      to_char(p_local, 'YYYY-MM-DD HH24:MI'), p_time_zone USING ERRCODE = '22023';
  END IF;
  v_before := ((v_inst - interval '1 day') AT TIME ZONE p_time_zone)
            - ((v_inst - interval '1 day') AT TIME ZONE 'UTC');
  v_after  := ((v_inst + interval '1 day') AT TIME ZONE p_time_zone)
            - ((v_inst + interval '1 day') AT TIME ZONE 'UTC');
  IF v_before <> v_after
     AND (((p_local - v_before) AT TIME ZONE 'UTC') AT TIME ZONE p_time_zone) = p_local
     AND (((p_local - v_after)  AT TIME ZONE 'UTC') AT TIME ZONE p_time_zone) = p_local THEN
    RAISE EXCEPTION 'event_time_invalid: % happens twice in % (the clocks go back when daylight saving time ends); choose a time outside that hour',
      to_char(p_local, 'YYYY-MM-DD HH24:MI'), p_time_zone USING ERRCODE = '22023';
  END IF;
  RETURN v_inst;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.event_local_to_utc(timestamp, text) FROM PUBLIC, anon, authenticated;

-- org_event_write_gate: the one authority for every event write. Refuses a guest (anonymous
-- sign-in) session outright, even one holding an admin row. Allows a platform admin for any
-- non-business organization (active or not), and an admin of THIS organization only while it is
-- active and non-business (row locked FOR SHARE so a concurrent deactivation waits for this
-- transaction). is_org_admin() has no active check, so the active check lives here. Raises 42501
-- otherwise.
-- Returns the actor role recorded in the audit row. Runs inside the SECDEF RPCs (as the owner).
CREATE OR REPLACE FUNCTION public.org_event_write_gate(p_org_id uuid)
  RETURNS text
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_platform boolean;
  v_active   boolean;
  v_type     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'event_denied: sign in required' USING ERRCODE = '42501';
  END IF;
  IF COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'event_denied: guests cannot manage events; sign in with an account' USING ERRCODE = '42501';
  END IF;
  v_platform := public.is_current_user_admin();
  IF NOT v_platform AND NOT public.is_org_admin(p_org_id) THEN
    RAISE EXCEPTION 'event_denied: only a platform admin or an admin of this organization may manage its events'
      USING ERRCODE = '42501';
  END IF;
  SELECT o.is_active, o.org_type INTO v_active, v_type
    FROM public.organizations o WHERE o.id = p_org_id FOR SHARE;
  IF NOT FOUND OR v_type = 'business' THEN
    RAISE EXCEPTION 'event_denied: events are managed only for a non-business organization'
      USING ERRCODE = '42501';
  END IF;
  IF NOT v_platform AND v_active IS NOT TRUE THEN
    RAISE EXCEPTION 'event_denied: this organization is inactive; only a platform admin may manage its events'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN v_platform THEN 'platform_admin' ELSE 'org_admin' END;
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.org_event_write_gate(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 3b. Event writers (SECDEF RPCs)
-- ============================================================================

-- create_org_event — the event, its first date and one audit row, in one transaction.
-- Returns the event id. A repeat with the same (org, idempotency key) returns the original id
-- and writes nothing (checked before validation, and again by ON CONFLICT for a concurrent
-- repeat). No EXCEPTION handler: any failure aborts the whole call.
CREATE OR REPLACE FUNCTION public.create_org_event(
  p_org_id uuid,
  p_idempotency_key uuid,
  p_title text,
  p_time_zone text,
  p_starts_local timestamp,
  p_ends_local timestamp,
  p_location_source text,
  p_event_type text DEFAULT 'distribution',
  p_description text DEFAULT NULL,
  p_location_name text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip_code text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_default_capacity integer DEFAULT NULL,
  p_requires_registration boolean DEFAULT false)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_role     text;
  v_id       uuid;
  v_occ      uuid;
  v_starts   timestamptz;
  v_ends     timestamptz;
  v_loc      geography;
  v_loc_name text;
  v_address  text;
  v_city     text;
  v_state    text;
  v_zip      text;
BEGIN
  v_role := public.org_event_write_gate(p_org_id);

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'event_invalid: an idempotency key is required' USING ERRCODE = '22023';
  END IF;
  SELECT ae.id INTO v_id FROM public.assistance_events ae
   WHERE ae.org_id = p_org_id AND ae.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'event_invalid: a title is required' USING ERRCODE = '22023';
  END IF;
  IF p_time_zone IS NULL
     OR p_time_zone !~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$'
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p_time_zone) THEN
    RAISE EXCEPTION 'event_invalid: % is not an IANA time zone such as America/New_York',
      COALESCE(p_time_zone, '<missing>') USING ERRCODE = '22023';
  END IF;
  v_starts := public.event_local_to_utc(p_starts_local, p_time_zone);
  v_ends   := public.event_local_to_utc(p_ends_local, p_time_zone);
  IF v_ends <= v_starts THEN
    RAISE EXCEPTION 'event_invalid: the end time must be after the start time' USING ERRCODE = '22023';
  END IF;

  IF p_location_source = 'org' THEN
    SELECT o.location, o.address, o.city, o.state, o.zip_code, o.name
      INTO v_loc, v_address, v_city, v_state, v_zip, v_loc_name
      FROM public.organizations o WHERE o.id = p_org_id;
    IF v_loc IS NULL THEN
      RAISE EXCEPTION 'event_location_invalid: this organization has no map pin; enter the event address instead'
        USING ERRCODE = '22023';
    END IF;
    v_loc_name := COALESCE(NULLIF(btrim(p_location_name), ''), v_loc_name);
  ELSIF p_location_source = 'address' THEN
    IF NULLIF(btrim(p_address), '') IS NULL THEN
      RAISE EXCEPTION 'event_location_invalid: a street address is required' USING ERRCODE = '22023';
    END IF;
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RAISE EXCEPTION 'event_location_invalid: confirm the address on the map first' USING ERRCODE = '22023';
    END IF;
    PERFORM public.w1_6a_validate_geo(p_lat, p_lng, NULL);
    v_loc      := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
    v_loc_name := NULLIF(btrim(p_location_name), '');
    v_address  := btrim(p_address);
    v_city     := NULLIF(btrim(p_city), '');
    v_state    := NULLIF(btrim(p_state), '');
    v_zip      := NULLIF(btrim(p_zip_code), '');
  ELSE
    RAISE EXCEPTION 'event_location_invalid: location source must be org or address, got %',
      COALESCE(p_location_source, '<missing>') USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.assistance_events
    (org_id, idempotency_key, title, event_type, description, location_name,
     address, city, state, zip_code, location, geocode_accuracy, geocode_confidence,
     time_zone, default_capacity, requires_registration, created_by)
  VALUES
    (p_org_id, p_idempotency_key, btrim(p_title), COALESCE(p_event_type, 'distribution'),
     NULLIF(btrim(p_description), ''), v_loc_name,
     v_address, v_city, v_state, v_zip, v_loc, 'point', NULL,
     p_time_zone, p_default_capacity, COALESCE(p_requires_registration, false), v_uid)
  ON CONFLICT (org_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- A concurrent call with the same key committed first: return its event, write nothing.
    SELECT ae.id INTO v_id FROM public.assistance_events ae
     WHERE ae.org_id = p_org_id AND ae.idempotency_key = p_idempotency_key;
    RETURN v_id;
  END IF;

  INSERT INTO public.event_occurrences (event_id, starts_at, ends_at, capacity)
  VALUES (v_id, v_starts, v_ends, p_default_capacity)
  RETURNING id INTO v_occ;

  PERFORM public.record_admin_action(
    v_uid, 'event.create', 'event', v_id::text, 'ok', NULL,
    jsonb_build_object('org_id', p_org_id, 'occurrence_id', v_occ, 'time_zone', p_time_zone,
                       'starts_at', v_starts, 'ends_at', v_ends,
                       'location_source', p_location_source, 'actor_role', v_role),
    public.request_id());

  RETURN v_id;
END
$fn$;
REVOKE ALL ON FUNCTION public.create_org_event(uuid, uuid, text, text, timestamp, timestamp, text, text, text, text, text, text, text, text, double precision, double precision, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_org_event(uuid, uuid, text, text, timestamp, timestamp, text, text, text, text, text, text, text, text, double precision, double precision, integer, boolean) TO authenticated;

-- add_event_dates — more dates for an existing, active event, entered as local times in the
-- event's own time zone. A start time the event already has SCHEDULED (or completed) is ignored;
-- one whose date was CANCELLED is scheduled again with the supplied end time, unless it has
-- check-ins (refused with P0001, naming the local start like the other per-date errors). A start time repeated in
-- the call counts once (first end time wins). Returns how many dates were added or restored.
-- One audit row per call (also when nothing changed), listing the restored occurrence ids.
CREATE OR REPLACE FUNCTION public.add_event_dates(
  p_event_id uuid,
  p_starts_local timestamp[],
  p_ends_local timestamp[])
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_org    uuid;
  v_role   text;
  v_tz     text;
  v_active boolean;
  v_cap    integer;
  v_starts timestamptz[] := '{}';
  v_ends   timestamptz[] := '{}';
  v_s      timestamptz;
  v_e      timestamptz;
  v_n      integer;
  v_added  integer;
  v_restored integer;
  v_restored_ids uuid[];
BEGIN
  SELECT ae.org_id INTO v_org FROM public.assistance_events ae WHERE ae.id = p_event_id;
  IF NOT FOUND THEN
    IF v_uid IS NOT NULL AND public.is_current_user_admin() THEN
      RAISE EXCEPTION 'event_not_found: %', p_event_id USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'event_denied: only a platform admin or an admin of this organization may manage its events'
      USING ERRCODE = '42501';
  END IF;
  v_role := public.org_event_write_gate(v_org);

  SELECT ae.time_zone, ae.is_active, ae.default_capacity INTO v_tz, v_active, v_cap
    FROM public.assistance_events ae WHERE ae.id = p_event_id FOR UPDATE;
  IF v_active IS NOT TRUE THEN
    RAISE EXCEPTION 'event_retired: this event is retired; reactivate it before adding dates'
      USING ERRCODE = 'P0001';
  END IF;

  v_n := cardinality(p_starts_local);
  IF v_n IS NULL OR v_n = 0 OR v_n IS DISTINCT FROM cardinality(p_ends_local) THEN
    RAISE EXCEPTION 'event_invalid: give at least one date, with one end time for every start time'
      USING ERRCODE = '22023';
  END IF;
  FOR i IN 1 .. v_n LOOP
    v_s := public.event_local_to_utc(p_starts_local[i], v_tz);
    v_e := public.event_local_to_utc(p_ends_local[i], v_tz);
    IF v_e <= v_s THEN
      RAISE EXCEPTION 'event_invalid: the end time must be after the start time (%)',
        to_char(p_starts_local[i], 'YYYY-MM-DD HH24:MI') USING ERRCODE = '22023';
    END IF;
    -- A cancelled date that already has check-ins stays cancelled (w1_6a K1). Refuse here, naming
    -- the date, before the occurrence guard would refuse it without one.
    IF EXISTS (SELECT 1 FROM public.event_occurrences eo
                WHERE eo.event_id = p_event_id AND eo.starts_at = v_s AND eo.status = 'cancelled'
                  AND (EXISTS (SELECT 1 FROM public.event_checkins c WHERE c.occurrence_id = eo.id)
                       OR EXISTS (SELECT 1 FROM public.event_anonymous_claims a WHERE a.occurrence_id = eo.id))) THEN
      RAISE EXCEPTION 'This event has check-ins and cannot be reopened once cancelled or completed. (%)',
        to_char(p_starts_local[i], 'YYYY-MM-DD HH24:MI') USING ERRCODE = 'P0001';
    END IF;
    v_starts := v_starts || v_s;
    v_ends   := v_ends || v_e;
  END LOOP;

  -- xmax = 0 marks a freshly inserted row; a row returned by DO UPDATE is a restored date.
  WITH dates AS (
    SELECT DISTINCT ON (d.s) d.s, d.e
      FROM unnest(v_starts, v_ends) WITH ORDINALITY AS d(s, e, ord)
     ORDER BY d.s, d.ord
  ), written AS (
    INSERT INTO public.event_occurrences AS eo (event_id, starts_at, ends_at, capacity)
    SELECT p_event_id, dates.s, dates.e, v_cap FROM dates
    ON CONFLICT (event_id, starts_at) DO UPDATE
      SET status = 'upcoming', ends_at = EXCLUDED.ends_at
      WHERE eo.status = 'cancelled'
    RETURNING eo.id, (eo.xmax = 0) AS inserted
  )
  SELECT count(*) FILTER (WHERE w.inserted),
         count(*) FILTER (WHERE NOT w.inserted),
         COALESCE(array_agg(w.id ORDER BY w.id) FILTER (WHERE NOT w.inserted), '{}')
    INTO v_added, v_restored, v_restored_ids
    FROM written w;

  PERFORM public.record_admin_action(
    v_uid, 'event.add_dates', 'event', p_event_id::text, 'ok', NULL,
    jsonb_build_object('org_id', v_org, 'requested', v_n, 'added', v_added, 'restored', v_restored,
                       'restored_ids', to_jsonb(v_restored_ids), 'time_zone', v_tz, 'actor_role', v_role),
    public.request_id());

  RETURN v_added + v_restored;
END
$fn$;
REVOKE ALL ON FUNCTION public.add_event_dates(uuid, timestamp[], timestamp[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_event_dates(uuid, timestamp[], timestamp[]) TO authenticated;

-- cancel_event_occurrence — cancel one date. The occurrence guard trigger still refuses an
-- ended date (attendance history is permanent). One audit row per call; cancelling an already
-- cancelled date changes nothing and is still audited.
CREATE OR REPLACE FUNCTION public.cancel_event_occurrence(p_occurrence_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_org    uuid;
  v_event  uuid;
  v_status text;
  v_role   text;
BEGIN
  SELECT ae.org_id, eo.event_id INTO v_org, v_event
    FROM public.event_occurrences eo
    JOIN public.assistance_events ae ON ae.id = eo.event_id
   WHERE eo.id = p_occurrence_id;
  IF NOT FOUND THEN
    IF v_uid IS NOT NULL AND public.is_current_user_admin() THEN
      RAISE EXCEPTION 'occurrence_not_found: %', p_occurrence_id USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'event_denied: only a platform admin or an admin of this organization may manage its events'
      USING ERRCODE = '42501';
  END IF;
  v_role := public.org_event_write_gate(v_org);

  SELECT eo.status INTO v_status FROM public.event_occurrences eo
   WHERE eo.id = p_occurrence_id FOR UPDATE;
  UPDATE public.event_occurrences SET status = 'cancelled' WHERE id = p_occurrence_id;

  PERFORM public.record_admin_action(
    v_uid, 'occurrence.cancel', 'event_occurrence', p_occurrence_id::text, 'ok', NULL,
    jsonb_build_object('org_id', v_org, 'event_id', v_event, 'was_status', v_status,
                       'actor_role', v_role),
    public.request_id());
END
$fn$;
REVOKE ALL ON FUNCTION public.cancel_event_occurrence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_event_occurrence(uuid) TO authenticated;

-- admin_create_event is replaced by create_org_event.
DROP FUNCTION public.admin_create_event(uuid, text, text, text, text, text, text, text, text, text, integer, boolean, double precision, double precision, text, text);

-- admin_update_event — edit, retire (p_is_active=false) or reactivate an event. Same write
-- authority as create. Location: p_location_source NULL keeps the pin; 'org' copies the
-- organization's pin and address; 'address' stores the confirmed point (p_lat/p_lng). Changing
-- the address text without a location source is refused, so a pin never disagrees with its
-- address. Clearing 'address' (p_clear) drops the pin. Optional text fields are cleared only when
-- named in p_clear (a NULL argument keeps the stored value). The time zone is not editable.
-- Exactly one audit row per call: 'event.retire' when p_is_active = false, else 'event.update'.
DROP FUNCTION public.admin_update_event(uuid, text, text, text, text, text, text, text, text, text, integer, boolean, double precision, double precision, text, text, boolean, boolean, text[]);

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
  p_default_capacity integer DEFAULT NULL,
  p_requires_registration boolean DEFAULT NULL,
  p_location_source text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_clear text[] DEFAULT '{}'::text[])
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid        uuid := auth.uid();
  v_org        uuid;
  v_ev         record;
  v_clear      text[] := COALESCE(p_clear, '{}'::text[]);
  v_clear_addr boolean;
  v_set_loc    boolean := false;
  v_loc        geography;
  v_address    text;
  v_city       text;
  v_state      text;
  v_zip        text;
  v_org_name   text;
  v_role       text;
  v_cancelled  integer := 0;
BEGIN
  SELECT ae.org_id INTO v_org FROM public.assistance_events ae WHERE ae.id = p_event_id;
  IF NOT FOUND THEN
    IF v_uid IS NOT NULL AND public.is_current_user_admin() THEN
      RAISE EXCEPTION 'event_not_found: %', p_event_id USING ERRCODE = 'P0002';
    END IF;
    RAISE EXCEPTION 'event_denied: only a platform admin or an admin of this organization may manage its events'
      USING ERRCODE = '42501';
  END IF;
  v_role := public.org_event_write_gate(v_org);

  SELECT * INTO v_ev FROM public.assistance_events ae WHERE ae.id = p_event_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM unnest(v_clear) c(f)
             WHERE c.f IS NULL OR c.f NOT IN ('description', 'location_name', 'address', 'city', 'state', 'zip_code')) THEN
    RAISE EXCEPTION 'event_invalid: p_clear accepts description, location_name, address, city, state, zip_code'
      USING ERRCODE = '22023';
  END IF;
  v_clear_addr := 'address' = ANY (v_clear);

  IF p_location_source IS NOT NULL AND v_clear_addr THEN
    RAISE EXCEPTION 'event_location_invalid: an address cannot be cleared and set in the same save'
      USING ERRCODE = '22023';
  END IF;

  IF p_location_source = 'org' THEN
    SELECT o.location, o.address, o.city, o.state, o.zip_code, o.name
      INTO v_loc, v_address, v_city, v_state, v_zip, v_org_name
      FROM public.organizations o WHERE o.id = v_org;
    IF v_loc IS NULL THEN
      RAISE EXCEPTION 'event_location_invalid: this organization has no map pin; enter the event address instead'
        USING ERRCODE = '22023';
    END IF;
    v_set_loc := true;
  ELSIF p_location_source = 'address' THEN
    v_address := COALESCE(NULLIF(btrim(p_address), ''), v_ev.address);
    IF v_address IS NULL THEN
      RAISE EXCEPTION 'event_location_invalid: a street address is required' USING ERRCODE = '22023';
    END IF;
    IF p_lat IS NULL OR p_lng IS NULL THEN
      RAISE EXCEPTION 'event_location_invalid: confirm the address on the map first' USING ERRCODE = '22023';
    END IF;
    PERFORM public.w1_6a_validate_geo(p_lat, p_lng, NULL);
    v_loc     := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
    v_city    := CASE WHEN 'city' = ANY (v_clear) THEN NULL ELSE COALESCE(NULLIF(btrim(p_city), ''), v_ev.city) END;
    v_state   := CASE WHEN 'state' = ANY (v_clear) THEN NULL ELSE COALESCE(NULLIF(btrim(p_state), ''), v_ev.state) END;
    v_zip     := CASE WHEN 'zip_code' = ANY (v_clear) THEN NULL ELSE COALESCE(NULLIF(btrim(p_zip_code), ''), v_ev.zip_code) END;
    v_set_loc := true;
  ELSIF p_location_source IS NOT NULL THEN
    RAISE EXCEPTION 'event_location_invalid: location source must be org or address, got %', p_location_source
      USING ERRCODE = '22023';
  ELSIF NOT v_clear_addr
        AND ((p_address  IS NOT NULL AND btrim(p_address)  IS DISTINCT FROM v_ev.address)
          OR (p_city     IS NOT NULL AND btrim(p_city)     IS DISTINCT FROM v_ev.city)
          OR (p_state    IS NOT NULL AND btrim(p_state)    IS DISTINCT FROM v_ev.state)
          OR (p_zip_code IS NOT NULL AND btrim(p_zip_code) IS DISTINCT FROM v_ev.zip_code)) THEN
    RAISE EXCEPTION 'event_location_invalid: the address changed; confirm its map location (location source org or address)'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.assistance_events SET
    title         = COALESCE(NULLIF(btrim(p_title), ''), title),
    event_type    = COALESCE(p_event_type, event_type),
    description   = CASE WHEN 'description'   = ANY (v_clear) THEN NULL ELSE COALESCE(p_description, description) END,
    location_name = CASE WHEN 'location_name' = ANY (v_clear) THEN NULL ELSE COALESCE(p_location_name, location_name) END,
    address  = CASE WHEN v_set_loc THEN v_address
                    WHEN v_clear_addr THEN NULL ELSE address END,
    city     = CASE WHEN v_set_loc THEN v_city
                    WHEN 'city' = ANY (v_clear) THEN NULL ELSE city END,
    state    = CASE WHEN v_set_loc THEN v_state
                    WHEN 'state' = ANY (v_clear) THEN NULL ELSE state END,
    zip_code = CASE WHEN v_set_loc THEN v_zip
                    WHEN 'zip_code' = ANY (v_clear) THEN NULL ELSE zip_code END,
    location           = CASE WHEN v_set_loc THEN v_loc WHEN v_clear_addr THEN NULL ELSE location END,
    geocode_accuracy   = CASE WHEN v_set_loc THEN 'point' WHEN v_clear_addr THEN NULL ELSE geocode_accuracy END,
    geocode_confidence = CASE WHEN v_set_loc OR v_clear_addr THEN NULL ELSE geocode_confidence END,
    default_capacity      = COALESCE(p_default_capacity, default_capacity),
    requires_registration = COALESCE(p_requires_registration, requires_registration),
    is_active             = COALESCE(p_is_active, is_active)
  WHERE id = p_event_id;

  -- Retiring cancels only dates that have NOT started; an in-progress date runs to its end and
  -- ended dates keep their attendance history (w1_6a D1/D2).
  IF p_is_active IS FALSE THEN
    UPDATE public.event_occurrences
       SET status = 'cancelled'
     WHERE event_id = p_event_id
       AND status NOT IN ('cancelled', 'completed')
       AND starts_at > now();
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  END IF;

  PERFORM public.record_admin_action(
    v_uid, CASE WHEN p_is_active IS FALSE THEN 'event.retire' ELSE 'event.update' END,
    'event', p_event_id::text, 'ok', NULL,
    jsonb_build_object('org_id', v_org, 'was_active', v_ev.is_active,
                       'is_active', COALESCE(p_is_active, v_ev.is_active),
                       'location_source', p_location_source, 'cleared', to_jsonb(v_clear),
                       'cancelled_dates', v_cancelled, 'actor_role', v_role),
    public.request_id());
  RETURN p_event_id;
END
$fn$;
REVOKE ALL ON FUNCTION public.admin_update_event(uuid, text, text, text, text, text, text, text, text, integer, boolean, text, double precision, double precision, boolean, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_event(uuid, text, text, text, text, text, text, text, text, integer, boolean, text, double precision, double precision, boolean, text[]) TO authenticated;

-- ============================================================================
-- 3c. can_admin_org — route gate of the organization admin page
-- ============================================================================
-- Same rule as the event writers and admin_save_organization:
-- true  : a platform admin, for any existing non-business organization (active or inactive);
--         an admin of that organization, while it is active and non-business.
-- false : everyone else — anon (no session), guests (even holding an admin row), plain members, admins of other orgs,
--         admins of an inactive org — and NULL / unknown ids and business organizations.
--         Never raises for a NULL or unknown id. (A non-UUID string is rejected by the uuid
--         argument cast before the function runs; the route checks the UUID shape first.)
-- anon holds EXECUTE so a signed-out request gets false rather than a permission error.
CREATE OR REPLACE FUNCTION public.can_admin_org(p_org_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_active boolean;
BEGIN
  IF auth.uid() IS NULL OR p_org_id IS NULL
     OR COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RETURN false;
  END IF;
  SELECT o.is_active INTO v_active
    FROM public.organizations o WHERE o.id = p_org_id AND o.org_type <> 'business';
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF public.is_current_user_admin() THEN
    RETURN true;
  END IF;
  RETURN v_active IS TRUE AND public.is_org_admin(p_org_id);
END
$fn$;
REVOKE ALL ON FUNCTION public.can_admin_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_admin_org(uuid) TO anon, authenticated;

-- ============================================================================
-- 3d. Org admins edit their own organization (D2)
-- ============================================================================
-- admin_save_organization: the 20261017 body with ONE change of authority:
--   platform admin -> unchanged (create + update any organization);
--   admin of p_org_id -> update only, and only while that row (locked FOR UPDATE) exists, is
--     active and is not a business, and only with the stored org_type (the type is
--     platform-only); otherwise the same 42501 org_save_denied.
--   guest (anonymous sign-in) session -> 42501 org_save_denied, even holding an admin row.
-- The update branch never writes is_active / created_by / submitted_by / status / moderation, and
-- the admin roster lives elsewhere (platform-admin-only policies). The audit details gain
-- actor_role ('platform_admin' | 'org_admin'); actor_tier stays tier_of(actor) (NULL for an org
-- admin without a platform tier).
CREATE OR REPLACE FUNCTION public.admin_save_organization(p_org_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions, pg_temp
AS $fn$
DECLARE
  c_org_types   constant text[] := ARRAY['food_bank','pantry','shelter','clinic','mutual_aid','other',
                                         'business','community','nonprofit','government'];
  c_categories  constant text[] := ARRAY['food','housing','health','legal','employment','childcare',
                                         'transportation','education','financial','retail','other'];
  c_cost_models constant text[] := ARRAY['free','sliding_scale','paid'];
  c_attributes  constant text[] := ARRAY['wheelchair_accessible','wifi','parking','accepts_ebt',
                                         'multilingual','woman_owned','veteran_owned','lgbtq_friendly',
                                         'black_owned'];
  c_socials     constant text[] := ARRAY['facebook','instagram','x','linkedin','youtube','tiktok'];
  c_biz_keys    constant text[] := ARRAY['business_category','cost_model','service_radius_miles',
                                         'attributes','social_links','services'];
  c_url_re      constant text := '^https?://';
  c_email_re    constant text := '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
  c_open_re     constant text := '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$';
  c_close_re    constant text := '^(([01][0-9]|2[0-3]):[0-5][0-9](:00)?|24:00(:00)?)$';
  c_photo_url   constant text := '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?/storage/v1/object/public/org-photos/';
  c_uuid_re     constant text := '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$';
  c_text_keys   constant text[] := ARRAY['name','org_type','description','website','phone','email','address',
                                         'city','state','zip_code','business_category','cost_model'];
  v_actor        uuid;
  v_existing     text;
  v_created      boolean;
  v_name         text;
  v_org_type     text;
  v_is_business  boolean;
  v_website      text;
  v_email        text;
  v_location     geography;
  v_category     text;
  v_cost         text;
  v_radius       numeric;
  v_attrs        jsonb := '{}'::jsonb;
  v_socials      jsonb := '{}'::jsonb;
  v_item         jsonb;
  v_key          text;
  v_val          jsonb;
  v_open         time;
  v_close        time;
  v_path         text;
  v_url          text;
  v_path_re      text;
  v_logo_n       int := 0;
  v_cover_n      int := 0;
  v_new_paths    text[] := '{}';
  v_hour_keys    text[] := '{}';
  v_resource_ids uuid[] := '{}';
  v_removed      text[] := '{}';
  v_hours_n      int;
  v_photos_n     int;
  v_res_n        int;
  v_services_n   int;
  v_loc_set      boolean;
  v_platform     boolean;
  v_was_active   boolean;
  v_role         text;
BEGIN
  -- ========================= GATE (first statement) =========================
  -- A platform admin, or an admin of THIS organization (narrowed further after the row lock).
  -- A guest (anonymous sign-in) session is refused even if it holds an admin row.
  IF COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'org_save_denied: platform admin or an admin of this organization only' USING ERRCODE = '42501';
  END IF;
  v_platform := public.is_current_user_admin();
  IF NOT v_platform AND NOT public.is_org_admin(p_org_id) THEN
    RAISE EXCEPTION 'org_save_denied: platform admin or an admin of this organization only' USING ERRCODE = '42501';
  END IF;
  v_actor := auth.uid();
  v_role  := CASE WHEN v_platform THEN 'platform_admin' ELSE 'org_admin' END;

  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'org_save_invalid: p_org_id is required' USING ERRCODE = '22023';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'org_save_invalid: payload must be a JSON object' USING ERRCODE = '22023';
  END IF;

  -- The only storage paths this org owns: `<org_id>/<uuid>.(webp|jpg|png)`, anchored. Used to
  -- validate incoming photos AND to scope removed_photo_paths (no `<org>/../<other>/` escape).
  v_path_re := '^' || p_org_id::text
            || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$';

  -- Create vs update. FOR UPDATE serializes concurrent saves of the same org.
  SELECT o.org_type, o.is_active INTO v_existing, v_was_active
    FROM public.organizations o WHERE o.id = p_org_id FOR UPDATE;
  v_created := NOT FOUND;
  -- An org admin only UPDATES their own organization, and only while the locked row is active
  -- and not a business. Creating an organization stays platform-only.
  IF NOT v_platform AND (v_created OR v_was_active IS NOT TRUE OR v_existing = 'business') THEN
    RAISE EXCEPTION 'org_save_denied: platform admin or an admin of this organization only' USING ERRCODE = '42501';
  END IF;
  -- The organization type is set by platform admins only (an org admin sends the stored type).
  IF NOT v_platform AND (p_payload->>'org_type') IS DISTINCT FROM v_existing THEN
    RAISE EXCEPTION 'org_save_denied: only a platform admin may change the organization type' USING ERRCODE = '42501';
  END IF;

  -- ========================= VALIDATION (no writes) =========================
  -- Text fields are JSON strings (or null); an object/array/number is never coerced to text.
  FOREACH v_key IN ARRAY c_text_keys LOOP
    IF p_payload ? v_key AND jsonb_typeof(p_payload->v_key) NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'org_save_invalid: % must be a string', v_key USING ERRCODE = '22023';
    END IF;
  END LOOP;

  v_name := btrim(COALESCE(p_payload->>'name', ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'org_save_invalid: name is required' USING ERRCODE = '22023';
  END IF;

  v_org_type := p_payload->>'org_type';
  IF v_org_type IS NULL OR NOT (v_org_type = ANY (c_org_types)) THEN
    RAISE EXCEPTION 'org_save_invalid: org_type % is not allowed', COALESCE(v_org_type, '<missing>')
      USING ERRCODE = '22023';
  END IF;
  v_is_business := (v_org_type = 'business');

  -- Business <-> non-business switching would move a row across moderation planes.
  IF NOT v_created AND (v_existing = 'business') <> v_is_business THEN
    RAISE EXCEPTION 'org_save_invalid: cannot switch between business and non-business (% -> %)',
      v_existing, v_org_type USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'website' THEN
    v_website := NULLIF(btrim(p_payload->>'website'), '');
    IF v_website IS NOT NULL AND v_website !~* c_url_re THEN
      RAISE EXCEPTION 'org_save_invalid: website must start with http:// or https://' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_payload ? 'email' THEN
    v_email := NULLIF(btrim(p_payload->>'email'), '');
    IF v_email IS NOT NULL AND v_email !~ c_email_re THEN
      RAISE EXCEPTION 'org_save_invalid: email is not a valid address' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- location: absent -> keep; null -> clear; {lng,lat} -> set.
  IF p_payload ? 'location' AND jsonb_typeof(p_payload->'location') <> 'null' THEN
    IF jsonb_typeof(p_payload->'location') <> 'object'
       OR jsonb_typeof(p_payload->'location'->'lng') IS DISTINCT FROM 'number'
       OR jsonb_typeof(p_payload->'location'->'lat') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'org_save_invalid: location must be {lng: -180..180, lat: -90..90} or null'
        USING ERRCODE = '22023';
    END IF;
    IF (p_payload->'location'->>'lng')::double precision NOT BETWEEN -180 AND 180
       OR (p_payload->'location'->>'lat')::double precision NOT BETWEEN -90 AND 90 THEN
      RAISE EXCEPTION 'org_save_invalid: location must be {lng: -180..180, lat: -90..90} or null'
        USING ERRCODE = '22023';
    END IF;
    v_location := ST_SetSRID(ST_MakePoint((p_payload->'location'->>'lng')::double precision,
                                          (p_payload->'location'->>'lat')::double precision), 4326)::geography;
  END IF;

  -- Business-only fields: on a non-business org they may only be absent or empty.
  IF NOT v_is_business THEN
    FOREACH v_key IN ARRAY c_biz_keys LOOP
      IF p_payload ? v_key
         AND p_payload->v_key NOT IN ('null'::jsonb, '{}'::jsonb, '[]'::jsonb, '""'::jsonb) THEN
        RAISE EXCEPTION 'org_save_invalid: % is a business-only field', v_key USING ERRCODE = '22023';
      END IF;
    END LOOP;
  ELSE
    IF p_payload ? 'business_category' THEN
      v_category := NULLIF(btrim(p_payload->>'business_category'), '');
      IF v_category IS NOT NULL AND NOT (v_category = ANY (c_categories)) THEN
        RAISE EXCEPTION 'org_save_invalid: business_category % is not allowed', v_category USING ERRCODE = '22023';
      END IF;
    END IF;
    IF p_payload ? 'cost_model' THEN
      v_cost := NULLIF(btrim(p_payload->>'cost_model'), '');
      IF v_cost IS NOT NULL AND NOT (v_cost = ANY (c_cost_models)) THEN
        RAISE EXCEPTION 'org_save_invalid: cost_model % is not allowed', v_cost USING ERRCODE = '22023';
      END IF;
    END IF;
    IF p_payload ? 'service_radius_miles' AND jsonb_typeof(p_payload->'service_radius_miles') <> 'null' THEN
      IF jsonb_typeof(p_payload->'service_radius_miles') <> 'number' THEN
        RAISE EXCEPTION 'org_save_invalid: service_radius_miles must be a number >= 0' USING ERRCODE = '22023';
      END IF;
      IF (p_payload->>'service_radius_miles')::numeric < 0 THEN
        RAISE EXCEPTION 'org_save_invalid: service_radius_miles must be a number >= 0' USING ERRCODE = '22023';
      END IF;
      v_radius := (p_payload->>'service_radius_miles')::numeric;
    END IF;
    IF p_payload ? 'attributes' AND jsonb_typeof(p_payload->'attributes') <> 'null' THEN
      IF jsonb_typeof(p_payload->'attributes') <> 'object' THEN
        RAISE EXCEPTION 'org_save_invalid: attributes must be an object' USING ERRCODE = '22023';
      END IF;
      FOR v_key, v_val IN SELECT e.key, e.value FROM jsonb_each(p_payload->'attributes') e LOOP
        IF NOT (v_key = ANY (c_attributes)) OR jsonb_typeof(v_val) <> 'boolean' THEN
          RAISE EXCEPTION 'org_save_invalid: attribute % is not an allowed boolean key', v_key USING ERRCODE = '22023';
        END IF;
        IF v_val = 'true'::jsonb THEN
          v_attrs := v_attrs || jsonb_build_object(v_key, true);
        END IF;
      END LOOP;
    END IF;
    IF p_payload ? 'social_links' AND jsonb_typeof(p_payload->'social_links') <> 'null' THEN
      IF jsonb_typeof(p_payload->'social_links') <> 'object' THEN
        RAISE EXCEPTION 'org_save_invalid: social_links must be an object' USING ERRCODE = '22023';
      END IF;
      FOR v_key, v_val IN SELECT e.key, e.value FROM jsonb_each(p_payload->'social_links') e LOOP
        IF NOT (v_key = ANY (c_socials)) OR jsonb_typeof(v_val) NOT IN ('string', 'null') THEN
          RAISE EXCEPTION 'org_save_invalid: social link % is not an allowed platform', v_key USING ERRCODE = '22023';
        END IF;
        v_url := NULLIF(btrim(v_val #>> '{}'), '');
        IF v_url IS NOT NULL THEN
          IF v_url !~* c_url_re THEN
            RAISE EXCEPTION 'org_save_invalid: social link % must be an absolute http(s) URL', v_key
              USING ERRCODE = '22023';
          END IF;
          v_socials := v_socials || jsonb_build_object(v_key, v_url);
        END IF;
      END LOOP;
    END IF;
    IF p_payload ? 'services' THEN
      IF jsonb_typeof(p_payload->'services') <> 'array' THEN
        RAISE EXCEPTION 'org_save_invalid: services must be an array' USING ERRCODE = '22023';
      END IF;
      FOR v_item IN SELECT e FROM jsonb_array_elements(p_payload->'services') e LOOP
        IF jsonb_typeof(v_item) <> 'object'
           OR jsonb_typeof(v_item->'name') IS DISTINCT FROM 'string'
           OR btrim(v_item->>'name') = ''
           OR COALESCE(jsonb_typeof(v_item->'description'), 'null') NOT IN ('string', 'null') THEN
          RAISE EXCEPTION 'org_save_invalid: every service needs a string name (description string or null)'
            USING ERRCODE = '22023';
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- hours: each interval is non-zero-length; '24:00' closes only an all-day (00:00) interval;
  -- close < open is an overnight interval.
  IF p_payload ? 'hours' THEN
    IF jsonb_typeof(p_payload->'hours') <> 'array' THEN
      RAISE EXCEPTION 'org_save_invalid: hours must be an array' USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT e FROM jsonb_array_elements(p_payload->'hours') e LOOP
      IF jsonb_typeof(v_item) <> 'object'
         OR jsonb_typeof(v_item->'day_of_week') IS DISTINCT FROM 'number'
         OR (v_item->>'day_of_week') !~ '^[0-6]$'
         OR jsonb_typeof(v_item->'open_time') IS DISTINCT FROM 'string'
         OR jsonb_typeof(v_item->'close_time') IS DISTINCT FROM 'string'
         OR COALESCE(v_item->>'open_time', '') !~ c_open_re
         OR COALESCE(v_item->>'close_time', '') !~ c_close_re THEN
        RAISE EXCEPTION 'org_save_invalid: each hours entry needs day_of_week 0-6, open_time HH:MM, close_time HH:MM'
          USING ERRCODE = '22023';
      END IF;
      v_open  := (v_item->>'open_time')::time;
      v_close := (v_item->>'close_time')::time;
      IF v_open = v_close THEN
        RAISE EXCEPTION 'org_save_invalid: an hours interval cannot open and close at the same time'
          USING ERRCODE = '22023';
      END IF;
      IF v_close = '24:00'::time AND v_open <> '00:00'::time THEN
        RAISE EXCEPTION 'org_save_invalid: close 24:00 is only valid with open 00:00 (open 24 hours)'
          USING ERRCODE = '22023';
      END IF;
      v_key := (v_item->>'day_of_week') || '|' || v_open::text || '|' || v_close::text;
      IF v_key = ANY (v_hour_keys) THEN
        RAISE EXCEPTION 'org_save_invalid: duplicate hours interval (day %, % - %)', v_item->>'day_of_week', v_open, v_close
          USING ERRCODE = '22023';
      END IF;
      v_hour_keys := v_hour_keys || v_key;
    END LOOP;
  END IF;

  -- photos: at most one logo + one cover; every file lives in this org's folder and the url
  -- is exactly the public org-photos URL of that file.
  IF p_payload ? 'photos' THEN
    IF jsonb_typeof(p_payload->'photos') <> 'array' THEN
      RAISE EXCEPTION 'org_save_invalid: photos must be an array' USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT e FROM jsonb_array_elements(p_payload->'photos') e LOOP
      IF jsonb_typeof(v_item) <> 'object'
         OR jsonb_typeof(v_item->'kind') IS DISTINCT FROM 'string'
         OR v_item->>'kind' NOT IN ('logo', 'cover', 'gallery') THEN
        RAISE EXCEPTION 'org_save_invalid: photo kind must be logo, cover or gallery' USING ERRCODE = '22023';
      END IF;
      IF jsonb_typeof(v_item->'storage_path') IS DISTINCT FROM 'string'
         OR jsonb_typeof(v_item->'url') IS DISTINCT FROM 'string'
         OR COALESCE(jsonb_typeof(v_item->'caption'), 'null') NOT IN ('string', 'null') THEN
        RAISE EXCEPTION 'org_save_invalid: photo storage_path and url must be strings (caption string or null)'
          USING ERRCODE = '22023';
      END IF;
      v_path := COALESCE(v_item->>'storage_path', '');
      v_url  := COALESCE(v_item->>'url', '');
      IF v_path !~ v_path_re THEN
        RAISE EXCEPTION 'org_save_invalid: photo storage_path % is not <org_id>/<uuid>.(webp|jpg|png)', v_path
          USING ERRCODE = '22023';
      END IF;
      IF v_url !~ c_photo_url OR regexp_replace(v_url, c_photo_url, '') <> v_path THEN
        RAISE EXCEPTION 'org_save_invalid: photo url must be the public org-photos URL of its storage_path'
          USING ERRCODE = '22023';
      END IF;
      IF v_path = ANY (v_new_paths) THEN
        RAISE EXCEPTION 'org_save_invalid: duplicate photo storage_path %', v_path USING ERRCODE = '22023';
      END IF;
      IF v_item->>'kind' = 'logo'  THEN v_logo_n  := v_logo_n + 1;  END IF;
      IF v_item->>'kind' = 'cover' THEN v_cover_n := v_cover_n + 1; END IF;
      v_new_paths := v_new_paths || v_path;
    END LOOP;
    IF v_logo_n > 1 OR v_cover_n > 1 THEN
      RAISE EXCEPTION 'org_save_invalid: at most one logo and one cover photo' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- resource_ids: ordered; every id is an approved resource.
  IF p_payload ? 'resource_ids' THEN
    IF jsonb_typeof(p_payload->'resource_ids') <> 'array' THEN
      RAISE EXCEPTION 'org_save_invalid: resource_ids must be an array' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_payload->'resource_ids') AS e
               WHERE jsonb_typeof(e) <> 'string' OR (e #>> '{}') !~ c_uuid_re) THEN
      RAISE EXCEPTION 'org_save_invalid: every resource id must be a UUID string' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(array_agg(e::uuid ORDER BY ord), '{}')
      INTO v_resource_ids
      FROM jsonb_array_elements_text(p_payload->'resource_ids') WITH ORDINALITY AS t(e, ord);
    IF cardinality(v_resource_ids) <> (SELECT count(DISTINCT rid) FROM unnest(v_resource_ids) u(rid)) THEN
      RAISE EXCEPTION 'org_save_invalid: duplicate resource id' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(v_resource_ids) u(rid)
               WHERE NOT EXISTS (SELECT 1 FROM public.resources r
                                 WHERE r.id = u.rid AND r.status = 'approved')) THEN
      RAISE EXCEPTION 'org_save_invalid: every linked resource must be an approved resource'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ========================= WRITES (atomic) =========================
  IF v_created THEN
    INSERT INTO public.organizations (
      id, name, org_type, description, website, phone, email, address, city, state, zip_code,
      location, business_category, cost_model, service_radius_miles, attributes, social_links,
      created_by, submitted_by, status, is_active, moderated_by, moderated_at, rejection_reason)
    VALUES (
      p_org_id, v_name, v_org_type,
      NULLIF(btrim(p_payload->>'description'), ''),
      v_website,
      NULLIF(btrim(p_payload->>'phone'), ''),
      v_email,
      NULLIF(btrim(p_payload->>'address'), ''),
      NULLIF(btrim(p_payload->>'city'), ''),
      NULLIF(btrim(p_payload->>'state'), ''),
      NULLIF(btrim(p_payload->>'zip_code'), ''),
      v_location,
      v_category, v_cost,
      CASE WHEN v_is_business AND p_payload ? 'service_radius_miles' THEN v_radius ELSE 10 END,
      v_attrs, v_socials,
      v_actor, NULL, 'approved', true,
      CASE WHEN v_is_business THEN v_actor END,
      CASE WHEN v_is_business THEN now() END,
      NULL);
  ELSE
    UPDATE public.organizations o SET
      name        = v_name,
      org_type    = v_org_type,
      description = CASE WHEN p_payload ? 'description' THEN NULLIF(btrim(p_payload->>'description'), '') ELSE o.description END,
      website     = CASE WHEN p_payload ? 'website'     THEN v_website ELSE o.website END,
      phone       = CASE WHEN p_payload ? 'phone'       THEN NULLIF(btrim(p_payload->>'phone'), '') ELSE o.phone END,
      email       = CASE WHEN p_payload ? 'email'       THEN v_email ELSE o.email END,
      address     = CASE WHEN p_payload ? 'address'     THEN NULLIF(btrim(p_payload->>'address'), '') ELSE o.address END,
      city        = CASE WHEN p_payload ? 'city'        THEN NULLIF(btrim(p_payload->>'city'), '') ELSE o.city END,
      state       = CASE WHEN p_payload ? 'state'       THEN NULLIF(btrim(p_payload->>'state'), '') ELSE o.state END,
      zip_code    = CASE WHEN p_payload ? 'zip_code'    THEN NULLIF(btrim(p_payload->>'zip_code'), '') ELSE o.zip_code END,
      location    = CASE WHEN p_payload ? 'location'    THEN v_location ELSE o.location END,
      business_category    = CASE WHEN v_is_business AND p_payload ? 'business_category'    THEN v_category ELSE o.business_category END,
      cost_model           = CASE WHEN v_is_business AND p_payload ? 'cost_model'           THEN v_cost     ELSE o.cost_model END,
      service_radius_miles = CASE WHEN v_is_business AND p_payload ? 'service_radius_miles' THEN v_radius   ELSE o.service_radius_miles END,
      attributes           = CASE WHEN v_is_business AND p_payload ? 'attributes'           THEN v_attrs    ELSE o.attributes END,
      social_links         = CASE WHEN v_is_business AND p_payload ? 'social_links'         THEN v_socials  ELSE o.social_links END,
      updated_at  = now()
    WHERE o.id = p_org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'org_save_failed: update of organization % affected 0 rows', p_org_id
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_payload ? 'hours' THEN
    DELETE FROM public.business_hours h WHERE h.org_id = p_org_id;
    INSERT INTO public.business_hours (org_id, day_of_week, open_time, close_time)
    SELECT p_org_id, (e->>'day_of_week')::smallint, (e->>'open_time')::time, (e->>'close_time')::time
      FROM jsonb_array_elements(p_payload->'hours') AS e;
  END IF;

  IF p_payload ? 'photos' THEN
    SELECT COALESCE(array_agg(bp.storage_path ORDER BY bp.storage_path), '{}')
      INTO v_removed
      FROM public.business_photos bp
     WHERE bp.org_id = p_org_id
       AND bp.storage_path ~ v_path_re
       AND NOT (bp.storage_path = ANY (v_new_paths));
    DELETE FROM public.business_photos bp WHERE bp.org_id = p_org_id;
    INSERT INTO public.business_photos (org_id, kind, url, storage_path, sort_order, caption)
    SELECT p_org_id, e->>'kind', e->>'url', e->>'storage_path', (ord - 1)::int,
           NULLIF(btrim(e->>'caption'), '')
      FROM jsonb_array_elements(p_payload->'photos') WITH ORDINALITY AS t(e, ord);
  END IF;

  IF p_payload ? 'resource_ids' THEN
    DELETE FROM public.org_resources r WHERE r.org_id = p_org_id;
    INSERT INTO public.org_resources (org_id, resource_id, sort_order)
    SELECT p_org_id, rid, (ord - 1)::int
      FROM unnest(v_resource_ids) WITH ORDINALITY AS t(rid, ord);
  END IF;

  IF v_is_business AND p_payload ? 'services' THEN
    DELETE FROM public.business_services s WHERE s.org_id = p_org_id;
    INSERT INTO public.business_services (org_id, name, description, sort_order)
    SELECT p_org_id, btrim(e->>'name'), NULLIF(btrim(e->>'description'), ''), (ord - 1)::int
      FROM jsonb_array_elements(p_payload->'services') WITH ORDINALITY AS t(e, ord);
  END IF;

  -- ========================= AUDIT (exactly one row) =========================
  SELECT count(*) INTO v_hours_n    FROM public.business_hours    WHERE org_id = p_org_id;
  SELECT count(*) INTO v_photos_n   FROM public.business_photos   WHERE org_id = p_org_id;
  SELECT count(*) INTO v_res_n      FROM public.org_resources     WHERE org_id = p_org_id;
  SELECT count(*) INTO v_services_n FROM public.business_services WHERE org_id = p_org_id;
  SELECT (o.location IS NOT NULL) INTO v_loc_set FROM public.organizations o WHERE o.id = p_org_id;

  PERFORM public.record_admin_action(
    v_actor,
    CASE WHEN v_is_business THEN 'business' ELSE 'org' END
      || CASE WHEN v_created THEN '.create' ELSE '.update' END,
    'organization', p_org_id::text, 'ok', NULL,
    jsonb_build_object('org_type', v_org_type, 'hours_count', v_hours_n, 'photo_count', v_photos_n,
                       'resource_count', v_res_n, 'service_count', v_services_n,
                       'location_set', v_loc_set, 'actor_role', v_role),
    public.request_id());

  RETURN jsonb_build_object('id', p_org_id, 'created', v_created,
                            'removed_photo_paths', to_jsonb(v_removed));
END
$fn$;

-- Supabase default privileges grant EXECUTE to anon + authenticated directly; revoke both
-- PUBLIC and anon, then grant the one intended caller role (the admin gate runs inside).
REVOKE EXECUTE ON FUNCTION public.admin_save_organization(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_organization(uuid, jsonb) TO authenticated;

-- can_manage_org_photos: + an admin of an active, non-business organization, for its folder.
CREATE OR REPLACE FUNCTION public.can_manage_org_photos(p_folder text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) THEN
    RETURN false;
  END IF;
  IF p_folder IS NULL
     OR p_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  IF public.is_current_user_admin() THEN
    RETURN true;
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizations o
              WHERE o.id = p_folder::uuid
                AND o.is_active
                AND o.org_type <> 'business')
     AND public.is_org_admin(p_folder::uuid) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.organizations o
     WHERE o.id = p_folder::uuid
       AND o.org_type = 'business'
       AND o.submitted_by = auth.uid());
END
$fn$;
REVOKE EXECUTE ON FUNCTION public.can_manage_org_photos(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_org_photos(text) TO authenticated;

-- ============================================================================
-- 3e. ranked_feed_v2 — events visible to every viewer iff event active AND org active;
--     events rank with ranking_config.event_half_life_hours. Posts branch text unchanged.
-- ============================================================================
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
    SELECT half_life_hours, distance_decay_km, comment_weight, event_half_life_hours
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
      AND ae.is_active                                     -- event not retired (every viewer alike)
      AND org.is_active                                    -- organization active (every viewer alike)
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
               / cfg.event_half_life_hours )                 -- events' own half-life
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
  'Ranked community feed = W1.3 posts (byte-identical to ranked_feed) UNION ALL one row per event that is active, of an active organization, with its next non-cancelled/not-ended occurrence within 30d (same for every viewer). Single cross-kind keyset on (score DESC, id DESC). Events: engagement=1, age_h=|now-starts_at|, half-life ranking_config.event_half_life_hours, quantized distance bucket (no oracle). 20261020000000.';

-- ============================================================================
-- 5. RLS
-- ============================================================================
-- Event dates are written only by create_org_event / add_event_dates / cancel_event_occurrence /
-- admin_update_event (retire) and the org-deactivation cascade, all SECURITY DEFINER.
DROP POLICY occurrences_admin_insert ON public.event_occurrences;
DROP POLICY occurrences_admin_update ON public.event_occurrences;
DROP POLICY occurrences_admin_delete ON public.event_occurrences;
DROP POLICY occurrences_org_admin_insert ON public.event_occurrences;
DROP POLICY occurrences_org_admin_update ON public.event_occurrences;
DROP POLICY occurrences_org_admin_delete ON public.event_occurrences;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.event_occurrences FROM anon, authenticated;

-- Organization edits by org admins go through admin_save_organization only.
DROP POLICY orgs_update_org_admin ON public.organizations;

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261020000000', 'org_scoped_admin_events');

COMMIT;
