-- 20261015000000_p4b_organizations.sql
-- P4b — informational organizations data plane.
--
-- Generalizes the p4a business plane to non-business informational organizations
-- (community groups, nonprofits, government). Non-business orgs are public the moment
-- they are is_active (no approval gate) per orgs_select_active — this migration extends
-- that same visibility rule to their child rows and adds an org->resources link table.
--
-- Migration order (5-step): (1) no new extensions; (2) core-table CHECK widening;
-- (3) org_resources junction table + RLS; (4) child-policy widening + map RPC;
-- (5) ledger row. Everything runs in ONE transaction; the schema_migrations ledger
-- row is written in the SAME transaction (atomic apply-or-nothing, mirroring 20261012/14).
--
-- INVARIANTS (proven in the accompanying derivation table):
--   INV-1  child visibility tracks parent, both directions (active non-business => children
--          public; inactive => children hidden), for hours/services/photos AND org_resources.
--   INV-2  NO business regression: an approved+active business keeps exactly today's public
--          children; a pending/rejected/inactive business's children stay non-public.
--   INV-3  org<->resources many-to-many: (org_id,resource_id) PK unique; org delete and
--          resource delete both cascade the link; public reads a link iff the org is publicly
--          visible; only admins write links.
--   INV-4  organizations_in_bounds returns ONLY publicly-visible NON-business orgs in bbox,
--          mirroring businesses_in_bounds hardening exactly.
--   INV-5  no new advisor debt: policies avoid bare auth.uid() (none needed here); both
--          org_resources FKs are index-covered; child widening EDITS the single permissive
--          policy (ALTER POLICY), never adds a parallel one.
--   INV-6  additive org_type: CHECK gains 'community','nonprofit','government' with every
--          prior value retained; existing rows unaffected.

BEGIN;

-- ---------------------------------------------------------------------------
-- (2) INV-6 — core-table CHECK widening (additive).
--     org_type is governed by a CHECK constraint (not a Postgres enum), so we replace
--     the constraint. Every value from 20261012000000 is retained and three informational
--     types are appended. No existing row can violate the widened set => no backfill, no
--     validation failure.
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations DROP CONSTRAINT organizations_org_type_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_org_type_check
  CHECK (org_type = ANY (ARRAY[
    'food_bank','pantry','shelter','clinic','mutual_aid','other','business',
    'community','nonprofit','government'
  ]::text[]));

-- ---------------------------------------------------------------------------
-- (3) INV-3 — org_resources junction table (org <-> resources many-to-many).
--     Composite PK (org_id, resource_id) enforces one link per pair and provides the
--     covering index for org_id-keyed lookups; a dedicated index covers the resource_id
--     FK (INV-5 unindexed_foreign_keys). Both FKs ON DELETE CASCADE so deleting an org
--     or a resource removes only its link rows (never the counterpart entity).
-- ---------------------------------------------------------------------------
CREATE TABLE public.org_resources (
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id)     ON DELETE CASCADE,
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, resource_id)
);
-- PK (org_id, resource_id) already covers org_id lookups; index the reverse FK.
CREATE INDEX org_resources_resource_id_idx ON public.org_resources(resource_id);

-- RLS — public read tracks org visibility; only admins write (mirrors business_photos idiom).
ALTER TABLE public.org_resources ENABLE ROW LEVEL SECURITY;

-- SELECT + admin write grants at the table layer; RLS narrows writes to admins only.
GRANT SELECT ON public.org_resources TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.org_resources TO authenticated;

-- Public/anon read a link iff its parent org is publicly visible (orgs_select_active
-- predicate, verbatim). A hidden org's links are invisible; a business's links follow
-- the same approved+active rule as everything else.
CREATE POLICY org_resources_public_select ON public.org_resources
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = org_resources.org_id
      AND o.is_active = true
      AND (o.org_type <> 'business' OR o.status = 'approved')
  ));
-- Only platform admins write links (USING + WITH CHECK), mirroring business_photos_admin_all.
CREATE POLICY org_resources_admin_all ON public.org_resources
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- ---------------------------------------------------------------------------
-- (4a) INV-1 / INV-2 — widen the three child public-read policies so child visibility
--      EXACTLY equals parent visibility (orgs_select_active predicate). Business rows
--      still require status='approved' (no regression); non-business rows are public on
--      is_active alone. ALTER POLICY edits the single permissive policy in place — no
--      parallel policy is added (INV-5 multiple_permissive_policies). owner_all + admin_all
--      on each table are left untouched.
-- ---------------------------------------------------------------------------
ALTER POLICY business_hours_public_select ON public.business_hours
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = business_hours.org_id
      AND o.is_active = true
      AND (o.org_type <> 'business' OR o.status = 'approved')
  ));

ALTER POLICY business_services_public_select ON public.business_services
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = business_services.org_id
      AND o.is_active = true
      AND (o.org_type <> 'business' OR o.status = 'approved')
  ));

ALTER POLICY business_photos_public_select ON public.business_photos
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = business_photos.org_id
      AND o.is_active = true
      AND (o.org_type <> 'business' OR o.status = 'approved')
  ));

-- ---------------------------------------------------------------------------
-- (4b) INV-4 — organizations_in_bounds bbox reader for publicly-visible NON-business orgs.
--      Mirrors businesses_in_bounds VERBATIM (sql STABLE SECURITY DEFINER, pinned
--      search_path incl. extensions for PostGIS operators, same column shape, same grants)
--      except the predicate: is_active + org_type<>'business' (no status gate for
--      informational orgs, matching orgs_select_active) + location present + bbox overlap.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organizations_in_bounds(
  min_lng double precision, min_lat double precision,
  max_lng double precision, max_lat double precision,
  max_results integer DEFAULT 500)
 RETURNS TABLE(
   id uuid, name text, description text, org_type text,
   address text, city text, state text, phone text, website text,
   location geography, resource_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $fn$
  SELECT id, name, description, org_type, address, city, state, phone, website, location, resource_id
  FROM organizations
  WHERE is_active = true AND org_type <> 'business' AND location IS NOT NULL
    AND location::geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  ORDER BY name
  LIMIT max_results;
$fn$;

REVOKE EXECUTE ON FUNCTION public.organizations_in_bounds(double precision, double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organizations_in_bounds(double precision, double precision, double precision, double precision, integer) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261015000000', 'p4b_organizations');

COMMIT;
