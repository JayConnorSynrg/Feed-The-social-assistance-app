-- ============================================================================
-- Profiles name-privacy lockdown — EXPAND half (audit hole #9)
-- ----------------------------------------------------------------------------
-- Privacy model (user-confirmed):
--   1. FIRST NAME is always public + immutable — shows on every cross-user /
--      anon surface. Granted SELECT to anon + authenticated. NOT grantable for
--      UPDATE (immutable post-signup).
--   2. LAST NAME (surname) is private. It reveals ONLY inside a conversation,
--      ASYMMETRICALLY: the SEEKER's (conversations.requester_id) full name
--      reveals to the SOURCER (conversations.volunteer_id). The sourcer stays
--      first-name-only to the seeker. Enforced inside the SECDEF accessor
--      get_my_conversation_counterparties() — last_name is NEVER granted to
--      anon/authenticated as a direct column.
--   3. CITY/STATE stay fully private (self-only) on every surface — read only
--      through get_my_profile(). (The CONTRACT revoke that closes the existing
--      anon/authenticated SELECT on full_name/location_city/location_state is
--      applied LATER, post-deploy, by the orchestrator. This migration is
--      purely additive.)
--
-- This migration is EXPAND-only: it adds columns, backfills, updates the
-- new-user trigger, grants first_name, and creates two SECDEF accessors.
-- It REVOKES nothing. Mirrors get_my_coordinates() hardening (search_path +
-- REVOKE EXECUTE FROM PUBLIC).
-- ============================================================================

-- 1. Add first_name / last_name (nullable, additive) ------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name  text;

-- 2. Backfill from full_name (first-space split, mirrors form-field-mapper) --
--    Idempotent: only fills rows where first_name is still NULL.
UPDATE public.profiles
SET
  first_name = split_part(btrim(full_name), ' ', 1),
  last_name  = CASE
    WHEN position(' ' IN btrim(full_name)) > 0
      THEN btrim(substring(btrim(full_name) FROM position(' ' IN btrim(full_name)) + 1))
    ELSE NULL
  END
WHERE first_name IS NULL
  AND full_name IS NOT NULL
  AND btrim(full_name) <> '';

-- 3. handle_new_user — populate first_name/last_name from signup metadata ----
--    Keeps full_name = trim(first || ' ' || last); falls back to the existing
--    full_name meta when first/last absent (OAuth / legacy back-compat).
--    Preserves SECURITY DEFINER, search_path, and ON CONFLICT DO NOTHING.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_first text := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  v_last  text := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'last_name',  '')), '');
  v_full  text := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'full_name',  '')), '');
  v_resolved_full text;
