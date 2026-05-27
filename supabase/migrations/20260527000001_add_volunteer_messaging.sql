-- Migration: Volunteer Resource Registration + Request-Gated Messaging
-- Feature: FAB for volunteer self-registration on map + P2P messaging with request gating

-- ============================================================
-- A1: Volunteer resource discriminator on existing resources table
-- ============================================================
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS is_volunteer_resource BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS resources_volunteer_idx
  ON public.resources (is_volunteer_resource)
  WHERE is_volunteer_resource = true;

-- ============================================================
-- A2: RPC to set PostGIS location by resource ID
-- (Existing set_resource_location() matches by external_id+source — unusable for volunteer resources)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_resource_location_by_id(
  p_id  UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.resources
  SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  WHERE id = p_id;
$$;

-- ============================================================
-- A3: Conversations table with request-gating
-- ============================================================
DO $$ BEGIN
  CREATE TYPE conversation_status AS ENUM ('pending', 'active', 'declined', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.conversations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id   UUID        NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  volunteer_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        conversation_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_different_users CHECK (volunteer_id <> requester_id)
);

-- THE KEY CONSTRAINT: max 1 pending request per volunteer at a time (DB-enforced)
CREATE UNIQUE INDEX IF NOT EXISTS conversations_volunteer_pending_uniq
  ON public.conversations (volunteer_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS conversations_volunteer_idx
  ON public.conversations (volunteer_id, status);
CREATE INDEX IF NOT EXISTS conversations_requester_idx
  ON public.conversations (requester_id, status);
CREATE INDEX IF NOT EXISTS conversations_resource_idx
  ON public.conversations (resource_id);

-- ============================================================
-- A4: Messages table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  is_read         BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx
  ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_unread_idx
  ON public.messages (conversation_id)
  WHERE NOT is_read;

-- ============================================================
-- A5: RLS — conversations
-- ============================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_select_participants
  ON public.conversations FOR SELECT
  USING (auth.uid() IN (volunteer_id, requester_id));

CREATE POLICY conversations_insert_requester
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY conversations_update_participants
  ON public.conversations FOR UPDATE
  USING (auth.uid() IN (volunteer_id, requester_id));

-- ============================================================
-- A6: RLS — messages
-- ============================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select_participants
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND auth.uid() IN (c.volunteer_id, c.requester_id)
    )
  );

CREATE POLICY messages_insert_participants
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND auth.uid() IN (c.volunteer_id, c.requester_id)
        AND c.status IN ('pending', 'active')
    )
  );

CREATE POLICY messages_update_read
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND auth.uid() IN (c.volunteer_id, c.requester_id)
    )
  );

-- ============================================================
-- A7: Triggers
-- ============================================================
CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- A8: Enable realtime for conversations and messages
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
