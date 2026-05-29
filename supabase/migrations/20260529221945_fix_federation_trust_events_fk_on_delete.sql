-- Fix federation_trust_events.created_by FK to use ON DELETE SET NULL.
-- Previously: REFERENCES auth.users(id) with no ON DELETE clause (defaults to NO ACTION).
-- This caused auth.admin.deleteUser to fail with 23503 for any user who had
-- a federation_trust_events row with created_by = their user id.
ALTER TABLE public.federation_trust_events
  DROP CONSTRAINT IF EXISTS federation_trust_events_created_by_fkey,
  ADD CONSTRAINT federation_trust_events_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
