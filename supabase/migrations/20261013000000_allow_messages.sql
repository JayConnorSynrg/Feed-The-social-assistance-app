-- 20261013000000_allow_messages.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
--
-- Wave C1 — server-side enforcement of the "Allow Messages" privacy preference.
--
-- INVARIANT (both directions):
--   A NEW conversation-request INSERT into public.conversations succeeds IF AND ONLY IF the
--   recipient's profiles.allow_messages is true (NULL/absent treated as true).
--     (a) allow_messages=false on the recipient  → a NEW request INSERT is rejected server-side.
--     (b) allow_messages=true/NULL               → a NEW request INSERT proceeds exactly as today.
--     (c) allow_messages=false NEVER blocks/severs an EXISTING conversation or any messages INSERT.
--         The gate lives ONLY in the INSERT branch of the conversations transition trigger, so the
--         messages path (a separate table) is provably untouched in both directions.
--     (d) The owner reads/toggles their OWN allow_messages; no OTHER user gains any read of it.
--
-- GRANT MODEL DECISION (invariant d) — grounded in the LIVE schema, verified this session:
--   * public.profiles uses COLUMN-LEVEL grants (no table-level SELECT to `authenticated`).
--   * profiles has a cross-user SELECT RLS policy: "Users can view other profiles via RLS"
--       USING ((auth.uid() IS NOT NULL) AND (auth.uid() <> id)).
--   => A role-wide GRANT SELECT(allow_messages) TO authenticated would be readable across that
--      cross-user policy, exposing every user's flag to every other user. So we grant UPDATE ONLY
--      (the "Users can update own profile" policy, WITH CHECK auth.uid()=id, restricts it to the
--      owner's own row) and grant NO column SELECT. The owner reads their own value through the
--      SECURITY DEFINER get_my_allow_messages() accessor, which filters to auth.uid() internally,
--      so no other user can read the flag by any path.

-- ── 1. Column ────────────────────────────────────────────────────────────────
-- NOT NULL DEFAULT true so every existing and future profile accepts messages until the owner
-- turns it off (default-ON matches the COALESCE(...,true) gate below; invariant b for absent).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allow_messages boolean NOT NULL DEFAULT true;

-- ── 2. Grant: UPDATE only (write path), NO SELECT (invariant d) ───────────────
-- The owner's toggle write goes through .update({allow_messages}).eq('id', auth.uid()); the
-- "Users can update own profile" UPDATE policy restricts the affected row to the owner. No SELECT
-- grant is issued (see GRANT MODEL DECISION) — the owner's own read is served by the accessor below.
GRANT UPDATE(allow_messages) ON public.profiles TO authenticated;

-- ── 3. Owner self-read accessor (SECURITY DEFINER; filters to auth.uid()) ─────
-- Returns ONLY the caller's own flag (default true when absent). Because it filters on auth.uid()
-- internally, EXECUTE-granting it to authenticated cannot leak another user's value.
CREATE OR REPLACE FUNCTION public.get_my_allow_messages()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT allow_messages FROM public.profiles WHERE id = auth.uid()), true);
$$;

REVOKE ALL ON FUNCTION public.get_my_allow_messages() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_allow_messages() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_allow_messages() TO authenticated;

-- ── 4. enforce_conversation_transition() — add the allow_messages gate ────────
-- The body below is copied VERBATIM from the live function (originally authored in
-- 20261004000000_p2_0_integrity.sql), with exactly two changes:
--   (1) SECURITY DEFINER added, and
--   (2) the allow_messages gate appended inside the INSERT branch after the existing
--       volunteer-ownership and self-request checks.
--
-- WHY SECURITY DEFINER (was SECURITY INVOKER):
--   The gate reads the recipient's allow_messages. Because profiles uses column-level grants and
--   NO SELECT(allow_messages) is granted to `authenticated` (invariant d), an INVOKER trigger
--   running as the inserting user could not read the column — every request would fail. DEFINER
--   runs as the function owner (which owns the column and can read it). This exposes NO read
--   surface: a trigger function cannot be invoked directly (Postgres rejects a plain CALL/SELECT of
--   a trigger function), and EXECUTE is revoked from PUBLIC/anon as defense-in-depth. The
--   search_path stays pinned (SET search_path = public, pg_temp). Every pre-existing check is
--   preserved byte-for-byte; auth.uid() (a JWT claim) and the public resources read behave
--   identically under the DEFINER context.
CREATE OR REPLACE FUNCTION public.enforce_conversation_transition()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid   uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_uid IS NOT NULL THEN
      IF NEW.status <> 'pending' THEN
        RAISE EXCEPTION 'a new conversation must start as pending'
          USING ERRCODE = '22023';
      END IF;
      SELECT submitted_by INTO v_owner FROM public.resources WHERE id = NEW.resource_id;
      IF NEW.volunteer_id IS DISTINCT FROM v_owner THEN
        RAISE EXCEPTION 'the volunteer must be the owner of the requested resource'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.requester_id = NEW.volunteer_id THEN
        RAISE EXCEPTION 'you cannot request your own resource'
          USING ERRCODE = '42501';
      END IF;
      -- Wave C1: the recipient's "Allow Messages" preference gates NEW requests only.
      -- COALESCE(...,true) so a NULL/absent flag never blocks (invariant b). This check lives
      -- exclusively in the INSERT branch, so existing conversations and every messages INSERT
      -- are untouched (invariant c). Read as DEFINER (see WHY SECURITY DEFINER above).
      IF NOT COALESCE((SELECT allow_messages FROM public.profiles WHERE id = NEW.volunteer_id), true) THEN
        RAISE EXCEPTION 'Recipient is not accepting new messages'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: participants and the anchoring resource are immutable.
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

-- Defense-in-depth: a trigger function is not directly callable, but revoke the ambient PUBLIC
-- EXECUTE anyway (mirrors the SECDEF hardening pattern used across the Wave B producers).
REVOKE ALL ON FUNCTION public.enforce_conversation_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_conversation_transition() FROM anon;

-- The trigger binding (trg_conversations_transition, BEFORE INSERT OR UPDATE) is unchanged;
-- CREATE OR REPLACE FUNCTION keeps the existing trigger attached.
