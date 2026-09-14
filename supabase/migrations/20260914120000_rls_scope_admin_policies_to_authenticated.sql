-- 20260914120000_rls_scope_admin_policies_to_authenticated.sql
--
-- PURPOSE (LIVE PROD OUTAGE FIX)
--   anon LACKS EXECUTE on public.is_current_user_admin(), public.is_org_admin(uuid),
--   and public.is_org_member(uuid). Any RLS policy scoped TO public (which anon inherits)
--   whose predicate invokes one of these functions raises 42501 "permission denied for
--   function" for anon on that command. Because permissive SELECT policies are OR-combined
--   and the function branch is still evaluated, guest (anon) reads of `resources`,
--   `event_occurrences`, and other tables fail entirely.
--
-- INVARIANT ENFORCED
--   No SELECT/ALL policy reachable by anon may invoke an admin/member-only function.
--   Every admin-only policy is re-scoped TO authenticated (so anon's applicable-policy set
--   never contains the function) and wraps is_current_user_admin() as
--   (select public.is_current_user_admin()). Every existing plain-predicate public SELECT
--   policy is preserved untouched. Per role (anon / authenticated-non-admin /
--   authenticated-admin) the row set is IDENTICAL before and after -- the only behavioral
--   change is that anon stops receiving 42501 and instead sees exactly the rows its
--   plain-predicate public SELECT policies already grant (0 rows where none apply).
--
-- SCOPE NOTE
--   The literal task named is_current_user_admin. is_org_admin / is_org_member are the SAME
--   class of anon-EXECUTE hole and are the reason event_occurrences / event_checkins /
--   organization_members ALSO 42501 for anon. They are re-scoped here too because the
--   Events outage is NOT resolved without them. See the review DERIVATION TABLE.
--
-- ATOMICITY
--   The entire migration runs in one transaction. RLS/DDL changes are invisible to other
--   sessions until COMMIT, so there is no window where a legitimate row becomes unreadable.
--   All DROPs are idempotent (IF EXISTS). ALL policies are split into explicit
--   SELECT/INSERT/UPDATE/DELETE with identical predicates.

BEGIN;

-- =====================================================================================
-- assistance_events -- events_all_is_admin (ALL, {public}) -> split, TO authenticated
--   Preserved public read: events_select_active USING (is_active = true)
-- =====================================================================================
DROP POLICY IF EXISTS events_all_is_admin ON public.assistance_events;

CREATE POLICY events_admin_select ON public.assistance_events
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));
CREATE POLICY events_admin_insert ON public.assistance_events
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY events_admin_update ON public.assistance_events
  FOR UPDATE TO authenticated
  USING ((select public.is_current_user_admin()))
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY events_admin_delete ON public.assistance_events
  FOR DELETE TO authenticated
  USING ((select public.is_current_user_admin()));

-- =====================================================================================
-- community_stats -- INSERT/UPDATE admin policies (no anon SELECT impact; re-scoped)
--   Preserved public read: community_stats_select_public USING (true)
-- =====================================================================================
DROP POLICY IF EXISTS community_stats_insert_admin ON public.community_stats;
DROP POLICY IF EXISTS community_stats_update_admin ON public.community_stats;

CREATE POLICY community_stats_insert_admin ON public.community_stats
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY community_stats_update_admin ON public.community_stats
  FOR UPDATE TO authenticated
  USING ((select public.is_current_user_admin()));

-- =====================================================================================
-- event_checkins -- admin SELECT + org-admin SELECT + admin/org UPDATE
--   Preserved public read: checkins_select_own USING (user_id = auth.uid())
-- =====================================================================================
DROP POLICY IF EXISTS checkins_select_admin ON public.event_checkins;
DROP POLICY IF EXISTS checkins_select_org_admin ON public.event_checkins;
DROP POLICY IF EXISTS checkins_update_admin ON public.event_checkins;

CREATE POLICY checkins_select_admin ON public.event_checkins
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));
CREATE POLICY checkins_select_org_admin ON public.event_checkins
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
     FROM (event_occurrences eo
       JOIN assistance_events ae ON ((ae.id = eo.event_id)))
    WHERE ((eo.id = event_checkins.occurrence_id) AND is_org_admin(ae.org_id)))));
CREATE POLICY checkins_update_admin ON public.event_checkins
  FOR UPDATE TO authenticated
  USING (((select public.is_current_user_admin()) OR (EXISTS ( SELECT 1
     FROM (event_occurrences eo
       JOIN assistance_events ae ON ((ae.id = eo.event_id)))
    WHERE ((eo.id = event_checkins.occurrence_id) AND is_org_admin(ae.org_id))))));

