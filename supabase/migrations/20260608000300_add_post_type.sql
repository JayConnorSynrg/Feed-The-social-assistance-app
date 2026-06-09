-- Migration: add_post_type
-- Phase: Community Petitions
-- Adds post_type enum + petition_id FK to posts.
-- Depends on: 20260608000200_petitions_and_signatures.sql (petitions table must exist).
-- Idempotent — safe to re-run.

-- ============================================================
-- 1. post_type enum
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_type') THEN
    CREATE TYPE public.post_type AS ENUM ('feed', 'resource_post', 'petition');
  END IF;
END;
$$;

-- ============================================================
-- 2. Add post_type column to posts (default 'feed')
-- ============================================================
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type public.post_type NOT NULL DEFAULT 'feed';

-- ============================================================
-- 3. Add petition_id FK column
-- ============================================================
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS petition_id uuid
    REFERENCES public.petitions(id) ON DELETE CASCADE;

-- ============================================================
-- 4. Backfill existing resource-linked posts
--    Only set resource_post where resource_id IS NOT NULL so
--    existing rows without resource_id remain 'feed'.
-- ============================================================
UPDATE public.posts
SET post_type = 'resource_post'
WHERE resource_id IS NOT NULL
  AND post_type = 'feed';

-- ============================================================
-- 5. Petition consistency CHECK constraint
--    Invariant: post_type='petition' ⟺ petition_id IS NOT NULL
--    resource_id is NOT constrained here (existing inserts don't
--    set post_type, so resource_post check would break them).
--    The constraint is designed so ALL existing write paths remain
--    valid — they omit post_type (defaults to 'feed') and omit
--    petition_id (NULL), satisfying the second branch of the OR.
-- ============================================================
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_petition_consistency;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_petition_consistency
  CHECK (
    (post_type = 'petition' AND petition_id IS NOT NULL)
    OR
    (post_type <> 'petition' AND petition_id IS NULL)
  );

-- ============================================================
-- 6. Seed: create posts for the 2 seeded petitions
--    These are the petition post rows that appear in the feed.
-- ============================================================
INSERT INTO public.posts (
  id,
  user_id,
  content,
  post_type,
  petition_id,
  is_pinned,
  is_hidden
)
SELECT
  '9c495a2d-0d50-487a-8352-6b8f9c49c583',
  p.id,
  'Support Vermont Act 181 — Equitable Land Access for Mutual Aid. Add your verified signature of support.',
  'petition',
  '30f09104-6904-43c7-9d43-9e0c480ceaa5',
  true,
  false
FROM public.profiles p
WHERE p.is_staff = true
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.posts (
  id,
  user_id,
  content,
  post_type,
  petition_id,
  is_pinned,
  is_hidden
)
SELECT
  'c8a1e864-9b91-49d4-a8f6-b9c80d6aa2f9',
  p.id,
  'Expand Broadband Access for Rural Mutual Aid Networks. Add your verified signature of support.',
  'petition',
  '1dfe76a1-5dd4-4fd3-bdf1-2d60a7c7510a',
  false,
  false
FROM public.profiles p
WHERE p.is_staff = true
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- If no staff user exists, seed with NULL user_id (will be skipped if user_id NOT NULL)
-- The seed rows can also be inserted manually via Mgmt API if needed.
