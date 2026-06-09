-- Migration: conversation_status_completed
-- Adds the 'completed' value to the conversation_status enum.
--
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot run inside a transaction block that
-- also references the new value. This migration is intentionally standalone so
-- the value is committed before the dependent migration runs.
--
-- Idempotent: IF NOT EXISTS guard prevents duplicate-value errors on re-run.

ALTER TYPE public.conversation_status ADD VALUE IF NOT EXISTS 'completed' AFTER 'active';
