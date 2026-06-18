-- Post Wizard Types: extend post_type enum, add metadata, create polls tables, petition draft RLS
-- Migration applied: 2026-06-18

-- 1. Extend post_type enum (4 new values)
DO $$ BEGIN
  ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'seeker_request' AFTER 'feed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'source_offer' AFTER 'seeker_request';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'event_post' AFTER 'source_offer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.post_type ADD VALUE IF NOT EXISTS 'poll' AFTER 'event_post';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add metadata column to posts (type-specific structured data)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3. Create polls table (1:1 with poll posts)
CREATE TABLE IF NOT EXISTS public.polls (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID        NOT NULL UNIQUE REFERENCES public.posts(id) ON DELETE CASCADE,
  question    TEXT        NOT NULL CHECK (char_length(question) BETWEEN 3 AND 300),
  options     TEXT[]      NOT NULL CHECK (array_length(options, 1) BETWEEN 2 AND 6),
  closes_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create poll_votes table (single-choice enforced by UNIQUE)
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      UUID        NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  voter_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice_index INTEGER     NOT NULL CHECK (choice_index >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_id, voter_id)
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS polls_post_id_idx ON public.polls(post_id);
CREATE INDEX IF NOT EXISTS poll_votes_poll_id_idx ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS poll_votes_voter_id_idx ON public.poll_votes(voter_id);

-- 6. RLS for polls
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "polls_select_authenticated" ON public.polls;
CREATE POLICY "polls_select_authenticated" ON public.polls
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "polls_insert_post_author" ON public.polls;
CREATE POLICY "polls_insert_post_author" ON public.polls
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.user_id = auth.uid()
    )
  );

-- 7. RLS for poll_votes
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poll_votes_select_authenticated" ON public.poll_votes;
CREATE POLICY "poll_votes_select_authenticated" ON public.poll_votes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "poll_votes_insert_own" ON public.poll_votes;
CREATE POLICY "poll_votes_insert_own" ON public.poll_votes
  FOR INSERT TO authenticated
  WITH CHECK (voter_id = auth.uid());

DROP POLICY IF EXISTS "poll_votes_delete_own" ON public.poll_votes;
CREATE POLICY "poll_votes_delete_own" ON public.poll_votes
  FOR DELETE TO authenticated
  USING (voter_id = auth.uid());

-- 8. Petition draft RLS
DROP POLICY IF EXISTS "petitions_insert_own_draft" ON public.petitions;
CREATE POLICY "petitions_insert_own_draft" ON public.petitions
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND status = 'draft');

DROP POLICY IF EXISTS "petitions_select_own" ON public.petitions;
CREATE POLICY "petitions_select_own" ON public.petitions
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());