BEGIN
  -- Compose full_name: prefer first+last; else the full_name meta; else ''.
  v_resolved_full := COALESCE(
    NULLIF(btrim(concat_ws(' ', v_first, v_last)), ''),
    v_full,
    ''
  );

  -- If first/last weren't supplied but full_name was, derive them by split so
  -- the new column is never blank for a legacy/OAuth signup.
  IF v_first IS NULL AND v_full IS NOT NULL THEN
    v_first := split_part(v_full, ' ', 1);
    v_last  := CASE
      WHEN position(' ' IN v_full) > 0
        THEN btrim(substring(v_full FROM position(' ' IN v_full) + 1))
      ELSE NULL
    END;
  END IF;

  INSERT INTO public.profiles (id, full_name, first_name, last_name, created_at, updated_at)
  VALUES (NEW.id, v_resolved_full, v_first, v_last, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 4. Grant SELECT(first_name) to public roles (first name is public). --------
--    No UPDATE grant (immutable). last_name is intentionally NOT granted.
GRANT SELECT (first_name) ON public.profiles TO anon, authenticated;

-- 5. get_my_profile() — own-row accessor (mirrors get_my_coordinates) --------
--    Returns the caller's full profile incl. name parts + city/state, which
--    the CONTRACT revoke will close to direct column SELECT. authenticated-only.
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id                   uuid,
  username             text,
  full_name            text,
  first_name           text,
  last_name            text,
  avatar_url           text,
  bio                  text,
  location_city        text,
  location_state       text,
  is_verified          boolean,
  is_staff             boolean,
  created_at           timestamptz,
  onboarding_completed boolean,
  user_role            text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    p.id,
    p.username,
    p.full_name,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.bio,
    p.location_city,
    p.location_state,
    p.is_verified,
    p.is_staff,
    p.created_at,
    p.onboarding_completed,
    p.user_role::text
  FROM public.profiles p
  WHERE p.id = auth.uid();
$function$;

-- REVOKE from PUBLIC and anon (Supabase default privileges grant anon EXECUTE
-- on new public functions). Mirrors get_my_coordinates hardening: authenticated
-- only. anon's auth.uid() is NULL so it gets zero rows anyway — this is
-- defense-in-depth matching the established accessor pattern.
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- 6. get_my_conversation_counterparties() — the reveal accessor -------------
--    Batch form: returns the computed counterparty display name for EVERY
--    conversation the caller participates in. The asymmetric surname rule is
--    enforced ENTIRELY inside this SECDEF body — a surname the rule forbids is
--    never returned, and the participant guard (auth.uid() IN (vol, req)) is
--    the WHERE clause, so a non-participant gets zero rows.
--
--    Direction logic:
--      caller = volunteer_id (SOURCER): counterparty = requester (SEEKER) →
--        reveal the requester's FULL name (first_name + last_name).
--      caller = requester_id (SEEKER): counterparty = volunteer (SOURCER) →
--        reveal ONLY the volunteer's first_name (last_name forced NULL).
--    City/state are NEVER returned.
CREATE OR REPLACE FUNCTION public.get_my_conversation_counterparties()
RETURNS TABLE (
  conversation_id  uuid,
  counterparty_id  uuid,
  first_name       text,
  last_name        text,
  display_name     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    c.id AS conversation_id,
    cp.id AS counterparty_id,
    cp.first_name,
    -- Surname only when the caller is the SOURCER (volunteer) viewing the SEEKER.
    CASE WHEN c.volunteer_id = auth.uid() THEN cp.last_name ELSE NULL END AS last_name,
    -- Pre-composed per the rule: full for sourcer→seeker, first-only otherwise.
    CASE
      WHEN c.volunteer_id = auth.uid()
        THEN NULLIF(btrim(concat_ws(' ', cp.first_name, cp.last_name)), '')
      ELSE cp.first_name
    END AS display_name
  FROM public.conversations c
  JOIN public.profiles cp
    ON cp.id = CASE
                 WHEN c.volunteer_id = auth.uid() THEN c.requester_id
                 ELSE c.volunteer_id
               END
  -- Participant guard: caller must be a party to the conversation.
  WHERE auth.uid() IN (c.volunteer_id, c.requester_id);
$function$;

REVOKE EXECUTE ON FUNCTION public.get_my_conversation_counterparties() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_conversation_counterparties() TO authenticated;

-- 7. Single-conversation accessor — same invariant, scoped by id. -----------
--    Convenience for a single counterparty reveal (header / deep-link paths).
CREATE OR REPLACE FUNCTION public.get_conversation_counterparty(p_conversation_id uuid)
RETURNS TABLE (
  counterparty_id  uuid,
  first_name       text,
  last_name        text,
  display_name     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    cp.id AS counterparty_id,
    cp.first_name,
    CASE WHEN c.volunteer_id = auth.uid() THEN cp.last_name ELSE NULL END AS last_name,
    CASE
      WHEN c.volunteer_id = auth.uid()
        THEN NULLIF(btrim(concat_ws(' ', cp.first_name, cp.last_name)), '')
      ELSE cp.first_name
    END AS display_name
  FROM public.conversations c
  JOIN public.profiles cp
    ON cp.id = CASE
                 WHEN c.volunteer_id = auth.uid() THEN c.requester_id
                 ELSE c.volunteer_id
               END
  WHERE c.id = p_conversation_id
    AND auth.uid() IN (c.volunteer_id, c.requester_id);
$function$;

REVOKE EXECUTE ON FUNCTION public.get_conversation_counterparty(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_conversation_counterparty(uuid) TO authenticated;
