-- Contract step: apply to prod ONLY after client (which no longer selects created_by) is deployed.
-- BREAKING for any code still selecting created_by directly from safety_alerts table.
REVOKE SELECT (created_by) ON public.safety_alerts FROM authenticated, anon;
