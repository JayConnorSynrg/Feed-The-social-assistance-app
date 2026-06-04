-- Migration: add resource_id FK to posts
-- Phase B: resource-linked posts
-- Additive/idempotent: IF NOT EXISTS guards safe for re-run

-- 1. Add nullable FK column
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL;

-- 2. Index to support "posts about this resource" query
CREATE INDEX IF NOT EXISTS idx_posts_resource_id ON public.posts(resource_id);
