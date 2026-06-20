-- Close the safety_alerts.created_by REST leak with a column-scoped SELECT grant.
--
-- Background: safety_alerts.created_by holds the reporter's identity. Reporter
-- anonymity requires that authenticated/anon clients CANNOT read created_by via
-- the PostgREST REST API.
--
-- The prior column-level REVOKE (20260619000300) was a NO-OP: a table-level
-- `GRANT SELECT ON safety_alerts` was still in place, and a table-wide SELECT
-- grant covers every column regardless of any column-level REVOKE. Postgres
-- resolves the broader table grant, so created_by stayed readable over REST.
--
-- Correct fix: drop the table-wide SELECT grant entirely, then GRANT SELECT only
-- on the columns clients legitimately need (all columns EXCEPT created_by). With
-- no table-level SELECT grant remaining, the column grant is authoritative and
-- created_by is no longer selectable by authenticated or anon.
--
-- The two known authenticated SELECT call sites
--   apps/web/src/app/(admin)/moderation/safety-alerts-review.tsx
--   apps/web/src/components/panels/feed-panel.tsx
-- do not select created_by (verified post-#140), so this is non-breaking.
--
-- REVOKE-then-GRANT is naturally re-runnable.

REVOKE SELECT ON public.safety_alerts FROM authenticated, anon;

GRANT SELECT (
  id,
  alert_type,
  severity,
  description,
  location,
  status,
  confirm_count,
  clear_count,
  expires_at,
  created_at,
  verified,
  verified_by,
  verified_at
) ON public.safety_alerts TO authenticated, anon;
