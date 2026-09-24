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
--   I8  Anonymous check-ins are unlinkable + capped, event writes are RPC-only, org-admin
--       roster writes are platform-admin-only, and org admins can reach the events surface:
--       - R7 (finding #2): an anonymous row carries NO member identity — user_id,
--         checked_in_by (P2.0 force trigger leaves NULL for user_id-NULL rows) and
--         confirmed_by are all NULL. The member↔occurrence link lives only in the private,
--         server-only event_anonymous_claims table (RLS on, no policies, all grants revoked).
--       - finding #7: at most ONE anonymous check-in per (member, occurrence), enforced by
--         that table's PK; finding #8: an anonymous check-in is refused when the member
--         already holds a tracked row for the occurrence (so an early row never silently
--         decays into a no-show).
--       - finding #1/#5: organizer_confirm acts ONLY on an attendee with an existing row
--         (no INSERT for arbitrary ids → no FK/existence oracle; a real never-checked-in
--         user and a random UUID hit the same uniform error), never the caller themselves,
--         only within [starts_at−30m, ends_at+24h] on a live, active, non-cancelled
--         occurrence; event_attendance returns only client-readable identity (first_name,
--         avatar_url — never full_name) and treats status='completed' as ended.
--       - finding #6: assistance_events location/address is written ONLY through
--         admin_create_event / admin_update_event (direct client writes + write policies
--         revoked); the RPCs reject null-island / out-of-range coords and unknown tiers.
--         Trust boundary: organizers remain trusted to STATE a real venue; the server
--         refuses only physically impossible inputs.
--       - finding #3 (R1): only platform admins grant/change/remove org memberships.
--       - finding #4: a non-platform-admin org admin reaches an events-only admin surface
--         (is_org_admin_any gate; get_admin_org_list returns only their admin orgs).
--       - finding #8: check_in rejects inactive events/orgs and treats completed as ended.
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

-- event_anonymous_claims (R7 / finding #7): a PRIVATE, server-only record that a given
-- member has spent their one anonymous check-in on an occurrence. It exists ONLY to cap a
-- member at one anonymous check-in per occurrence WITHOUT storing the member's identity on
-- the anonymous event_checkins row itself (which stays fully unlinkable — user_id,
-- checked_in_by, confirmed_by all NULL). No client — not even an org admin — can read or
-- write this table: RLS is enabled with NO policies and ALL privileges are revoked, so the
-- only code that ever touches it is the SECDEF check_in RPC (running as the table owner).
-- The (occurrence,user) PK is the once-per-member enforcement. The link lives here, out of
-- every client's reach; the public count in event_checkins carries no member identity.
CREATE TABLE IF NOT EXISTS public.event_anonymous_claims (
  occurrence_id uuid NOT NULL REFERENCES public.event_occurrences(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id)              ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occurrence_id, user_id)
);
ALTER TABLE public.event_anonymous_claims ENABLE ROW LEVEL SECURITY;
-- No policies -> RLS denies every client SELECT/write. Belt-and-braces: revoke the default
-- table grants Supabase hands anon/authenticated so even a role with RLS bypass intent has
-- no privilege. Only the table owner (SECDEF functions) can read/write it.
REVOKE ALL ON public.event_anonymous_claims FROM anon, authenticated, PUBLIC;

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
-- 2b. R7 finding #2 — an anonymous row carries NO member identity
-- ============================================================================
-- The P2.0 force trigger stamps checked_in_by = auth.uid() on INSERT to stop a self
-- check-in forging an organizer verification. For an ANONYMOUS check-in (user_id NULL)
-- there is no member to protect and R7 requires the row be unlinkable to the member by
-- anyone but the server — so for that EXACT case the trigger leaves checked_in_by NULL.
-- Everywhere else (identified rows) the forge protection is byte-for-byte the P2.0 logic
-- (INSERT forces the caller; UPDATE reverts any client change, allowing only the FK
-- ON DELETE SET NULL cascade). The function still references auth.uid() (smoke 25's
-- checkins_fn_uses_uid) and the trigger still fires BEFORE INSERT OR UPDATE (smoke 25's
-- checkins_force_trg). The RPCs below additionally set confirmed_by = NULL on anonymous
-- rows, so an anonymous check-in stores no direct or derivable member reference.
CREATE OR REPLACE FUNCTION public.event_checkins_force_checked_in_by()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Identified check-in: the attestor is always the caller. Anonymous check-in
    -- (user_id NULL): no attestor is stored (R7 unlinkability).
    IF NEW.user_id IS NULL THEN
      NEW.checked_in_by := NULL;
    ELSE
      NEW.checked_in_by := auth.uid();
    END IF;
  ELSE
    -- UPDATE: never let a client change the attestor. A NULL is accepted ONLY when it
    -- originates from the FK ON DELETE SET NULL cascade — i.e. there is no session
    -- (auth.uid() IS NULL) or we are running inside another statement's trigger depth
    -- (pg_trigger_depth() > 1). Any other change is reverted to OLD.checked_in_by.
    IF NEW.checked_in_by IS DISTINCT FROM OLD.checked_in_by THEN
      IF NEW.checked_in_by IS NULL AND (auth.uid() IS NULL OR pg_trigger_depth() > 1) THEN
        NULL;  -- FK cascade → allow the NULL through unchanged
      ELSE
        NEW.checked_in_by := OLD.checked_in_by;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
-- Trigger definition is unchanged (already BEFORE INSERT OR UPDATE from P2.0); recreating
-- the function alone is sufficient.

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
  v_ev_active  boolean;
  v_org_active boolean;
BEGIN
  -- R8: only a real (non-guest) signed-in user may check in.
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to check in.' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid AND is_anonymous IS TRUE) THEN
    RAISE EXCEPTION 'Create a free account to check in.' USING ERRCODE='42501';
  END IF;
  IF p_household_size IS NULL OR p_household_size < 1 OR p_household_size > 20 THEN
    RAISE EXCEPTION 'Household size must be between 1 and 20.' USING ERRCODE='22003';
  END IF;

  SELECT eo.starts_at, eo.ends_at, eo.status, ae.is_active, o.is_active
    INTO v_starts, v_ends, v_status, v_ev_active, v_org_active
    FROM public.event_occurrences eo
    JOIN public.assistance_events ae ON ae.id = eo.event_id
    JOIN public.organizations o ON o.id = ae.org_id
   WHERE eo.id = p_occurrence;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found.' USING ERRCODE='P0002'; END IF;

  -- Finding #8: an inactive event or org accepts no check-ins.
  IF v_ev_active IS NOT TRUE OR v_org_active IS NOT TRUE THEN
    RAISE EXCEPTION 'This event is not currently active.' USING ERRCODE='P0001';
  END IF;

  IF v_status = 'cancelled' THEN RAISE EXCEPTION 'This event was cancelled.' USING ERRCODE='P0001'; END IF;
  IF v_status = 'completed' OR v_now > v_ends THEN
    RAISE EXCEPTION 'This event has ended.' USING ERRCODE='P0001';
  END IF;

  v_window_open := v_starts - interval '30 minutes';

  -- R7: anonymous check-in is untracked (user_id NULL) and only meaningful as presence,
  -- so it opens with the window (30 min before start). The row carries NO member identity
  -- (user_id / confirmed_by NULL here; checked_in_by forced NULL by the P2.0 trigger) and
  -- earns no credit. Finding #7: at most ONE anonymous check-in per member per occurrence,
  -- enforced by the private event_anonymous_claims PK (unreadable by any client). Finding
  -- #8: an anonymous check-in must not sit on top of the member's own tracked row (which
  -- would leave that early row to decay into a no-show) — disallow with a clear message.
  IF p_anonymous THEN
    IF v_now < v_window_open THEN
      RAISE EXCEPTION 'Anonymous check-in opens 30 minutes before the event starts.' USING ERRCODE='P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.event_checkins
                WHERE occurrence_id = p_occurrence AND user_id = v_uid) THEN
      RAISE EXCEPTION 'You already have a check-in for this event; you cannot also check in anonymously.'
        USING ERRCODE='P0001';
    END IF;
    -- Reserve this member's single anonymous slot (private; no client can read the link).
    BEGIN
      INSERT INTO public.event_anonymous_claims (occurrence_id, user_id)
      VALUES (p_occurrence, v_uid);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'You are already counted anonymously for this event.' USING ERRCODE='P0001';
    END;
    INSERT INTO public.event_checkins
      (occurrence_id, user_id, household_size, status, confirmed_at, confirmed_by)
    VALUES (p_occurrence, NULL, p_household_size, 'confirmed', v_now, NULL);
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
  v_starts timestamptz;
  v_ends  timestamptz;
  v_status text;
  v_ev_active  boolean;
  v_org_active boolean;
  v_now   timestamptz := now();
  v_existing_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in to confirm attendance.' USING ERRCODE='42501'; END IF;
  IF p_household_size IS NULL OR p_household_size < 1 OR p_household_size > 20 THEN
    RAISE EXCEPTION 'Household size must be between 1 and 20.' USING ERRCODE='22003';
  END IF;

  SELECT ae.org_id, eo.starts_at, eo.ends_at, eo.status, ae.is_active, o.is_active
    INTO v_org, v_starts, v_ends, v_status, v_ev_active, v_org_active
    FROM public.event_occurrences eo
    JOIN public.assistance_events ae ON ae.id = eo.event_id
    JOIN public.organizations o ON o.id = ae.org_id
   WHERE eo.id = p_occurrence;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found.' USING ERRCODE='P0002'; END IF;

  -- I3: only an org admin of this event's org (or a platform admin) may run the kiosk.
  IF NOT (public.is_current_user_admin() OR public.is_org_admin(v_org)) THEN
    RAISE EXCEPTION 'Only an organizer of this event may confirm attendance.' USING ERRCODE='42501';
  END IF;

  -- Finding #5: the occurrence must be a live, non-cancelled occurrence of an active
  -- event + org, and confirmation is bounded to [starts_at - 30m, ends_at + 24h] — early
  -- enough to catch the doors-open rush, late enough for a busy kiosk to catch up, never
  -- days ahead of the event.
  IF v_status = 'cancelled' THEN RAISE EXCEPTION 'This event was cancelled.' USING ERRCODE='P0001'; END IF;
  IF v_ev_active IS NOT TRUE OR v_org_active IS NOT TRUE THEN
    RAISE EXCEPTION 'This event is not currently active.' USING ERRCODE='P0001';
  END IF;
  IF v_now < v_starts - interval '30 minutes' THEN
    RAISE EXCEPTION 'Attendance confirmation opens 30 minutes before the event starts.' USING ERRCODE='P0001';
  END IF;
  IF v_now > v_ends + interval '24 hours' THEN
    RAISE EXCEPTION 'The confirmation window for this event has closed.' USING ERRCODE='P0001';
  END IF;

  -- Finding #1/#5: the organizer never confirms themselves — they check in like any other
  -- attendee through check_in.
  IF p_user = v_uid THEN
    RAISE EXCEPTION 'Use your own check-in to record your attendance.' USING ERRCODE='42501';
  END IF;

  -- Anonymous household added by the organizer (never the organizer as attendee). The row
  -- carries no attendee/attestor identity (user_id / confirmed_by NULL; checked_in_by
  -- forced NULL by the P2.0 trigger). Organizer walk-in adds are trusted, so multiple are
  -- allowed and the per-member anonymous cap does not apply here.
  IF p_user IS NULL THEN
    INSERT INTO public.event_checkins
      (occurrence_id, user_id, household_size, status, confirmed_at, confirmed_by)
    VALUES (p_occurrence, NULL, p_household_size, 'confirmed', v_now, NULL);
    RETURN 'confirmed_anonymous';
  END IF;

  -- Finding #1: an organizer may ONLY act on an attendee who has already checked in for
  -- this occurrence — never mint a row for an arbitrary user. The lookup runs BEFORE any
  -- reference to auth.users, so a real member who never checked in and a random/nonexistent
  -- UUID both hit the SAME uniform error (no FK / existence oracle). No INSERT on the
  -- identified path, so the FK-violation oracle is gone.
  SELECT status INTO v_existing_status
    FROM public.event_checkins
   WHERE occurrence_id = p_occurrence AND user_id = p_user;

  IF v_existing_status IS NULL THEN
    RAISE EXCEPTION 'That attendee has not checked in for this event.' USING ERRCODE='P0002';
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
     AND (eo.status = 'completed' OR eo.ends_at < now());  -- "ended" = completed OR past ends_at
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

  -- "ended" is consistent with check_in: a completed occurrence counts as ended even if
  -- ends_at is still in the future (finding #8).
  v_ended := (v_status <> 'cancelled' AND (v_status = 'completed' OR v_ends < now()));

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

  -- Finding #1: return ONLY identity fields an authenticated client can already read
  -- (first_name, avatar_url) — never full_name, which is column-private to clients. The
  -- organizer sees who attended without this SECDEF path leaking a field they could not
  -- otherwise read.
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'user_id',        ec.user_id,
             'name',           COALESCE(NULLIF(btrim(pr.first_name), ''), 'Member'),
             'avatar_url',     pr.avatar_url,
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
     AND (eo.status = 'completed' OR eo.ends_at < now());  -- "ended" = completed OR past ends_at
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

-- Shared input validator (I5 finding #6): rejects impossible coordinates and unknown tiers.
-- Not client-executable — called only from admin_create_event / admin_update_event (SECDEF).
CREATE OR REPLACE FUNCTION public.w1_6a_validate_geo(
  p_lat double precision, p_lng double precision, p_accuracy text)
  RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF p_lat IS NOT NULL OR p_lng IS NOT NULL THEN
    IF p_lat IS NULL OR p_lng IS NULL
       OR p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180
       OR (p_lat = 0 AND p_lng = 0) THEN
      RAISE EXCEPTION 'Event coordinates are out of range or point to null island.'
        USING ERRCODE='22023';
    END IF;
  END IF;
  IF p_accuracy IS NOT NULL AND p_accuracy NOT IN
     ('rooftop','parcel','point','interpolated','approximate','intersection','street','unlocated') THEN
    RAISE EXCEPTION 'Unknown geocode tier: %', p_accuracy USING ERRCODE='22023';
  END IF;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.w1_6a_validate_geo(double precision,double precision,text) FROM PUBLIC, anon, authenticated;

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

  -- I5 finding #6: the RPC is the ONLY writer of location/address fields (direct client
  -- writes to assistance_events are revoked below), and it refuses physically impossible
  -- inputs — coordinates at null island (0,0) or out of range, and unknown geocode tiers.
  -- Organizers remain TRUSTED to state a real venue; the server rejects only inputs that
  -- cannot describe any real place (trust boundary documented in the spec).
  PERFORM public.w1_6a_validate_geo(p_lat, p_lng, p_geocode_accuracy);

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

  -- Validate coordinates/tier only when a re-geocode is being applied (address changed).
  IF p_regeocode THEN
    PERFORM public.w1_6a_validate_geo(p_lat, p_lng, p_geocode_accuracy);
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

-- ============================================================================
-- 8. I5 finding #6 — assistance_events location/address is RPC-only
-- ============================================================================
-- Close the direct-PostgREST bypass: an org admin (or platform admin) could UPDATE
-- assistance_events directly (events_update_org_admin / events_admin_*), writing any
-- location/tier the client chose and skipping the RPC's coordinate validation. Every
-- write now goes through admin_create_event / admin_update_event (SECDEF, owner-run, so
-- they are unaffected by these revocations). The only in-app writer is the scheduler,
-- which already creates via admin_create_event and (this wave) edits via admin_update_event
-- — no direct client write remains. SELECT policies (events_select_active / admin_select)
-- and event_occurrences writes (occurrences_org_admin_* — the scheduler adds occurrences
-- directly, no location on that table) are untouched.
DROP POLICY IF EXISTS events_insert_org_admin ON public.assistance_events;
DROP POLICY IF EXISTS events_update_org_admin ON public.assistance_events;
DROP POLICY IF EXISTS events_admin_insert     ON public.assistance_events;
DROP POLICY IF EXISTS events_admin_update     ON public.assistance_events;
DROP POLICY IF EXISTS events_admin_delete     ON public.assistance_events;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.assistance_events FROM anon, authenticated;

-- ============================================================================
-- 9. R1 finding #3 — only platform admins grant/change/remove org memberships
-- ============================================================================
-- Live policy let ANY org admin insert/update/delete organization_members with any role,
-- so an org admin could mint another org admin (privilege escalation past R1: "only
-- platform admins assign org admins"). Non-admin membership carries no powers of its own
-- (role gates nothing but is_org_member's own-org visibility), so the simplest correct
-- rule is: all membership WRITES are platform-admin-only. Org admins keep every event
-- capability (scheduling, kiosk, attendance) but cannot touch the roster. SELECT
-- (own-or-org visibility) is unchanged.
DROP POLICY IF EXISTS org_members_insert_admin ON public.organization_members;
DROP POLICY IF EXISTS org_members_update_admin ON public.organization_members;
DROP POLICY IF EXISTS org_members_delete_admin ON public.organization_members;

CREATE POLICY org_members_insert_platform_admin ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY org_members_update_platform_admin ON public.organization_members
  FOR UPDATE TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY org_members_delete_platform_admin ON public.organization_members
  FOR DELETE TO authenticated
  USING (public.is_current_user_admin());

-- ============================================================================
-- 10. Finding #4 — org-admin reachability of the admin surface (events only)
-- ============================================================================
-- is_org_admin_any(): a boolean the SPA uses to reveal the admin entry + route guard for
-- a non-platform-admin who administers at least one org. SECDEF (reads memberships across
-- rows), granted to authenticated only.
CREATE OR REPLACE FUNCTION public.is_org_admin_any()
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
     WHERE user_id = auth.uid() AND role = 'admin');
$fn$;
REVOKE EXECUTE ON FUNCTION public.is_org_admin_any() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_org_admin_any() TO authenticated;

-- get_admin_org_list: for a non-platform-admin, return ONLY orgs where the caller is an
-- ADMIN (was: any membership). The scheduler's org selector then offers exactly the orgs
-- an org admin may create/edit events for — matching admin_create_event's is_org_admin
-- gate. Platform-admin path (all active orgs) is unchanged.
CREATE OR REPLACE FUNCTION public.get_admin_org_list()
RETURNS TABLE (id uuid, name text, org_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF (SELECT is_admin FROM public.profiles WHERE profiles.id = auth.uid()) THEN
    RETURN QUERY
      SELECT o.id, o.name, o.org_type
      FROM public.organizations o
      WHERE o.is_active = true
      ORDER BY o.name;
  ELSE
    RETURN QUERY
      SELECT o.id, o.name, o.org_type
      FROM public.organizations o
      JOIN public.organization_members om ON om.org_id = o.id
      WHERE om.user_id = auth.uid() AND om.role = 'admin' AND o.is_active = true
      ORDER BY o.name;
  END IF;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.get_admin_org_list() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_org_list() TO authenticated;

COMMIT;
