-- Phase 9 P9-T6: Add FK constraints from conversations to profiles
--
-- conversations.volunteer_id and .requester_id reference auth.users(id).
-- PostgREST cannot JOIN through auth.users → profiles indirectly, so the
-- CONVERSATION_SELECT query using !conversations_volunteer_id_fkey as a
-- profiles hint fails with PGRST200.
--
-- Fix: add direct FK constraints from conversations → profiles(id).
-- profiles.id mirrors auth.users.id (maintained by handle_new_user trigger),
-- so these FKs are structurally valid and add referential integrity.
-- ON DELETE CASCADE matches the existing auth.users FK behaviour.
--
-- These new constraints are named:
--   conversations_volunteer_id_profiles_fkey
--   conversations_requester_id_profiles_fkey
--
-- The hook use-conversations.ts then uses these hints for the PostgREST JOIN.

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_volunteer_id_profiles_fkey
    FOREIGN KEY (volunteer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_requester_id_profiles_fkey
    FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
