-- Migration: add_form_submission_columns
-- Adds deadline, case_number, and agency_name columns to form_submissions.
-- Uses IF NOT EXISTS for idempotent application.

ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS case_number TEXT;
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS agency_name TEXT;

-- Index on deadline for upcoming-deadline queries
CREATE INDEX IF NOT EXISTS idx_form_submissions_deadline
  ON form_submissions (user_id, deadline)
  WHERE deadline IS NOT NULL;

-- Index on case_number for lookup
CREATE INDEX IF NOT EXISTS idx_form_submissions_case_number
  ON form_submissions (case_number)
  WHERE case_number IS NOT NULL;
