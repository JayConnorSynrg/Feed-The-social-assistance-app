-- Migration: security_advisor_remediation
-- Timestamp: 20260601090000
--
-- Fixes two Supabase security advisor findings:
--
-- FINDING 1 (P1 — exploitable): public.notifications INSERT RLS
--   Policy `notifications_insert_system` was CMD=INSERT WITH CHECK (true) TO PUBLIC
--   meaning any authenticated user could INSERT a notification row for ANY other
--   user_id (phishing / cross-user forgery).
--
--   Caller recon (2026-06-01):
--   - apps/web/src/hooks/use-notifications.ts: zero INSERT calls to notifications.
--     Only SELECT, UPDATE (mark-read), and DELETE are performed by the browser client.
--   - apps/web/src/components/panels/settings-panel.tsx: preferences only (no DB writes
--     to notifications table).
--   - supabase/functions/: no edge function TypeScript code does INSERT INTO notifications.
--     Notifications are intended to be written by triggers / SECURITY DEFINER functions /
--     service_role callers that bypass RLS entirely.
--   - Conclusion: NO client caller ever self-inserts; notifications are system-only.
--   Fix: DROP the PUBLIC WITH CHECK (true) policy. Without an INSERT policy, the table
--   is RLS-locked for INSERT to non-superuser roles. SECURITY DEFINER triggers and
--   service_role calls bypass RLS by design — they will continue to work.
--   SELECT / UPDATE / DELETE policies are left strictly untouched.
--
-- FINDING 2 (P3): public.federation_trust_overview anon/authenticated SELECT exposure
--   Materialized view federation_trust_overview had SELECT granted to anon + authenticated,
--   exposing peer instance_url, trust_score, and sync stats.
--
--   Caller recon (2026-06-01):
--   - grep across apps/ and packages/ (excluding generated types.ts): ZERO direct reads
--     of federation_trust_overview from non-admin, non-service surfaces.
--   - packages/database/types.ts: only type references (referencedRelation — generated
--     metadata, no runtime reads).
--   - supabase/functions/: no edge function reads it.
--   - Only admin/service surfaces touch this view (refresh_federation_trust_overview fn).
--   - Conclusion: REVOKE is safe; no app caller will break.
--   Fix: REVOKE SELECT on federation_trust_overview FROM anon, authenticated.
--   service_role and postgres access is left intact.

-- ---------------------------------------------------------------------------
-- FIX 1: notifications INSERT RLS
-- ---------------------------------------------------------------------------

-- Drop the exploitable always-true INSERT policy (PUBLIC WITH CHECK (true))
DROP POLICY IF EXISTS notifications_insert_system ON public.notifications;

-- No replacement policy is created. INSERT is now blocked for anon/authenticated
-- by RLS (the table has RLS enabled). SECURITY DEFINER triggers and service_role
-- callers bypass RLS and continue to work unaffected.

-- Verify: SELECT/UPDATE/DELETE policies are intentionally left untouched.
-- (notifications_select_own, notifications_update_own, notifications_delete_own)

-- ---------------------------------------------------------------------------
-- FIX 2: federation_trust_overview anon/authenticated SELECT exposure
-- ---------------------------------------------------------------------------

REVOKE SELECT ON public.federation_trust_overview FROM anon, authenticated;

-- service_role and postgres retain full access (default ownership grants).
