-- Migration: 20260603150000_harden_function_search_path.sql
--
-- Purpose: Close Supabase advisor lint function_search_path_mutable (8 functions).
--   Each function had proconfig=null (unpinned search_path), exposing them to
--   search_path injection attacks where a malicious schema placed earlier in the
--   path could shadow public schema objects and redirect execution.
--
-- Fix: SET search_path = public, pg_temp on every affected function. This pins
--   name resolution at call time regardless of caller search_path or SET commands.
--   pg_temp is included per Postgres best-practice to still allow temp-table usage
--   during the function's own session. This is non-breaking — logic is unchanged.
--
-- Additional hardening: on_resource_change_webhook_fn is SECURITY DEFINER and
--   was executable by PUBLIC (anon + authenticated) via direct EXECUTE grant.
--   Audit confirms it is trigger-only (TG_OP logic in body; no client .rpc() calls
--   anywhere in apps/web/src or supabase/functions). Triggers fire as the table
--   owner regardless of EXECUTE grants — revoking direct invocation does NOT
--   break the trigger, but removes the anon/authenticated invocation surface.
--
-- Step 0A evidence:
--   prosecdef=true, args='', body uses TG_OP/NEW/OLD (trigger-only pattern).
--   pg_trigger check returned 0 rows (trigger may be inactive/dropped on this
--   table revision) — no active trigger references, zero client RPC calls.
--   VERDICT: trigger-only, REVOKE EXECUTE safe.

-- ── 1. PIN SEARCH_PATH ON ALL 8 FUNCTIONS ────────────────────────────────────

ALTER FUNCTION public.calculate_trust_score(
  uptime_score numeric,
  data_quality_score numeric,
  moderation_score numeric,
  community_score numeric,
  longevity_days integer
) SET search_path = public, pg_temp;

ALTER FUNCTION public.find_duplicate_resource(
  p_name text,
  p_phone text,
  p_address text,
  p_threshold double precision
) SET search_path = public, pg_temp;

ALTER FUNCTION public.nearby_federated_resources(
  search_lat double precision,
  search_lng double precision,
  radius_miles double precision,
  resource_category text,
  result_limit integer
) SET search_path = public, pg_temp;

ALTER FUNCTION public.refresh_federation_trust_overview()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.trust_score_to_level(
  score numeric
) SET search_path = public, pg_temp;

ALTER FUNCTION public.update_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.on_resource_change_webhook_fn()
  SET search_path = public, pg_temp;

-- ── 2. REVOKE DIRECT EXECUTE ON SECDEF TRIGGER-ONLY WEBHOOK FN ───────────────
-- Removes the anon/authenticated/PUBLIC invocation surface.
-- Triggers on resources table continue to fire via table-owner privilege — this
-- revoke does NOT affect trigger execution, only blocks direct .rpc() calls.

REVOKE EXECUTE ON FUNCTION public.on_resource_change_webhook_fn()
  FROM PUBLIC, anon, authenticated;
