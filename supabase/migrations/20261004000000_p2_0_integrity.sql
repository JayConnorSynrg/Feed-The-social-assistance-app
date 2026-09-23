-- 20261004000000_p2_0_integrity.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Wave: feed-fullfeed-p2-0-integrity
--
-- Closes the P2.0 integrity holes on the four engagement state tables (I1) and
-- every guest (is_anonymous) write gap (I2). Replay-safe on PG15 (local) and PG17
-- (prod): every statement is idempotent (DROP ... IF EXISTS / CREATE OR REPLACE /
-- guarded policy creation) and uses no PG17-only syntax, so no server_version_num
-- guard is required in this file.
--
-- ============================================================================
-- INVARIANT I1 — every state-bearing column changes only through the entitled path
-- ----------------------------------------------------------------------------
-- table.column            | writer today (verified)                    | entitled setter                          | live gate today (forge)                                    | fix (this file)
-- reviews.reviewee_id     | reviews_update policy (reviewer or admin)  | nobody — server-derived in submit_review | reviews_update WITH CHECK only reviewer_id=uid → reviewer   | make reviews UPDATE admin-only (A)
-- reviews.rating          | reviews_update policy (reviewer or admin)  | nobody — set once in submit_review       |   can UPDATE reviewee_id/rating post-hoc (harmony forge,    | (A)
-- reviews (insert)        | submit_review SECDEF RPC only (no policy)  | submit_review only                       |   reopens PR#50)                                            | unchanged — no client INSERT policy exists
-- resource_opt_ins (INS)  | opt_ins_insert policy (direct) + RPC       | opt_in_to_post RPC only                   | direct INSERT bypasses own-post + capacity checks          | DROP opt_ins_insert (route via RPC) (B)
-- resource_opt_ins.seeker_id/post_id/resource_id | opt_ins_update (post author) | nobody — immutable            | author holds table UPDATE → can repoint counterparty       | REVOKE table UPDATE; GRANT UPDATE(status) only (B)
-- resource_opt_ins.status | opt_ins_update (post author) + feed-panel.tsx:2075 .update({status}) | post author | (kept — legit) | kept: GRANT UPDATE(status) (B)
-- resource_opt_ins (DEL)  | opt_ins_delete (seeker any status) + withdraw_opt_in RPC (pending) | seeker, pending only | seeker can DELETE a completed opt-in | opt_ins_delete → pending-only (B)
-- conversations.volunteer_id/requester_id/resource_id | conversations_update_participants (either party) | nobody — immutable | either party holds table UPDATE → repoint | REVOKE table UPDATE; GRANT UPDATE(status); immutability trigger (C)
-- conversations.status    | conversations_update_participants + use-conversations.ts (.update({status})) | volunteer: active/declined/completed; either: cancelled | either party could set any status | GRANT UPDATE(status) + transition trigger enforces graph+actor (C)
-- event_checkins.checked_in_by | checkins_insert_auth / checkins_update_own (client-supplied) | the caller (= auth.uid()) | client sets checked_in_by=organizer to fake verification | BEFORE INS/UPD trigger forces checked_in_by=auth.uid() (D)
--
-- ============================================================================
-- INVARIANT I2 — a guest (is_anonymous) can write no user-data row anywhere
-- ----------------------------------------------------------------------------
-- Direct-write gaps (permissive policy a guest satisfies + no RESTRICTIVE anon block):
--   poll_votes, event_checkins, favorites, saved_resources, saved_resource_documents,
--   saved_resource_events, saved_resource_tasks, impact_metrics, petitions  → add block (F)
-- SECDEF-writer gaps (no is_anonymous guard): delete_safety_alert, update_safety_alert,
--   withdraw_petition_signature                                             → add guard (E)
-- Service-role route gap: apps/web/src/app/api/petitions/sign/route.ts (checks user,
--   not is_anonymous) — fixed in the route (not this file).
-- Not gaps (verified read-only, kept as-is): reviews (no client INSERT path; UPDATE now
--   admin-only), petition_signatures (no client write policy; service-role route only),
--   conversations/messages/resource_opt_ins/resources/posts/... already carry the
--   INSERT block; own-scoped UPDATE/DELETE on already-INSERT-blocked tables are
--   unreachable (a guest holds no row to touch). Admin/org/service functions are
--   guest-safe via their own admin/service checks (verified live).
-- ============================================================================

BEGIN;

-- ── A. reviews — close the reviewee_id / rating UPDATE forge ─────────────────
-- Reviews are created only by submit_review (SECDEF, server-derives reviewer_id +
-- reviewee_id from participation). No UI edits a review. The reviewer keeps the
-- right to withdraw (reviews_delete, unchanged). Restrict UPDATE to admins only so
-- the reviewer can no longer repoint reviewee_id or alter rating after the fact.
DROP POLICY IF EXISTS reviews_update ON public.reviews;
CREATE POLICY reviews_update ON public.reviews
  FOR UPDATE TO authenticated
  USING ((SELECT is_current_user_admin()))
  WITH CHECK ((SELECT is_current_user_admin()));

-- ── B. resource_opt_ins ──────────────────────────────────────────────────────
-- B1. Remove the direct client INSERT path. Opt-ins must go through opt_in_to_post
--     (SECDEF: anon guard + own-post + capacity + slot lock). The RPC inserts as its
--     owner (bypasses RLS), so dropping this policy does not affect the RPC.
DROP POLICY IF EXISTS opt_ins_insert ON public.resource_opt_ins;

-- B2. Column-lock UPDATE to `status` only. A table-level GRANT makes a column-level
--     REVOKE a no-op, so revoke UPDATE at table level first, then grant the single
--     entitled column. This locks seeker_id/post_id/resource_id against the post
--     author's repoint forge while the author's status transitions keep working.
--     (The trg_resource_opt_ins_completed_at trigger runs as the table owner and
--     still stamps completed_at regardless of the caller's column grant.)
REVOKE UPDATE ON public.resource_opt_ins FROM anon, authenticated;
GRANT  UPDATE (status) ON public.resource_opt_ins TO authenticated;

-- B3. Tighten DELETE to pending-only for the seeker (mirrors withdraw_opt_in), so a
--     seeker can no longer erase a completed/accepted (peer-verified) opt-in directly.
DROP POLICY IF EXISTS opt_ins_delete ON public.resource_opt_ins;
CREATE POLICY opt_ins_delete ON public.resource_opt_ins
  FOR DELETE TO authenticated
  USING (
    (seeker_id = auth.uid() AND status = 'pending')
    OR (SELECT is_current_user_admin())
  );

-- ── C. conversations ─────────────────────────────────────────────────────────
-- C1. Column-lock UPDATE to `status` only (locks volunteer_id/requester_id/resource_id).
REVOKE UPDATE ON public.conversations FROM anon, authenticated;
GRANT  UPDATE (status) ON public.conversations TO authenticated;

-- C2. Enforce the status state machine and the entitled actor per transition. Also
--     re-asserts participant/resource immutability (defense-in-depth beyond the column
--     grant; also covers any future service_role path). auth.uid() actor rules apply
--     only to real user calls; a service/null caller (admin tooling) is trusted for
--     the actor check but still bound by the transition graph + immutability.
CREATE OR REPLACE FUNCTION public.enforce_conversation_transition()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Participants and the anchoring resource are immutable.
  IF NEW.volunteer_id IS DISTINCT FROM OLD.volunteer_id
     OR NEW.requester_id IS DISTINCT FROM OLD.requester_id
     OR NEW.resource_id  IS DISTINCT FROM OLD.resource_id THEN
    RAISE EXCEPTION 'conversation participants and resource are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Allowed transition graph.
    IF NOT (
      (OLD.status = 'pending' AND NEW.status IN ('active','declined','cancelled'))
      OR (OLD.status = 'active'  AND NEW.status IN ('completed','cancelled'))
    ) THEN
      RAISE EXCEPTION 'invalid conversation status transition % -> %', OLD.status, NEW.status
        USING ERRCODE = '22023';
    END IF;

    -- Entitled actor (only for real user calls).
    IF v_uid IS NOT NULL THEN
      -- Accept / decline / complete is the volunteer's (recipient's) prerogative.
      IF NEW.status IN ('active','declined','completed') AND v_uid <> OLD.volunteer_id THEN
        RAISE EXCEPTION 'only the volunteer may accept, decline, or complete this conversation'
          USING ERRCODE = '42501';
      END IF;
      -- Cancellation may be done by either participant.
      IF NEW.status = 'cancelled' AND v_uid NOT IN (OLD.volunteer_id, OLD.requester_id) THEN
        RAISE EXCEPTION 'only a participant may cancel this conversation'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_conversations_transition ON public.conversations;
CREATE TRIGGER trg_conversations_transition
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_conversation_transition();

-- ── D. event_checkins — force checked_in_by = the caller ─────────────────────
-- checked_in_by is the attestation of WHO recorded the check-in. It must be the
-- caller, never a client-supplied value (else a self check-in can forge an organizer
-- verification). Both legit flows already send the caller's own id, so forcing it
-- server-side is transparent to them and closes the forge.
CREATE OR REPLACE FUNCTION public.event_checkins_force_checked_in_by()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  NEW.checked_in_by := auth.uid();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_event_checkins_force_checked_in_by ON public.event_checkins;
CREATE TRIGGER trg_event_checkins_force_checked_in_by
  BEFORE INSERT OR UPDATE ON public.event_checkins
  FOR EACH ROW EXECUTE FUNCTION public.event_checkins_force_checked_in_by();

-- ── E. SECDEF guest guards ───────────────────────────────────────────────────
-- These SECDEF writers are owner-scoped (created_by / signer_id = auth.uid()) with no
-- is_anonymous guard. A guest is read-only, so add the guard. The check reads
-- auth.users.is_anonymous by id (robust for any invocation path — the JWT claim is
-- not guaranteed present in every SECDEF/service context). Bodies, search_path, and
-- grants are otherwise preserved verbatim from live.

CREATE OR REPLACE FUNCTION public.delete_safety_alert(p_alert_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $fn$
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Guest guard: anonymous users are read-only
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND is_anonymous IS TRUE) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501';
  END IF;

  -- Ownership guard
  IF auth.uid() <> (SELECT created_by FROM safety_alerts WHERE id = p_alert_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM safety_alerts WHERE id = p_alert_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.update_safety_alert(
  p_alert_id uuid, p_type text, p_severity integer, p_description text,
  p_lng double precision, p_lat double precision)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $fn$
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Guest guard: anonymous users are read-only
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND is_anonymous IS TRUE) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501';
  END IF;

  -- Ownership guard
  IF auth.uid() <> (SELECT created_by FROM safety_alerts WHERE id = p_alert_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Validate alert_type
  IF p_type NOT IN ('weather', 'road_closure', 'speeding', 'general') THEN
    RAISE EXCEPTION 'invalid alert_type: %', p_type;
  END IF;

  -- Validate severity
  IF p_severity < 1 OR p_severity > 4 THEN
    RAISE EXCEPTION 'severity must be between 1 and 4';
  END IF;

  -- Apply update
  UPDATE safety_alerts
  SET
    alert_type  = p_type,
    severity    = p_severity,
    description = p_description,
    location    = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  WHERE id = p_alert_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.withdraw_petition_signature(p_petition_id uuid)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_exported_at timestamptz;
  v_new_count   integer;
BEGIN
  -- Guest guard: anonymous users are read-only
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND is_anonymous IS TRUE) THEN
    RAISE EXCEPTION 'Account required for this action' USING ERRCODE = '42501';
  END IF;

  SELECT exported_at INTO v_exported_at
  FROM public.petitions
  WHERE id = p_petition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'petition not found';
  END IF;

  IF v_exported_at IS NOT NULL THEN
    RAISE EXCEPTION 'petition signatures are locked (exported)';
  END IF;

  -- Ownership enforced in the DELETE predicate via auth.uid().
  DELETE FROM public.petition_signatures
  WHERE petition_id = p_petition_id
    AND signer_id = auth.uid();

  SELECT count(*)::integer INTO v_new_count
  FROM public.petition_signatures
  WHERE petition_id = p_petition_id;

  RETURN v_new_count;
END;
$fn$;

-- Re-assert least-privilege EXECUTE grants on the three recreated SECDEF functions.
-- (CREATE OR REPLACE preserves existing grants, but restate them so the file is
--  self-contained and correct on a fresh replay.)
REVOKE EXECUTE ON FUNCTION public.delete_safety_alert(uuid)             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_safety_alert(uuid, text, integer, text, double precision, double precision) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.withdraw_petition_signature(uuid)     FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_safety_alert(uuid)             TO authenticated;
GRANT  EXECUTE ON FUNCTION public.update_safety_alert(uuid, text, integer, text, double precision, double precision) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.withdraw_petition_signature(uuid)     TO authenticated;

-- ── F. I2 guest RESTRICTIVE INSERT blocks ────────────────────────────────────
-- Mirror the existing posts_block_anon_* pattern: a RESTRICTIVE policy on the
-- authenticated role (guests run as authenticated) whose WITH CHECK is false when the
-- JWT is_anonymous claim is set. RESTRICTIVE policies AND with the permissive policy,
-- so a guest INSERT is blocked while a normal authenticated INSERT is unaffected.
-- INSERT is the operative gate for these own-scoped tables: a guest cannot obtain a
-- row, so the own-scoped UPDATE/DELETE paths are unreachable without it.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'poll_votes', 'event_checkins', 'favorites', 'saved_resources',
    'saved_resource_documents', 'saved_resource_events', 'saved_resource_tasks',
    'impact_metrics', 'petitions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_block_anon_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated '
      || 'WITH CHECK (COALESCE((SELECT (auth.jwt() ->> ''is_anonymous'')::boolean), false) IS NOT TRUE)',
      t || '_block_anon_insert', t
    );
  END LOOP;
END $$;

COMMIT;
