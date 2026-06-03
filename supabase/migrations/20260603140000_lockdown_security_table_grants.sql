-- Defense-in-depth: these 4 tables have RLS enabled + 0 policies (default-deny).
-- anon/authenticated additionally held full DML grants (latent exposure if a permissive
-- policy is ever added). All legitimate access is via service_role (server-side), which
-- bypasses RLS and is unaffected by these REVOKEs.
--
-- password_history note: /api/auth/password-last-changed uses the authenticated-role
-- server client but RLS already default-denies its SELECT (zero policies). The route
-- falls back to user.created_at on null — behavior is unchanged by this REVOKE.
--
-- REVOKE ALL is idempotent and safe. service_role grants are untouched.
REVOKE ALL ON public.account_lockouts FROM anon, authenticated;
REVOKE ALL ON public.app_logs FROM anon, authenticated;
REVOKE ALL ON public.auth_login_attempts FROM anon, authenticated;
REVOKE ALL ON public.password_history FROM anon, authenticated;
