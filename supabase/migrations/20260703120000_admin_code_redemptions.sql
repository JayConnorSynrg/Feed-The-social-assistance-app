-- Migration: admin_code_redemptions
--
-- Immutable audit table for administrator code redemption attempts.
-- Service-role only: REVOKE ALL on anon + authenticated, no policies.
-- No UPDATE / DELETE: rows are append-only by design.
-- Do NOT store the code or any hash of it — only success/failure_reason.

CREATE TABLE IF NOT EXISTS public.admin_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  success boolean NOT NULL,
  failure_reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_code_redemptions_user_time
  ON public.admin_code_redemptions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_code_redemptions_failures
  ON public.admin_code_redemptions (user_id, created_at DESC)
  WHERE success = false;

ALTER TABLE public.admin_code_redemptions ENABLE ROW LEVEL SECURITY;

-- Service-role only — no anon/authenticated access, no user-facing policies.
-- Rows are immutable audit records: no UPDATE or DELETE ever issued.
REVOKE ALL ON public.admin_code_redemptions FROM anon, authenticated;

COMMENT ON TABLE public.admin_code_redemptions IS
  'Immutable audit log of administrator code redemption attempts. '
  'Service-role access only (no RLS policies). '
  'Rows are never updated or deleted — append-only by design. '
  'The plaintext code and its hash are never stored here.';
