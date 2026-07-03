-- Close anon/non-admin read of federated_instances (metadata contains admin_email, city, state).
DROP POLICY IF EXISTS "Anyone can view active instances" ON public.federated_instances;

-- Admins get full SELECT (remote peers + metadata PII).
DROP POLICY IF EXISTS "Admins can view instances" ON public.federated_instances;
CREATE POLICY "Admins can view instances"
  ON public.federated_instances
  FOR SELECT TO public
  USING (public.is_current_user_admin());

-- Public federation discovery needs ONLY the local self-row (.well-known/feed-instance).
DROP POLICY IF EXISTS "Anyone can view local instance" ON public.federated_instances;
CREATE POLICY "Anyone can view local instance"
  ON public.federated_instances
  FOR SELECT TO public
  USING (is_local = TRUE AND status = 'active');
