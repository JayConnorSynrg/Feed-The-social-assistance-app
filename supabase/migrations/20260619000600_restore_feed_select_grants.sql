-- ============================================================================
-- P0 restore: re-grant the column SELECTs the community feed depends on.
-- ----------------------------------------------------------------------------
-- INCIDENT (2026-06-19): the community feed returned 42501 "permission denied
-- for table profiles" for authenticated + anon. Root cause: prod ACL was frozen
-- at a pre-2026-06-04 grant snapshot for profiles even though the version rows
-- for 20260604150000_reviews_and_harmony (harmony grants) and
-- 20260612000000_profiles_name_privacy_expand (first_name grant) were stamped in
-- supabase_migrations.schema_migrations. The stamped versions never actually
-- executed their GRANT bodies against prod (applied-content != committed-content
-- drift — see pattern-forms-schema-governance-drift). The feed embed
-- (feed-panel.tsx selects first_name, harmony_score, harmony_reviews_count) hit
-- ungranted columns -> 42501 -> feed down.
--
-- This migration is purely ADDITIVE and idempotent: it re-asserts the column
-- SELECT grants the running app requires, matching the original intent of
-- 20260604150000 and 20260612000000. It re-grants NOTHING sensitive:
--   * safety_alerts.created_by stays REVOKED (20260619000300/000500).
--   * profiles coordinate columns (latitude, longitude, location, zip_code) are
--     NOT touched here — their lockdown is governed by 20260606130000 Phase 2.
--
-- Safe on fresh `supabase db reset`: GRANT of an already-present privilege is a
-- no-op, and this runs after the tables/columns exist.
-- ============================================================================

-- safety_alerts: the 13 public columns (created_by intentionally excluded).
GRANT SELECT (
  id, alert_type, severity, description, location, status,
  confirm_count, clear_count, expires_at, created_at,
  verified, verified_by, verified_at
) ON public.safety_alerts TO authenticated, anon;

-- profiles: the public projection the feed + harmony badge require.
-- first_name is the only public name projection (full_name stays private).
GRANT SELECT (first_name, harmony_score, harmony_reviews_count)
  ON public.profiles TO authenticated, anon;
