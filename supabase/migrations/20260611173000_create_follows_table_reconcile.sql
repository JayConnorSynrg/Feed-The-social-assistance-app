-- Migration: 20260611173000_create_follows_table_reconcile.sql
-- Purpose: Forward-only reconciliation of public.follows.
--   The follows table (social Phase D, #52) was applied directly to prod and
--   never captured in a committed CREATE TABLE migration. A fresh `supabase
--   db reset` therefore fails at 20260611173053 (which references public.follows)
--   and the table ships without its base RLS policies in source control.
--
--   This migration reproduces the LIVE prod definition EXACTLY so a fresh reset
--   recreates it identically, and is a clean no-op against prod (everything
--   below already exists there). It is intentionally timestamped just before
--   20260611173053_guest_access_anonymous_gating.sql so the table exists when
--   that migration adds its RESTRICTIVE anon-insert policy.
--
--   Idempotent throughout (IF NOT EXISTS / DROP POLICY IF EXISTS + CREATE).
--   Live schema reproduced verbatim from information_schema / pg_constraint:
--     follower_id  uuid NOT NULL  FK -> profiles(id) ON DELETE CASCADE
--     following_id uuid NOT NULL  FK -> profiles(id) ON DELETE CASCADE
--     created_at   timestamptz    DEFAULT now()
--     PRIMARY KEY (follower_id, following_id)

-- ============================================================
-- SECTION 1: Table (no-op where it already exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

-- ============================================================
-- SECTION 2: Lookup indexes (the unindexed-table fix)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_follows_follower  ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);

-- ============================================================
-- SECTION 3: Row Level Security + base policies
-- ENABLE ROW LEVEL SECURITY is a no-op when already enabled.
-- Base policies (SELECT/INSERT/DELETE) reproduced from live so a fresh reset
-- matches prod. The RESTRICTIVE anon-insert policy is owned by the later
-- migration 20260611173053 and is intentionally NOT duplicated here.
-- ============================================================

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Public read (follow graph is public)
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
CREATE POLICY "Follows are viewable by everyone" ON public.follows
  FOR SELECT USING (true);

-- A user may create only their own follow edge
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- A user may remove only their own follow edge
DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can unfollow" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);