-- =====================================================================================
-- event_occurrences -- occurrences_all_is_admin (ALL) + occurrences_manage_org_admin (ALL)
--   Both re-scoped/split TO authenticated. THIS RESOLVES THE GUEST EVENTS OUTAGE:
--   after this, anon's only applicable SELECT policy is the preserved plain-predicate
--   occurrences_select_active_event (no function call -> no 42501).
--   Preserved public read: occurrences_select_active_event
-- =====================================================================================
DROP POLICY IF EXISTS occurrences_all_is_admin ON public.event_occurrences;
DROP POLICY IF EXISTS occurrences_manage_org_admin ON public.event_occurrences;

-- global admin (split ALL)
CREATE POLICY occurrences_admin_select ON public.event_occurrences
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));
CREATE POLICY occurrences_admin_insert ON public.event_occurrences
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY occurrences_admin_update ON public.event_occurrences
  FOR UPDATE TO authenticated
  USING ((select public.is_current_user_admin()))
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY occurrences_admin_delete ON public.event_occurrences
  FOR DELETE TO authenticated
  USING ((select public.is_current_user_admin()));

-- org admin (split ALL; predicate preserved verbatim)
CREATE POLICY occurrences_org_admin_select ON public.event_occurrences
  FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
     FROM assistance_events ae
    WHERE ((ae.id = event_occurrences.event_id) AND is_org_admin(ae.org_id)))));
CREATE POLICY occurrences_org_admin_insert ON public.event_occurrences
  FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
     FROM assistance_events ae
    WHERE ((ae.id = event_occurrences.event_id) AND is_org_admin(ae.org_id)))));
CREATE POLICY occurrences_org_admin_update ON public.event_occurrences
  FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
     FROM assistance_events ae
    WHERE ((ae.id = event_occurrences.event_id) AND is_org_admin(ae.org_id)))))
  WITH CHECK ((EXISTS ( SELECT 1
     FROM assistance_events ae
    WHERE ((ae.id = event_occurrences.event_id) AND is_org_admin(ae.org_id)))));
CREATE POLICY occurrences_org_admin_delete ON public.event_occurrences
  FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
     FROM assistance_events ae
    WHERE ((ae.id = event_occurrences.event_id) AND is_org_admin(ae.org_id)))));

-- =====================================================================================
-- federated_instances -- "Only admins can manage instances" (ALL) + "Admins can view
--   instances" (SELECT). SELECT is provided by the dedicated view policy, so the manage
--   policy is split into INSERT/UPDATE/DELETE only (no redundant admin SELECT).
--   Preserved public read: "Anyone can view local instance"
-- =====================================================================================
DROP POLICY IF EXISTS "Only admins can manage instances" ON public.federated_instances;
DROP POLICY IF EXISTS "Admins can view instances" ON public.federated_instances;

CREATE POLICY "Admins can view instances" ON public.federated_instances
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));
CREATE POLICY "Admins can insert instances" ON public.federated_instances
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY "Admins can update instances" ON public.federated_instances
  FOR UPDATE TO authenticated
  USING ((select public.is_current_user_admin()))
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY "Admins can delete instances" ON public.federated_instances
  FOR DELETE TO authenticated
  USING ((select public.is_current_user_admin()));

-- =====================================================================================
-- federation_health_checks -- admin SELECT (no plain public read exists; admin-only table)
-- =====================================================================================
DROP POLICY IF EXISTS "Admins can view health checks" ON public.federation_health_checks;

CREATE POLICY "Admins can view health checks" ON public.federation_health_checks
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));

-- =====================================================================================
-- federation_peers -- "Only admins can manage peers" (ALL) -> split (SELECT included:
--   no dedicated admin read; admins must see disabled peers).
--   Preserved public read: "Anyone can view enabled federation peers"
-- =====================================================================================
DROP POLICY IF EXISTS "Only admins can manage peers" ON public.federation_peers;

CREATE POLICY "Admins can view peers" ON public.federation_peers
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));
CREATE POLICY "Admins can insert peers" ON public.federation_peers
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY "Admins can update peers" ON public.federation_peers
  FOR UPDATE TO authenticated
  USING ((select public.is_current_user_admin()))
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY "Admins can delete peers" ON public.federation_peers
  FOR DELETE TO authenticated
  USING ((select public.is_current_user_admin()));

