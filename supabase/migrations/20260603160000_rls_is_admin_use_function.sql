-- Migration: Replace inline profiles is_admin EXISTS subquery with public.is_current_user_admin()
-- across all 18 admin-gated RLS policies (12 tables).
--
-- WHY: The inline `EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND is_admin=true)`
-- fragment requires the calling role to have SELECT on public.profiles. Migration
-- 20260603130000_pii_hardening_revoke.sql revoked SELECT on profiles from the
-- authenticated role, so the subquery now raises 42501 (permission denied for table
-- profiles) for ALL authenticated users and breaks every read/write gated by these
-- policies (Applications, Programs, Forms + 9 admin surfaces; e.g. resources VT count
-- returns 0 instead of 335 for non-admins).
--
-- FIX: public.is_current_user_admin() is SECURITY DEFINER / STABLE / search_path-pinned,
-- EXECUTE granted to authenticated, non-recursive — it reads is_admin WITHOUT requiring
-- the caller to hold SELECT on profiles. Wrapped in (select ...) per Supabase advisor
-- lint 0003 (auth_rls_initplan) so the function evaluates once per query, not per row.
--
-- Each DROP+CREATE reproduces the original roles/cmd/qual/with_check EXACTLY (verified
-- against live prod ndtpovonpadugthmcntl via pg_policies); the ONLY change is the EXISTS
-- fragment -> (select public.is_current_user_admin()).
--
-- IDEMPOTENT: every DROP uses IF EXISTS and the whole batch is wrapped in BEGIN/COMMIT,
-- so this migration is safely re-runnable (applied via Mgmt API now AND committed for
-- fresh-reset parity).

BEGIN;

-- audit_log: "Admins view all audit logs" (SELECT, authenticated, qual)
DROP POLICY IF EXISTS "Admins view all audit logs" ON public.audit_log;
CREATE POLICY "Admins view all audit logs" ON public.audit_log
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));

-- community_stats: community_stats_insert_admin (INSERT, public, with_check)
DROP POLICY IF EXISTS "community_stats_insert_admin" ON public.community_stats;
CREATE POLICY "community_stats_insert_admin" ON public.community_stats
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select public.is_current_user_admin()));

-- community_stats: community_stats_update_admin (UPDATE, public, qual)
DROP POLICY IF EXISTS "community_stats_update_admin" ON public.community_stats;
CREATE POLICY "community_stats_update_admin" ON public.community_stats
  AS PERMISSIVE FOR UPDATE TO public
  USING ((select public.is_current_user_admin()));

-- federated_instances: "Only admins can manage instances" (ALL, public, qual)
DROP POLICY IF EXISTS "Only admins can manage instances" ON public.federated_instances;
CREATE POLICY "Only admins can manage instances" ON public.federated_instances
  AS PERMISSIVE FOR ALL TO public
  USING ((select public.is_current_user_admin()));

-- federation_health_checks: "Admins can view health checks" (SELECT, public, qual)
DROP POLICY IF EXISTS "Admins can view health checks" ON public.federation_health_checks;
CREATE POLICY "Admins can view health checks" ON public.federation_health_checks
  AS PERMISSIVE FOR SELECT TO public
  USING ((select public.is_current_user_admin()));

-- federation_peers: "Only admins can manage peers" (ALL, public, qual)
DROP POLICY IF EXISTS "Only admins can manage peers" ON public.federation_peers;
CREATE POLICY "Only admins can manage peers" ON public.federation_peers
  AS PERMISSIVE FOR ALL TO public
  USING ((select public.is_current_user_admin()));

-- federation_sync_log: "Admins can view sync logs" (SELECT, public, qual)
DROP POLICY IF EXISTS "Admins can view sync logs" ON public.federation_sync_log;
CREATE POLICY "Admins can view sync logs" ON public.federation_sync_log
  AS PERMISSIVE FOR SELECT TO public
  USING ((select public.is_current_user_admin()));

-- federation_trust_events: "Admins can view trust events" (SELECT, public, qual)
DROP POLICY IF EXISTS "Admins can view trust events" ON public.federation_trust_events;
CREATE POLICY "Admins can view trust events" ON public.federation_trust_events
  AS PERMISSIVE FOR SELECT TO public
  USING ((select public.is_current_user_admin()));

-- federation_webhook_log: "Admins can view webhook logs" (SELECT, public, qual)
DROP POLICY IF EXISTS "Admins can view webhook logs" ON public.federation_webhook_log;
CREATE POLICY "Admins can view webhook logs" ON public.federation_webhook_log
  AS PERMISSIVE FOR SELECT TO public
  USING ((select public.is_current_user_admin()));

-- form_submissions: form_submissions_admin_select (SELECT, public, qual)
DROP POLICY IF EXISTS "form_submissions_admin_select" ON public.form_submissions;
CREATE POLICY "form_submissions_admin_select" ON public.form_submissions
  AS PERMISSIVE FOR SELECT TO public
  USING ((select public.is_current_user_admin()));

-- form_submissions: form_submissions_admin_update (UPDATE, public, qual)
DROP POLICY IF EXISTS "form_submissions_admin_update" ON public.form_submissions;
CREATE POLICY "form_submissions_admin_update" ON public.form_submissions
  AS PERMISSIVE FOR UPDATE TO public
  USING ((select public.is_current_user_admin()));

-- form_templates: "Admins can manage form templates" (ALL, public, qual)
DROP POLICY IF EXISTS "Admins can manage form templates" ON public.form_templates;
CREATE POLICY "Admins can manage form templates" ON public.form_templates
  AS PERMISSIVE FOR ALL TO public
  USING ((select public.is_current_user_admin()));

-- form_templates: form_templates_admin_delete (DELETE, public, qual)
DROP POLICY IF EXISTS "form_templates_admin_delete" ON public.form_templates;
CREATE POLICY "form_templates_admin_delete" ON public.form_templates
  AS PERMISSIVE FOR DELETE TO public
  USING ((select public.is_current_user_admin()));

-- form_templates: form_templates_admin_insert (INSERT, public, with_check)
DROP POLICY IF EXISTS "form_templates_admin_insert" ON public.form_templates;
CREATE POLICY "form_templates_admin_insert" ON public.form_templates
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select public.is_current_user_admin()));

-- form_templates: form_templates_admin_update (UPDATE, public, qual)
DROP POLICY IF EXISTS "form_templates_admin_update" ON public.form_templates;
CREATE POLICY "form_templates_admin_update" ON public.form_templates
  AS PERMISSIVE FOR UPDATE TO public
  USING ((select public.is_current_user_admin()));

-- resources: "Admins can manage all resources" (ALL, public, qual)
DROP POLICY IF EXISTS "Admins can manage all resources" ON public.resources;
CREATE POLICY "Admins can manage all resources" ON public.resources
  AS PERMISSIVE FOR ALL TO public
  USING ((select public.is_current_user_admin()));

-- snap_retailers: snap_retailers_admin_insert (INSERT, public, with_check)
DROP POLICY IF EXISTS "snap_retailers_admin_insert" ON public.snap_retailers;
CREATE POLICY "snap_retailers_admin_insert" ON public.snap_retailers
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select public.is_current_user_admin()));

-- snap_retailers: snap_retailers_admin_update (UPDATE, public, qual)
DROP POLICY IF EXISTS "snap_retailers_admin_update" ON public.snap_retailers;
CREATE POLICY "snap_retailers_admin_update" ON public.snap_retailers
  AS PERMISSIVE FOR UPDATE TO public
  USING ((select public.is_current_user_admin()));

COMMIT;
