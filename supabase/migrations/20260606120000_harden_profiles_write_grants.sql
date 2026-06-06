-- Migration: 20260606120000_harden_profiles_write_grants.sql
-- Purpose: Close the is_admin self-INSERT privilege-escalation surface on public.profiles.
--
-- SECURITY SURFACE CLOSED:
--   PostgreSQL's RLS WITH CHECK only gates WHICH row an authenticated user may insert
--   (auth.uid() = id). It does NOT restrict WHICH columns may be written. With a
--   table-level INSERT grant, any authenticated user could INSERT a row that includes
--   is_admin=true, is_staff=true, is_verified=true, harmony_score=999, etc.
--   The RLS check would pass because auth.uid()=id matches — the exploit:
--     INSERT INTO profiles(id, is_admin) VALUES (auth.uid(), true)
--   This migration replaces the table-level INSERT grant with column-scoped INSERT,
--   limiting writes to exactly the 11 columns the onboarding self-upsert requires.
--
-- WHY INSERT IS KEPT FOR authenticated (not fully revoked):
--   Signup row creation is handled exclusively by the SECURITY DEFINER trigger
--   handle_new_user (on_auth_user_created), which fires on auth.users INSERT.
--   Anonymous users never need INSERT on profiles.
--
--   However, the onboarding self-upsert in apps/web/src/app/(auth)/onboarding/page.tsx
--   uses PostgREST .upsert() which emits:
--     INSERT INTO profiles(...) ON CONFLICT(id) ON CONFLICT DO UPDATE SET ...
--   PostgreSQL requires INSERT privilege at query-plan time even when the conflict
--   branch fires and the row already exists. Removing INSERT breaks onboarding for
--   new accounts where the trigger-created row already exists but onboarding_completed
--   is still false.
--
-- COLUMN SET (11 columns written by onboarding self-upsert, statically verified):
--   id, user_role, zip_code, location_city, location_state, latitude, longitude,
--   needs, phone, onboarding_completed, updated_at
--
--   Excluded (server/trust-managed — must NOT be client-writable):
--   is_admin, is_staff, is_verified, harmony_score, harmony_reviews_count,
--   created_at, location (trigger-derived geography column)
--
-- UPDATE GRANTS: The DO UPDATE branch needs UPDATE on the SET columns.
--   Already covered by PR#50's 16-col authenticated UPDATE grant. No UPDATE change needed.
--
-- DELETE / TRUNCATE / TRIGGER / REFERENCES: No client path uses these.
--   Account deletion goes through the delete-account edge function (service_role,
--   bypasses RLS and grants). Safe to revoke.
--
-- IDEMPOTENCY: REVOKE is idempotent (no error if privilege not held).
--   Column-level GRANT is idempotent when re-run (re-grants same privileges).

-- Step 1: Strip the table-level INSERT grant from both roles.
-- This is the key step — table-level INSERT was the exploit vector.
REVOKE INSERT ON public.profiles FROM anon;
REVOKE INSERT ON public.profiles FROM authenticated;

-- Step 2: Re-grant INSERT scoped to exactly the 11 onboarding columns.
-- anon intentionally receives NO column-level INSERT (trigger handles signup row).
GRANT INSERT (
  id,
  user_role,
  zip_code,
  location_city,
  location_state,
  latitude,
  longitude,
  needs,
  phone,
  onboarding_completed,
  updated_at
) ON public.profiles TO authenticated;

-- Step 3: Revoke unused destructive privileges from both roles.
-- No client code holds DELETE or TRUNCATE paths on profiles.
-- TRIGGER and REFERENCES are structural privileges with no client use.
REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.profiles FROM anon, authenticated;
