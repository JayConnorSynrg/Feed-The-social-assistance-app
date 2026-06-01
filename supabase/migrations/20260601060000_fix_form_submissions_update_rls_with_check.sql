-- Migration: fix_form_submissions_update_rls_with_check
--
-- Root cause: "Users can update their own draft submissions" UPDATE policy had no
-- explicit WITH CHECK clause. Postgres uses the USING clause as the implicit
-- WITH CHECK when WITH CHECK is omitted. The USING clause restricts which rows
-- can be updated: `status IN ('draft', 'in_progress')`. After the UPDATE sets
-- status='submitted', the implicit WITH CHECK re-evaluates on the NEW row and
-- finds status='submitted' ∉ {'draft','in_progress'} → error code 42501
-- "new row violates row-level security policy".
--
-- Fix: drop and recreate the policy with an explicit WITH CHECK that only
-- requires `auth.uid() = user_id` on the resulting row. The USING clause still
-- gates which rows can be updated (must currently be draft or in_progress), but
-- the WITH CHECK allows the new status to be anything (submitted, etc.).

DROP POLICY IF EXISTS "Users can update their own draft submissions" ON form_submissions;

CREATE POLICY "Users can update their own draft submissions"
  ON form_submissions
  FOR UPDATE
  USING (auth.uid() = user_id AND status = ANY (ARRAY['draft'::submission_status, 'in_progress'::submission_status]))
  WITH CHECK (auth.uid() = user_id);
