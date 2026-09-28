-- ---------------------------------------------------------------------------
-- P4a W3 — Rich business profiles (schema foundation)
-- ---------------------------------------------------------------------------
-- Businesses are rows in public.organizations (org_type='business'). W1/W2 already
-- shipped zip_code + service_radius_miles (no DDL for them here). This migration adds
-- the remaining rich-profile scalar fields to organizations and three child tables
-- (business_hours / business_services / business_photos) that hold the repeating
-- profile data.
--
-- Photos live as ROWS in business_photos (kind logo|cover|gallery) with partial-unique
-- indexes rather than scalar org columns: a scalar logo/cover column would require a new
-- member UPDATE policy on organizations, reopening the p4a approval-forge surface. Members
-- have INSERT+SELECT but intentionally NO UPDATE on organizations (load-bearing) — child
-- rows carry their own owner_all policy instead.
--
-- 5-step order: (1) extensions — none needed; (2) organizations scalar columns;
-- (3) child tables; (4) junction tables — none; (5) RLS policies (last).
-- Everything runs in ONE transaction and the schema_migrations ledger row is written in
-- the SAME transaction (mirroring 20261012000000).
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- (2) organizations scalar columns
--     All nullable/defaulted → zero backfill. The existing
--     guard_organizations_business_insert trigger only coerces moderation fields, so
--     these new columns pass through untouched.
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN business_category text NULL,
  ADD COLUMN email             text NULL,
  ADD COLUMN cost_model        text NULL CHECK (cost_model IS NULL OR cost_model IN ('free','sliding_scale','paid')),
  ADD COLUMN attributes        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN social_links      jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- (3) child tables (FK ON DELETE CASCADE; created_at only — no edit flow in scope)
-- ---------------------------------------------------------------------------
CREATE TABLE public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time time NOT NULL,
  close_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_hours_org_id_idx ON public.business_hours(org_id);

CREATE TABLE public.business_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_services_org_id_idx ON public.business_services(org_id);

CREATE TABLE public.business_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('logo','cover','gallery')),
  url text NOT NULL,
  storage_path text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  caption text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX business_photos_org_id_idx ON public.business_photos(org_id);
CREATE UNIQUE INDEX business_photos_one_logo_idx  ON public.business_photos(org_id) WHERE kind = 'logo';
CREATE UNIQUE INDEX business_photos_one_cover_idx ON public.business_photos(org_id) WHERE kind = 'cover';

-- ---------------------------------------------------------------------------
-- (5) RLS — every table.
--     INVARIANT (both directions): a child row is publicly readable EXACTLY when its
--     parent is an approved, active business (mirrors orgs_select_active). The owning
--     submitter and admins may read/write child rows of their org at any status. No
--     other role may insert/update/delete.
-- ---------------------------------------------------------------------------
ALTER TABLE public.business_hours    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_photos   ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.business_hours, public.business_services, public.business_photos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_hours, public.business_services, public.business_photos TO authenticated;

-- business_hours ------------------------------------------------------------
CREATE POLICY business_hours_public_select ON public.business_hours
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = business_hours.org_id
      AND o.org_type = 'business'
      AND o.status = 'approved'
      AND o.is_active = true
  ));
CREATE POLICY business_hours_owner_all ON public.business_hours
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = business_hours.org_id
      AND o.submitted_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = business_hours.org_id
      AND o.submitted_by = auth.uid()
  ));
CREATE POLICY business_hours_admin_all ON public.business_hours
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- business_services ---------------------------------------------------------
CREATE POLICY business_services_public_select ON public.business_services
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = business_services.org_id
      AND o.org_type = 'business'
      AND o.status = 'approved'
      AND o.is_active = true
  ));
CREATE POLICY business_services_owner_all ON public.business_services
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = business_services.org_id
      AND o.submitted_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = business_services.org_id
      AND o.submitted_by = auth.uid()
  ));
CREATE POLICY business_services_admin_all ON public.business_services
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- business_photos -----------------------------------------------------------
CREATE POLICY business_photos_public_select ON public.business_photos
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = business_photos.org_id
      AND o.org_type = 'business'
      AND o.status = 'approved'
      AND o.is_active = true
  ));
CREATE POLICY business_photos_owner_all ON public.business_photos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = business_photos.org_id
      AND o.submitted_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = business_photos.org_id
      AND o.submitted_by = auth.uid()
  ));
CREATE POLICY business_photos_admin_all ON public.business_photos
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- ---------------------------------------------------------------------------
-- Ledger row in the SAME transaction.
-- ---------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261014000000', 'p4a_w3_business_profiles');

COMMIT;
