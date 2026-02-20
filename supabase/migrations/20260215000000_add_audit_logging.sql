-- Audit Logging System
-- Provides immutable audit trail for security-relevant events
-- Required for SOC 2 and HIPAA compliance

-- ============================================
-- Audit Log Table
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Who
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,

  -- What
  event_type TEXT NOT NULL,        -- 'vault.unlock', 'vault.lock', 'data.decrypt', etc.
  event_category TEXT NOT NULL,    -- 'auth', 'vault', 'encryption', 'mfa', etc.
  severity TEXT DEFAULT 'info',    -- 'info', 'warning', 'critical'

  -- Details
  resource_type TEXT,              -- 'secure_profile', 'form_submission', 'document', etc.
  resource_id TEXT,                -- ID of the resource accessed
  action TEXT NOT NULL,            -- 'read', 'create', 'update', 'delete', 'encrypt', 'decrypt', 'verify'
  details JSONB,                   -- Additional context (field names accessed, etc.)

  -- Immutability
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- No updated_at - audit logs are immutable
  -- No soft delete - audit logs are never deleted (only archived)

  CONSTRAINT valid_event_category CHECK (event_category IN ('auth', 'vault', 'encryption', 'mfa', 'document', 'profile', 'admin', 'system')),
  CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT valid_action CHECK (action IN ('read', 'create', 'update', 'delete', 'encrypt', 'decrypt', 'verify', 'setup', 'enroll', 'unenroll', 'upload', 'download', 'lock', 'unlock', 'change_password'))
);

-- ============================================
-- Indexes for Performance
-- ============================================
-- User timeline queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user_time ON audit_log(user_id, created_at DESC);

-- Event type filtering
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type, created_at DESC);

-- Category filtering
CREATE INDEX IF NOT EXISTS idx_audit_log_category ON audit_log(event_category, created_at DESC);

-- Security monitoring (warnings and critical events)
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON audit_log(severity, created_at DESC)
  WHERE severity IN ('warning', 'critical');

-- Resource access tracking
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id, created_at DESC)
  WHERE resource_type IS NOT NULL AND resource_id IS NOT NULL;

-- Session tracking
CREATE INDEX IF NOT EXISTS idx_audit_log_session ON audit_log(session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

-- IP-based analysis
CREATE INDEX IF NOT EXISTS idx_audit_log_ip ON audit_log(ip_address, created_at DESC)
  WHERE ip_address IS NOT NULL;

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit log
DROP POLICY IF EXISTS "Users view own audit log" ON audit_log;
CREATE POLICY "Users view own audit log" ON audit_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins view all audit logs (check via profiles.is_admin)
DROP POLICY IF EXISTS "Admins view all audit logs" ON audit_log;
CREATE POLICY "Admins view all audit logs" ON audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Insert policy: authenticated users can log their own events
DROP POLICY IF EXISTS "Users insert own audit events" ON audit_log;
CREATE POLICY "Users insert own audit events" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert for system events
-- (No policy needed - service role bypasses RLS)

-- IMMUTABILITY: No update or delete policies
-- Audit logs cannot be modified or deleted by any user
-- Only archival by database administrators for compliance retention

-- ============================================
-- Helper Function: Log Audit Event
-- ============================================
-- Convenience function for logging audit events from SQL
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_category TEXT,
  p_action TEXT,
  p_severity TEXT DEFAULT 'info',
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO audit_log (
    user_id,
    event_type,
    event_category,
    severity,
    resource_type,
    resource_id,
    action,
    details,
    session_id,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_event_type,
    p_event_category,
    p_severity,
    p_resource_type,
    p_resource_id,
    p_action,
    p_details,
    p_session_id,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;

-- ============================================
-- Comments for Documentation
-- ============================================
COMMENT ON TABLE audit_log IS 'Immutable audit trail for security-relevant events. Required for SOC 2 and HIPAA compliance.';
COMMENT ON COLUMN audit_log.user_id IS 'User who performed the action (NULL for system events)';
COMMENT ON COLUMN audit_log.event_type IS 'Specific event type (e.g., vault.unlock, data.decrypt)';
COMMENT ON COLUMN audit_log.event_category IS 'Event category for filtering (auth, vault, encryption, mfa, etc.)';
COMMENT ON COLUMN audit_log.severity IS 'Event severity: info, warning, or critical';
COMMENT ON COLUMN audit_log.action IS 'Action performed (read, create, update, delete, etc.)';
COMMENT ON COLUMN audit_log.details IS 'Additional context as JSON (field names, error details, etc.)';
COMMENT ON COLUMN audit_log.created_at IS 'Immutable timestamp of event occurrence';
