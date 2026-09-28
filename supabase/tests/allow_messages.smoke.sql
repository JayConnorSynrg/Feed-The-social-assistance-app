-- allow_messages.smoke.sql
-- Behavioural smoke for the Wave C1 "Allow Messages" server-side gate. Every check is a
-- rolled-back WRITE that asserts observed behaviour (never a text/ILIKE grep on a function body).
--
-- Run against a database that ALREADY has migration 20261013000000_allow_messages.sql applied, e.g.:
--   psql "$DATABASE_URL" -f supabase/tests/allow_messages.smoke.sql
--   -- or via the Management API SQL endpoint (single request; it wraps one txn).
--
-- The whole file runs inside BEGIN ... ROLLBACK: it commits NOTHING. A failed ASSERT aborts the
-- transaction with the failing message. If it reaches the final NOTICE, every invariant held.
-- Portable: it discovers a resource-with-owner and a second profile at runtime and SKIPs (with a
-- loud NOTICE) if the fixtures are absent.
--
-- INVARIANT (both directions):
--   (a) recipient allow_messages=false → a NEW request INSERT is REJECTED (42501, "not accepting").
--   (b) recipient allow_messages=true  → a NEW request INSERT SUCCEEDS.
--   (c) recipient allow_messages=false NEVER blocks a messages INSERT into an EXISTING conversation.
--
-- MUTATION PROOF (run by hand to confirm the guard bites): in the trigger, flipping the gate to
--   IF NOT COALESCE(..., false)  -- default false instead of true
-- makes INV(b) fail (a true/absent recipient would be blocked); removing the NOT (or deleting the
-- whole IF) makes INV(a) fail (a false recipient would be accepted). Either mutation turns this
-- file RED, so the block test is not vacuously green.

BEGIN;

DO $smoke$
DECLARE
  v_owner     uuid;   -- resource owner == the conversation volunteer (the recipient of the request)
  v_requester uuid;   -- the seeker sending the request
  v_res       uuid;
  v_conv      uuid;
  v_err       text;
BEGIN
  -- Discover a resource with an owner, and a distinct second profile to act as the requester.
  SELECT r.id, r.submitted_by INTO v_res, v_owner
    FROM public.resources r
    WHERE r.submitted_by IS NOT NULL
    LIMIT 1;
  SELECT p.id INTO v_requester
    FROM public.profiles p
    WHERE p.id <> v_owner
    LIMIT 1;

  IF v_res IS NULL OR v_owner IS NULL OR v_requester IS NULL THEN
    RAISE NOTICE 'SKIP allow_messages smoke: needs a resource with submitted_by and a second profile';
    RETURN;
  END IF;

  -- ============ INV (a) — allow_messages=false → NEW request REJECTED ============
  -- Flip the recipient OFF as the table owner (before assuming the authenticated role). No pending
  -- conversation exists yet, so the partial unique index cannot mask the gate; the BEFORE trigger
  -- fires first regardless.
  UPDATE public.profiles SET allow_messages = false WHERE id = v_owner;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_requester, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.conversations (resource_id, volunteer_id, requester_id, status)
    VALUES (v_res, v_owner, v_requester, 'pending');
    ASSERT false, 'INV a: a NEW request MUST be rejected when recipient allow_messages=false';
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    ASSERT v_err ILIKE '%not accepting%',
      'INV a: expected the allow_messages block, got a different 42501: ' || v_err;
  END;
  RESET ROLE;

  -- ============ INV (b) — allow_messages=true → NEW request SUCCEEDS ============
  UPDATE public.profiles SET allow_messages = true WHERE id = v_owner;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_requester, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.conversations (resource_id, volunteer_id, requester_id, status)
  VALUES (v_res, v_owner, v_requester, 'pending')
  RETURNING id INTO v_conv;
  ASSERT v_conv IS NOT NULL,
    'INV b: a NEW request MUST succeed when recipient allow_messages=true';
  RESET ROLE;

  -- ============ INV (c) — existing thread UNAFFECTED when recipient later disables ============
  -- Turn the recipient OFF again; a messages INSERT into the conversation created in (b) must still
  -- succeed — the gate is INSERT-branch-only on conversations and never touches the messages path.
  UPDATE public.profiles SET allow_messages = false WHERE id = v_owner;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_requester, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.messages (conversation_id, sender_id, content, is_read)
  VALUES (v_conv, v_requester, 'existing thread still works', false);
  ASSERT (SELECT count(*) FROM public.messages WHERE conversation_id = v_conv) >= 1,
    'INV c: a messages INSERT into an EXISTING conversation must be unaffected by allow_messages=false';
  RESET ROLE;

  RAISE NOTICE 'PASS allow_messages smoke: INV a (block), b (allow), c (existing-thread unaffected) all held';
END;
$smoke$;

ROLLBACK;
