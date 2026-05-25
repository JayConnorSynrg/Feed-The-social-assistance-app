-- Migration: add_notifications_tables
-- Adds notifications and reminders tables with RLS policies.
-- Uses CREATE TABLE IF NOT EXISTS and idempotent patterns so this
-- migration is safe to apply against a production instance.

-- ---------------------------------------------------------------------------
-- notification_type enum
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'status_update', 'deadline_reminder', 'action_required',
    'document_request', 'approval', 'denial', 'general'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  application_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (user_id) WHERE NOT is_read;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY notifications_select_own ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- System/edge-functions can insert notifications for any user
CREATE POLICY notifications_insert_system ON notifications FOR INSERT
  WITH CHECK (true);

-- Users can mark their own notifications as read
CREATE POLICY notifications_update_own ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY notifications_delete_own ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  remind_at TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reminders_user_id_idx ON reminders (user_id, remind_at);
CREATE INDEX IF NOT EXISTS reminders_upcoming_idx ON reminders (user_id, remind_at) WHERE NOT is_completed;

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Users can read their own reminders
CREATE POLICY reminders_select_own ON reminders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own reminders
CREATE POLICY reminders_insert_own ON reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reminders
CREATE POLICY reminders_update_own ON reminders FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own reminders
CREATE POLICY reminders_delete_own ON reminders FOR DELETE
  USING (auth.uid() = user_id);
