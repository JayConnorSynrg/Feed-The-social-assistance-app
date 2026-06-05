-- Defense-in-depth: REVOKE INSERT(location) from anon and authenticated roles.
-- The location column is populated exclusively by the handle_new_user trigger
-- (server-side, SECURITY DEFINER). No client code inserts location directly.
-- This revocation is idempotent — it is safe to run on a fresh schema that
-- never had the privilege granted; Postgres treats a REVOKE of a non-held
-- privilege as a no-op.
REVOKE INSERT (location) ON public.profiles FROM anon, authenticated;
