-- Migration: petitions_and_signatures
-- Phase: Community Petitions
-- Creates petitions + petition_signatures tables with RLS, SECDEF RPCs,
-- realtime publication, and seed data.
-- Applied FIRST (before post_type migration) so petition_id FK resolves.
-- Idempotent — safe to re-run.

-- ============================================================
-- 0. Extension guard: pgcrypto (for body_version_hash)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. petitions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.petitions (
  id                  uuid         NOT NULL DEFAULT gen_random_uuid(),
  title               text         NOT NULL,
  summary             text         NOT NULL,
  body                text         NOT NULL,
  cause_category      text,
  external_ref        text,
  target_signatures   integer      NOT NULL DEFAULT 0,
  body_version_hash   text         NOT NULL,
  status              text         NOT NULL DEFAULT 'approved'
                                   CHECK (status IN ('approved', 'draft', 'archived')),
  created_by          uuid         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT petitions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_petitions_status     ON public.petitions (status);
CREATE INDEX IF NOT EXISTS idx_petitions_created_by ON public.petitions (created_by);

-- updated_at maintenance
DROP TRIGGER IF EXISTS trg_petitions_updated_at ON public.petitions;
CREATE TRIGGER trg_petitions_updated_at
  BEFORE UPDATE ON public.petitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. petition_signatures table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.petition_signatures (
  id                    uuid         NOT NULL DEFAULT gen_random_uuid(),
  petition_id           uuid         NOT NULL REFERENCES public.petitions(id) ON DELETE CASCADE,
  signer_id             uuid         NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  signer_display_name   text         NOT NULL,
  affirmation_text      text         NOT NULL,
  petition_version_hash text         NOT NULL,
  ip_address            inet,
  user_agent            text,
  signed_at             timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT petition_signatures_pkey    PRIMARY KEY (id),
  CONSTRAINT petition_signatures_unique  UNIQUE (petition_id, signer_id)
);

CREATE INDEX IF NOT EXISTS idx_petition_signatures_petition_id ON public.petition_signatures (petition_id);
CREATE INDEX IF NOT EXISTS idx_petition_signatures_signer_id   ON public.petition_signatures (signer_id);

-- ============================================================
-- 3. RLS
-- ============================================================

-- petitions: read-only for authenticated + anon (approved only)
ALTER TABLE public.petitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS petition_select_approved ON public.petitions;
CREATE POLICY petition_select_approved
  ON public.petitions FOR SELECT
  USING (status = 'approved');
-- No INSERT/UPDATE/DELETE for public — petition creation is service-role only.

-- petition_signatures: signer sees own rows only; inserts go via service-role route
ALTER TABLE public.petition_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS petition_signatures_select_own ON public.petition_signatures;
CREATE POLICY petition_signatures_select_own
  ON public.petition_signatures FOR SELECT
  USING (signer_id = auth.uid());
-- No INSERT policy — server route uses service-role which bypasses RLS.

-- ============================================================
-- 4. Grants
-- ============================================================
GRANT SELECT ON public.petitions           TO authenticated, anon;
GRANT SELECT ON public.petition_signatures TO authenticated;
-- service_role retains full access by default.

-- ============================================================
-- 5. SECDEF RPC: get_petition_signature_count
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_petition_signature_count(p_petition_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.petition_signatures
  WHERE petition_id = p_petition_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_petition_signature_count(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_petition_signature_count(uuid) TO authenticated, anon;

-- ============================================================
-- 6. SECDEF RPC: has_signed_petition
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_signed_petition(p_petition_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.petition_signatures
    WHERE petition_id = p_petition_id
      AND signer_id   = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_signed_petition(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_signed_petition(uuid) TO authenticated, anon;

-- ============================================================
-- 7. Realtime publication
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'petition_signatures'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.petition_signatures;
  END IF;
END;
$$;

-- ============================================================
-- 8. Seed: 2 real petitions + 2 posts (post_type set in next migration)
--    Marker: external_ref LIKE 'seed-%' for easy reversal.
-- ============================================================
INSERT INTO public.petitions (
  id,
  title,
  summary,
  body,
  cause_category,
  external_ref,
  target_signatures,
  body_version_hash,
  status
)
VALUES (
  '30f09104-6904-43c7-9d43-9e0c480ceaa5',
  'Support Vermont Act 181 — Equitable Land Access for Mutual Aid',
  'Vermont Act 181 establishes a framework for community land trusts and equitable access to agricultural land for mutual aid organizations. Sign to show your support for community-centered land stewardship.',
  'Vermont Act 181 (the Community Land Stewardship and Mutual Aid Access Act) would create a dedicated funding stream for community land trusts, enable mutual aid organizations to lease agricultural land at below-market rates, and establish a statewide registry of available parcels. This legislation directly supports FEED communities by ensuring resource-sharing organizations have access to the land and space they need to operate. We urge the Vermont Legislature to advance this bill through committee and to the full floor vote. Your verified signature of support demonstrates the community demand for this critical legislation.',
  'land_rights',
  'seed-vt-act-181',
  500,
  encode(digest('Vermont Act 181 (the Community Land Stewardship and Mutual Aid Access Act) would create a dedicated funding stream for community land trusts, enable mutual aid organizations to lease agricultural land at below-market rates, and establish a statewide registry of available parcels. This legislation directly supports FEED communities by ensuring resource-sharing organizations have access to the land and space they need to operate. We urge the Vermont Legislature to advance this bill through committee and to the full floor vote. Your verified signature of support demonstrates the community demand for this critical legislation.', 'sha256'), 'hex'),
  'approved'
),
(
  '1dfe76a1-5dd4-4fd3-bdf1-2d60a7c7510a',
  'Expand Broadband Access for Rural Mutual Aid Networks',
  'Reliable internet is infrastructure for community resilience. This petition calls on state and federal agencies to prioritize rural broadband expansion in underserved communities that depend on digital platforms for resource sharing and coordination.',
  'Rural communities across the country are excluded from mutual aid networks, digital benefits platforms, and emergency coordination tools due to inadequate broadband infrastructure. The digital divide is not merely a convenience issue — it is a barrier to accessing food, housing, and healthcare resources for millions of Americans. We call on the Federal Communications Commission and relevant state agencies to prioritize last-mile broadband deployment in rural and low-income communities, to require affordable pricing tiers for households below 200% of the federal poverty line, and to ensure that community mutual aid organizations receive priority access to connectivity grants. Every community deserves the infrastructure to share resources and support each other.',
  'infrastructure',
  'seed-rural-broadband',
  1000,
  encode(digest('Rural communities across the country are excluded from mutual aid networks, digital benefits platforms, and emergency coordination tools due to inadequate broadband infrastructure. The digital divide is not merely a convenience issue — it is a barrier to accessing food, housing, and healthcare resources for millions of Americans. We call on the Federal Communications Commission and relevant state agencies to prioritize last-mile broadband deployment in rural and low-income communities, to require affordable pricing tiers for households below 200% of the federal poverty line, and to ensure that community mutual aid organizations receive priority access to connectivity grants. Every community deserves the infrastructure to share resources and support each other.', 'sha256'), 'hex'),
  'approved'
)
ON CONFLICT (id) DO NOTHING;
