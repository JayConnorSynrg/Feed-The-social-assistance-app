-- 20260601070000_tighten_form_submissions_update_with_check.sql
-- Closes self-approval privilege-escalation: prior WITH CHECK (auth.uid()=user_id)
-- allowed an applicant to set NEW status to reviewer-only states
-- (under_review/approved/denied/pending_info/expired).
-- USING unchanged; WITH CHECK constrained to user-controllable states.
-- Reviewer transitions remain available via form_submissions_admin_update (is_admin gate).
DROP POLICY IF EXISTS "Users can update their own draft submissions" ON public.form_submissions;
CREATE POLICY "Users can update their own draft submissions"
  ON public.form_submissions
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status = ANY (ARRAY['draft'::submission_status, 'in_progress'::submission_status])
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = ANY (ARRAY['draft'::submission_status, 'in_progress'::submission_status, 'submitted'::submission_status])
  );
