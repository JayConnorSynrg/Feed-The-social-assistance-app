-- Migration: add_device_tokens
-- Adds device_tokens table for FCM push notification registration.
-- Uses CREATE TABLE IF NOT EXISTS for idempotent application.

-- ---------------------------------------------------------------------------
-- device_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_tokens_user_id_idx ON device_tokens (user_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_device_tokens_updated_at ON device_tokens;
CREATE TRIGGER set_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read their own device tokens
CREATE POLICY device_tokens_select_own ON device_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Users can register their own device tokens
CREATE POLICY device_tokens_insert_own ON device_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own device tokens
CREATE POLICY device_tokens_update_own ON device_tokens FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can remove their own device tokens
CREATE POLICY device_tokens_delete_own ON device_tokens FOR DELETE
  USING (auth.uid() = user_id);