-- =====================================================================================
-- federation_sync_log / federation_trust_events / federation_webhook_log -- admin SELECT
--   (admin-only tables; no plain public read)
-- =====================================================================================
DROP POLICY IF EXISTS "Admins can view sync logs" ON public.federation_sync_log;
CREATE POLICY "Admins can view sync logs" ON public.federation_sync_log
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));

DROP POLICY IF EXISTS "Admins can view trust events" ON public.federation_trust_events;
CREATE POLICY "Admins can view trust events" ON public.federation_trust_events
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));

DROP POLICY IF EXISTS "Admins can view webhook logs" ON public.federation_webhook_log;
CREATE POLICY "Admins can view webhook logs" ON public.federation_webhook_log
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));

-- =====================================================================================
-- form_submissions -- admin SELECT + admin UPDATE
--   Preserved public read: "Users can view their own submissions" USING (auth.uid()=user_id)
-- =====================================================================================
DROP POLICY IF EXISTS form_submissions_admin_select ON public.form_submissions;
DROP POLICY IF EXISTS form_submissions_admin_update ON public.form_submissions;

CREATE POLICY form_submissions_admin_select ON public.form_submissions
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));
CREATE POLICY form_submissions_admin_update ON public.form_submissions
  FOR UPDATE TO authenticated
  USING ((select public.is_current_user_admin()));

-- =====================================================================================
-- form_templates -- "Admins can manage form templates" (ALL) -> split (SELECT included:
--   admins see inactive templates) + explicit admin insert/update/delete already present.
--   Preserved public read: "Form templates are viewable by everyone" USING (is_active=true)
-- =====================================================================================
DROP POLICY IF EXISTS "Admins can manage form templates" ON public.form_templates;
DROP POLICY IF EXISTS form_templates_admin_delete ON public.form_templates;
DROP POLICY IF EXISTS form_templates_admin_insert ON public.form_templates;
DROP POLICY IF EXISTS form_templates_admin_update ON public.form_templates;

CREATE POLICY "Admins can manage form templates" ON public.form_templates
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));
CREATE POLICY form_templates_admin_insert ON public.form_templates
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY form_templates_admin_update ON public.form_templates
  FOR UPDATE TO authenticated
  USING ((select public.is_current_user_admin()));
CREATE POLICY form_templates_admin_delete ON public.form_templates
  FOR DELETE TO authenticated
  USING ((select public.is_current_user_admin()));

-- =====================================================================================
-- organization_members -- admin/org-admin write policies + org-member SELECT
--   org_members_select_own_or_org calls is_org_member (anon lacks EXECUTE) -> re-scoped.
--   No plain public read; anon legitimately sees 0 rows (auth.uid() null / not a member).
-- =====================================================================================
DROP POLICY IF EXISTS org_members_select_own_or_org ON public.organization_members;
DROP POLICY IF EXISTS org_members_delete_admin ON public.organization_members;
DROP POLICY IF EXISTS org_members_insert_admin ON public.organization_members;
DROP POLICY IF EXISTS org_members_update_admin ON public.organization_members;

CREATE POLICY org_members_select_own_or_org ON public.organization_members
  FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR is_org_member(org_id)));
CREATE POLICY org_members_insert_admin ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (((select public.is_current_user_admin()) OR is_org_admin(org_id)));
CREATE POLICY org_members_update_admin ON public.organization_members
  FOR UPDATE TO authenticated
  USING (((select public.is_current_user_admin()) OR is_org_admin(org_id)))
  WITH CHECK (((select public.is_current_user_admin()) OR is_org_admin(org_id)));
CREATE POLICY org_members_delete_admin ON public.organization_members
  FOR DELETE TO authenticated
  USING (((select public.is_current_user_admin()) OR is_org_admin(org_id)));

-- =====================================================================================
-- organizations -- orgs_all_is_admin (ALL) -> split (SELECT included: admins see inactive)
--   Preserved public read: orgs_select_active USING (is_active = true)
-- =====================================================================================
DROP POLICY IF EXISTS orgs_all_is_admin ON public.organizations;

CREATE POLICY orgs_admin_select ON public.organizations
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));
CREATE POLICY orgs_admin_insert ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY orgs_admin_update ON public.organizations
  FOR UPDATE TO authenticated
  USING ((select public.is_current_user_admin()))
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY orgs_admin_delete ON public.organizations
  FOR DELETE TO authenticated
  USING ((select public.is_current_user_admin()));

