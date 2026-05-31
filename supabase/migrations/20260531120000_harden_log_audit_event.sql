-- Migration: harden_log_audit_event
--
-- Purpose: pins search_path + least-privilege grants on log_audit_event.
-- Closes SECURITY DEFINER forgery surface: anon + authenticated roles could
-- previously call the unvalidated definer function and forge audit_log rows.
-- The function has zero app callers (verified via grep — only definition in
-- 20260215000000 and generated types), so the REVOKE is behavior-neutral.
-- Addresses Supabase advisor warning: function_search_path_mutable.

CREATE OR REPLACE FUNCTION public.log_audit_event(
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
  INSERT INTO public.audit_log (
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke broad execute grants introduced by 20260215000000.
-- The function is internal infrastructure: only service_role (edge functions,
-- server-side routes) should be able to call it.
REVOKE EXECUTE ON FUNCTION public.log_audit_event(uuid,text,text,text,text,text,text,jsonb,text,inet,text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.log_audit_event(uuid,text,text,text,text,text,text,jsonb,text,inet,text) TO service_role;
