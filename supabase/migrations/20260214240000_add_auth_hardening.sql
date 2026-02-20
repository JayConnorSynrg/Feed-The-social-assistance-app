-- Migration: Auth Hardening - Account Lockout, Session Management, Password History
-- Description: Implements server-side authentication security including brute-force protection,
--              session tracking, and password policy enforcement

-- ============================================================================
-- 1. Failed Login Attempt Tracking
-- ============================================================================

-- Track all login attempts (success and failure) for security audit
CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookups by email and IP within time windows
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON auth_login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON auth_login_attempts(ip_address, created_at DESC);

-- Enable RLS (no user policies - service role only)
ALTER TABLE auth_login_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE auth_login_attempts IS 'Audit log of all login attempts for security monitoring and brute-force detection';
COMMENT ON COLUMN auth_login_attempts.failure_reason IS 'Reason for failure: invalid_credentials, account_locked, rate_limited, etc.';

-- ============================================================================
-- 2. Account Lockout Management
-- ============================================================================

-- Track accounts that are currently locked out
CREATE TABLE IF NOT EXISTS account_lockouts (
  email TEXT PRIMARY KEY,
  locked_until TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER DEFAULT 0,
  lockout_level INTEGER DEFAULT 1, -- Progressive lockout: 1 = 15min, 2 = 1hr, 3 = 24hr
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_lockouts_locked_until ON account_lockouts(locked_until);

-- Enable RLS (no user policies - service role only)
ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE account_lockouts IS 'Active account lockouts due to repeated failed login attempts';
COMMENT ON COLUMN account_lockouts.lockout_level IS 'Progressive lockout level: 1=15min, 2=1hr, 3=24hr';

-- ============================================================================
-- 3. User Session Tracking
-- ============================================================================

-- Track active user sessions for "active sessions" UI and security monitoring
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_token TEXT, -- Hashed version of session token for lookup
  device_info TEXT,   -- Browser/OS info from User-Agent
  ip_address INET,
  location_info JSONB, -- City, country (from IP geolocation if available)
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_current BOOLEAN DEFAULT false,
  CONSTRAINT unique_session_token UNIQUE(session_token)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions(last_active_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
DROP POLICY IF EXISTS "Users view own sessions" ON user_sessions;
CREATE POLICY "Users view own sessions" ON user_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own sessions (to revoke)
DROP POLICY IF EXISTS "Users delete own sessions" ON user_sessions;
CREATE POLICY "Users delete own sessions" ON user_sessions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Only service role can create sessions
DROP POLICY IF EXISTS "Service role manages sessions" ON user_sessions;
CREATE POLICY "Service role manages sessions" ON user_sessions
  FOR INSERT
  WITH CHECK (false); -- Only service role can insert (no RLS for service role)

COMMENT ON TABLE user_sessions IS 'Tracks active user sessions for security and session management UI';
COMMENT ON COLUMN user_sessions.is_current IS 'Marks the current session (for UI highlighting)';

-- ============================================================================
-- 4. Password History (Prevent Reuse)
-- ============================================================================

-- Store hashed versions of previous passwords to prevent reuse
CREATE TABLE IF NOT EXISTS password_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  password_hash TEXT NOT NULL, -- Bcrypt/Argon2 hash of old password
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id, created_at DESC);

-- Enable RLS (no user policies - service role only)
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE password_history IS 'Stores hashed previous passwords to prevent reuse (last 5 passwords)';

-- ============================================================================
-- 5. Cleanup Functions
-- ============================================================================

-- Function to clean up old login attempts (keep 30 days for audit)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM auth_login_attempts
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

COMMENT ON FUNCTION cleanup_old_login_attempts IS 'Removes login attempt records older than 30 days';

-- Function to clean up expired lockouts
CREATE OR REPLACE FUNCTION cleanup_expired_lockouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM account_lockouts
  WHERE locked_until < NOW();
END;
$$;

COMMENT ON FUNCTION cleanup_expired_lockouts IS 'Removes expired account lockouts';

-- Function to clean up inactive sessions (30 days of inactivity)
CREATE OR REPLACE FUNCTION cleanup_inactive_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM user_sessions
  WHERE last_active_at < NOW() - INTERVAL '30 days';
END;
$$;

COMMENT ON FUNCTION cleanup_inactive_sessions IS 'Removes sessions inactive for more than 30 days';

-- Function to enforce password history limit (keep last 5 passwords per user)
CREATE OR REPLACE FUNCTION enforce_password_history_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Keep only the 5 most recent passwords for this user
  DELETE FROM password_history
  WHERE user_id = NEW.user_id
  AND id NOT IN (
    SELECT id FROM password_history
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    LIMIT 5
  );
  RETURN NEW;
END;
$$;

-- Trigger to enforce password history limit after each insert
DROP TRIGGER IF EXISTS trigger_enforce_password_history_limit ON password_history;
CREATE TRIGGER trigger_enforce_password_history_limit
  AFTER INSERT ON password_history
  FOR EACH ROW
  EXECUTE FUNCTION enforce_password_history_limit();

-- ============================================================================
-- 6. Helper Functions for Auth Guard Edge Function
-- ============================================================================

-- Function to check if an email is currently locked out
CREATE OR REPLACE FUNCTION is_account_locked(p_email TEXT)
RETURNS TABLE(
  is_locked BOOLEAN,
  locked_until TIMESTAMPTZ,
  lockout_level INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First, clean up any expired lockouts for this email
  DELETE FROM account_lockouts
  WHERE email = p_email
  AND locked_until < NOW();

  -- Check if still locked
  RETURN QUERY
  SELECT
    TRUE,
    l.locked_until,
    l.lockout_level
  FROM account_lockouts l
  WHERE l.email = p_email
  AND l.locked_until > NOW();

  -- If no lockout found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0;
  END IF;
END;
$$;

COMMENT ON FUNCTION is_account_locked IS 'Checks if an account is currently locked out and returns lockout details';

-- Grant execute permissions to authenticated users (via Edge Function with service role)
GRANT EXECUTE ON FUNCTION is_account_locked TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cleanup_old_login_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_lockouts TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_inactive_sessions TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Notes:
-- 1. These tables are managed exclusively by Edge Functions using service role
-- 2. No direct user access prevents tampering with security data
-- 3. Cleanup functions should be called periodically (via cron or scheduled Edge Function)
-- 4. Progressive lockout prevents both credential stuffing and brute force attacks