-- =====================================================================================
-- resource_opt_ins -- opt_ins_select / opt_ins_update / opt_ins_delete (user OR admin)
--   Predicates preserved verbatim; anon (auth.uid() null) legitimately sees 0 rows.
-- =====================================================================================
DROP POLICY IF EXISTS opt_ins_select ON public.resource_opt_ins;
DROP POLICY IF EXISTS opt_ins_update ON public.resource_opt_ins;
DROP POLICY IF EXISTS opt_ins_delete ON public.resource_opt_ins;

CREATE POLICY opt_ins_select ON public.resource_opt_ins
  FOR SELECT TO authenticated
  USING (((seeker_id = auth.uid()) OR (EXISTS ( SELECT 1
     FROM posts p
    WHERE ((p.id = resource_opt_ins.post_id) AND (p.user_id = auth.uid())))) OR (select public.is_current_user_admin())));
CREATE POLICY opt_ins_update ON public.resource_opt_ins
  FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
     FROM posts p
    WHERE ((p.id = resource_opt_ins.post_id) AND (p.user_id = auth.uid())))) OR (select public.is_current_user_admin())))
  WITH CHECK (((EXISTS ( SELECT 1
     FROM posts p
    WHERE ((p.id = resource_opt_ins.post_id) AND (p.user_id = auth.uid())))) OR (select public.is_current_user_admin())));
CREATE POLICY opt_ins_delete ON public.resource_opt_ins
  FOR DELETE TO authenticated
  USING (((seeker_id = auth.uid()) OR (select public.is_current_user_admin())));

-- =====================================================================================
-- resources -- "Admins can manage all resources" (ALL) -> split (SELECT included:
--   admins see non-approved). THIS RESOLVES THE GUEST FEED OUTAGE: after this, anon's
--   applicable SELECT policies are the preserved plain-predicate reads only.
--   Preserved public reads: "Approved resources are viewable by everyone"
--     USING (status = 'approved'), "Users can view their own pending submissions"
-- =====================================================================================
DROP POLICY IF EXISTS "Admins can manage all resources" ON public.resources;

CREATE POLICY resources_admin_select ON public.resources
  FOR SELECT TO authenticated
  USING ((select public.is_current_user_admin()));
CREATE POLICY resources_admin_insert ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY resources_admin_update ON public.resources
  FOR UPDATE TO authenticated
  USING ((select public.is_current_user_admin()))
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY resources_admin_delete ON public.resources
  FOR DELETE TO authenticated
  USING ((select public.is_current_user_admin()));

-- =====================================================================================
-- reviews -- reviews_select / reviews_update / reviews_delete (participant OR admin)
--   No plain public read exists (reviews are participant/admin-only); predicates verbatim.
-- =====================================================================================
DROP POLICY IF EXISTS reviews_select ON public.reviews;
DROP POLICY IF EXISTS reviews_update ON public.reviews;
DROP POLICY IF EXISTS reviews_delete ON public.reviews;

CREATE POLICY reviews_select ON public.reviews
  FOR SELECT TO authenticated
  USING (((reviewer_id = auth.uid()) OR (reviewee_id = auth.uid()) OR (select public.is_current_user_admin())));
CREATE POLICY reviews_update ON public.reviews
  FOR UPDATE TO authenticated
  USING (((reviewer_id = auth.uid()) OR (select public.is_current_user_admin())))
  WITH CHECK (((reviewer_id = auth.uid()) OR (select public.is_current_user_admin())));
CREATE POLICY reviews_delete ON public.reviews
  FOR DELETE TO authenticated
  USING (((reviewer_id = auth.uid()) OR (select public.is_current_user_admin())));

-- =====================================================================================
-- snap_retailers -- admin INSERT/UPDATE (no anon SELECT impact; re-scoped)
--   Preserved public read: snap_retailers_select_public USING (true)
-- =====================================================================================
DROP POLICY IF EXISTS snap_retailers_admin_insert ON public.snap_retailers;
DROP POLICY IF EXISTS snap_retailers_admin_update ON public.snap_retailers;

CREATE POLICY snap_retailers_admin_insert ON public.snap_retailers
  FOR INSERT TO authenticated
  WITH CHECK ((select public.is_current_user_admin()));
CREATE POLICY snap_retailers_admin_update ON public.snap_retailers
  FOR UPDATE TO authenticated
  USING ((select public.is_current_user_admin()));

-- =====================================================================================
-- Close the anon-EXECUTE hole on the admin-only safety-alert verification function.
--   Live acl showed an explicit anon=X grant. authenticated retains EXECUTE.
-- =====================================================================================
REVOKE EXECUTE ON FUNCTION public.admin_verify_safety_alert(p_alert_id uuid) FROM anon;

COMMIT;
