-- backfill-schema-migrations-2026-09.sql
-- Owner: Jelal Connor / SYNRG SCALING, LLC
-- Wave: feed-fullfeed-h-hygiene (Invariant 1 — ledger matches production truth)
--
-- DO NOT run as part of any git merge. This is a PROD post-deploy write, executed
-- ONCE via the Supabase Management API SQL endpoint by the authorized orchestrator
-- (GIT_PLAN feed-fullfeed-h-hygiene-postdeploy), AFTER migration 20261002000000 is
-- applied. `supabase db push` must NOT be used to run it.
--
-- ── WHY ──────────────────────────────────────────────────────────────────────
-- supabase_migrations.schema_migrations holds 97 rows (latest version 20260619000100).
-- supabase/migrations/ holds all 35 versions after 20260619000100, applied to prod
-- out-of-band through the Management API and never recorded, so `supabase db push`
-- would try to REPLAY them. This wave also ADDS two migrations — 20261002000000
-- (posts_privilege_least) and 20261003000000 (restore_realtime_publication) — which the
-- post-deploy step applies via the Management API (that endpoint does NOT touch the
-- ledger), so they too must be recorded here.
--
-- This transaction records ALL 37 versions (35 out-of-band + 20261002000000 +
-- 20261003000000). Every one is either LIVE now or was SUPERSEDED by a LATER migration
-- that IS live and is also recorded here — so an in-order `db push` replay of the full
-- set reproduces the exact current prod state. Recording them makes push replay nothing.
--
-- Expected ledger count after this runs: 97 + 37 = 134.
--
-- ── VERIFICATION METHOD ──────────────────────────────────────────────────────
-- Each version was confirmed against the specific catalog object its file
-- creates/alters (pg_proc / pg_class / information_schema.columns / pg_type /
-- pg_extension / pg_policies / pg_indexes / pg_trigger / pg_publication_tables /
-- storage.buckets / has_column_privilege). Full derivation table is in the
-- feed-fullfeed-h-hygiene PR body.
--
-- ── SUPERSEDED-BUT-APPLIED (recorded; signature object intentionally gone) ─────
-- Two versions have no live signature object today because a LATER, LIVE, and also-
-- recorded migration removed/replaced it. In-order replay still equals prod, so both
-- ARE recorded (same rule already applied to 20260926000000, whose admin_update_resource
-- was superseded by 20260927000000):
--   20260630000100_realtime_publication_notifications_likes_comments — applied to prod
--     (PR #160). Its publication ADDs were later wiped by the LIVE W1.3 migration
--     20260929000000, which used `ALTER PUBLICATION ... SET TABLE public.posts (...)`
--     (replaces the whole set); W1.4 (20261001000000) re-added post_comments + poll_votes.
--     Current set {posts, post_comments, poll_votes} is the in-order result of the full
--     recorded chain. NOTE: notifications + post_likes remain OFF the realtime WAL — the
--     forward fix is a SEPARATE migration, deliberately NOT authored in this wave.
--   20260922000100_coarse_geocode_targets_fn — the function was explicitly SUPERSEDED
--     and DROPped by the LIVE 20260923000000. In-order replay creates then drops it,
--     matching prod (no such function).
--
-- ── VERSION-COLLISION HAZARDS (reported; NOT resolved here) ───────────────────
--   20260619000200 — TWO repo files share this version (_admin_user_management.sql +
--     _safety_alert_is_mine.sql; both effects live). The ledger version is UNIQUE, so
--     the single row below (name 'admin_user_management') records the version and makes
--     push skip BOTH files. Renaming one to a distinct version is a separate remediation.
--   20260610210000 — already in the ledger (name 'db_layer_hardening'); a second file
--     _government_forms_bucket.sql shares the version (bucket live). No backfill needed.
--
-- ── REVERSE DIRECTION (ledger row with no repo file) ──────────────────────────
--   20260611173000 (name 'create_follows_table_reconcile') has a ledger row but no repo
--   file. public.follows is live; superseded by 20260611173053_guest_access_anonymous_gating.sql.
--   No action (already recorded).
--
-- ── COLUMN SHAPE ─────────────────────────────────────────────────────────────
-- schema_migrations columns observed: version text NOT NULL, statements text[], name
-- text, created_by text, idempotency_key text, rollback text[]. Existing rows populate
-- (version, name, statements). `statements` carries a single marker element documenting
-- the out-of-band application; the real DDL lives in the referenced migration file and
-- is already applied in prod.

BEGIN;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('20260619000200', 'admin_user_management', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260619000200_admin_user_management.sql (NOTE: version shared with 20260619000200_safety_alert_is_mine.sql — both live)']),
  ('20260619000300', 'revoke_safety_alert_created_by', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260619000300_revoke_safety_alert_created_by.sql']),
  ('20260619000400', 'drop_safety_alerts_from_realtime', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260619000400_drop_safety_alerts_from_realtime.sql']),
  ('20260619000500', 'safety_alert_created_by_column_grant', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260619000500_safety_alert_created_by_column_grant.sql']),
  ('20260619000600', 'restore_feed_select_grants', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260619000600_restore_feed_select_grants.sql']),
  ('20260619000700', 'dashboard_completed_profiles_rpc', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260619000700_dashboard_completed_profiles_rpc.sql']),
  ('20260619000800', 'revoke_profiles_pii_select', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260619000800_revoke_profiles_pii_select.sql']),
  ('20260619000900', 'fix_admin_list_users_email_cast', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260619000900_fix_admin_list_users_email_cast.sql']),
  ('20260620000100', 'approve_reject_resource_rpc', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260620000100_approve_reject_resource_rpc.sql']),
  ('20260626000100', 'discovery_provenance', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260626000100_discovery_provenance.sql']),
  ('20260627000100', 'admin_resources_phasec', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260627000100_admin_resources_phasec.sql']),
  ('20260629000100', 'restore_optin_guest_guard', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260629000100_restore_optin_guest_guard.sql']),
  ('20260630000100', 'realtime_publication_notifications_likes_comments', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260630000100_realtime_publication_notifications_likes_comments.sql (SUPERSEDED by LIVE 20260929000000 SET TABLE; recorded so in-order replay = prod)']),
  ('20260703120000', 'admin_code_redemptions', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260703120000_admin_code_redemptions.sql']),
  ('20260703130000', 'restrict_federated_instances_read', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260703130000_restrict_federated_instances_read.sql']),
  ('20260914120000', 'rls_scope_admin_policies_to_authenticated', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260914120000_rls_scope_admin_policies_to_authenticated.sql']),
  ('20260916120000', 'admin_resource_list_edit', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260916120000_admin_resource_list_edit.sql']),
  ('20260917000000', 'snap_retailers_in_bounds', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260917000000_snap_retailers_in_bounds.sql']),
  ('20260918000000', 'resource_service_mode', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260918000000_resource_service_mode.sql']),
  ('20260918000100', 'pending_resources_email', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260918000100_pending_resources_email.sql']),
  ('20260919000000', 'search_resources', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260919000000_search_resources.sql']),
  ('20260920000000', 'geocode_accuracy_columns', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260920000000_geocode_accuracy_columns.sql']),
  ('20260921000000', 'recategorize_osm_trail_shelters', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260921000000_recategorize_osm_trail_shelters.sql']),
  ('20260922000000', 'geocode_accuracy_in_read_rpcs', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260922000000_geocode_accuracy_in_read_rpcs.sql']),
  ('20260922000100', 'coarse_geocode_targets_fn', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260922000100_coarse_geocode_targets_fn.sql (SUPERSEDED/DROPped by LIVE 20260923000000; recorded so in-order replay = prod)']),
  ('20260923000000', 'untagged_geocode_targets_fn', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260923000000_untagged_geocode_targets_fn.sql']),
  ('20260924000000', 'webhook_resource_diff_gate', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260924000000_webhook_resource_diff_gate.sql']),
  ('20260925000000', 'geocode_backfill_cadence', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260925000000_geocode_backfill_cadence.sql']),
  ('20260926000000', 'admin_update_resource_geocode_accuracy', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260926000000_admin_update_resource_geocode_accuracy.sql']),
  ('20260927000000', 'geocode_symmetry_unlocated_state', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260927000000_geocode_symmetry_unlocated_state.sql']),
  ('20260927500000', 'observability_wide_events', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260927500000_observability_wide_events.sql']),
  ('20260928000000', 'ranked_feed_schema_spine', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260928000000_ranked_feed_schema_spine.sql']),
  ('20260929000000', 'ranked_feed_w1_3', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260929000000_ranked_feed_w1_3.sql']),
  ('20260930000000', 'post_images_bucket', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20260930000000_post_images_bucket.sql']),
  ('20261001000000', 'w1_4_realtime_poll_comment_signals', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): applied via Supabase Management API; see supabase/migrations/20261001000000_w1_4_realtime_poll_comment_signals.sql']),
  ('20261002000000', 'posts_privilege_least', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): this wave''s migration, applied to prod via Management API in the same post-deploy step; recorded here since that endpoint does not write the ledger']),
  ('20261003000000', 'restore_realtime_publication', ARRAY['-- backfilled 2026-09 (feed-fullfeed-h-hygiene): this wave''s migration (restores messages/notifications/conversations to supabase_realtime after the W1.3 SET TABLE wipe), applied to prod via Management API in the same post-deploy step; recorded here since that endpoint does not write the ledger'])
ON CONFLICT (version) DO NOTHING;

-- Expected: 37 rows inserted (0 on a second run — idempotent via ON CONFLICT).
-- Post-apply sanity check (run separately, read-only):
--   SELECT count(*) FROM supabase_migrations.schema_migrations;  -- expect 134 (97 + 37)

COMMIT;
