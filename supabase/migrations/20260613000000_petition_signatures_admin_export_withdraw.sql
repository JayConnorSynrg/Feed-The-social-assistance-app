-- ============================================================================
-- Petition signatures: admin-only signer export + user withdraw-until-export
-- ============================================================================
-- Additive + backward-compatible. Adds:
--   1. petition_signatures.signer_full_name (snapshot at signing time)
--   2. petitions.exported_at / exported_by (per-petition export lock)
--   3. get_petition_signatures()     — admin-gated read of the signer list
--   4. export_petition_signatures()  — admin-gated read + sets the export lock
--   5. withdraw_petition_signature() — owner-gated delete, allowed until export
--
-- Export semantics: EXPORTING a petition's signatures (CSV download) sets
-- exported_at, which permanently locks withdrawal for ALL signers on that
-- petition. VIEWING the list (get_petition_signatures) does NOT lock.
--
-- Every SECDEF fn follows the project search_path lesson:
--   SET search_path = public, pg_temp  (UNQUOTED multi-schema list)
--   REVOKE EXECUTE FROM PUBLIC + anon; GRANT EXECUTE TO authenticated
--   admin/ownership checks gated INSIDE the function body.
-- ============================================================================

-- ── 1. Snapshot full name on signatures (nullable; existing rows stay NULL) ──
ALTER TABLE public.petition_signatures
  ADD COLUMN IF NOT EXISTS signer_full_name text;

-- ── 2. Per-petition export lock ──────────────────────────────────────────────
ALTER TABLE public.petitions
  ADD COLUMN IF NOT EXISTS exported_at timestamptz;

ALTER TABLE public.petitions
  ADD COLUMN IF NOT EXISTS exported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- petitions already has table-level GRANT SELECT TO authenticated, anon, so the
-- new columns are readable. (Belt-and-suspenders: ensure exported_at is readable
-- as the non-sensitive lock signal the panel needs.)
GRANT SELECT (exported_at) ON public.petitions TO authenticated, anon;

-- ── 3. get_petition_signatures — admin-only read (does NOT lock) ─────────────
CREATE OR REPLACE FUNCTION public.get_petition_signatures(p_petition_id uuid)
RETURNS TABLE (
  signer_full_name      text,
  signer_display_name   text,
  signed_at             timestamptz,
  affirmation_text      text,
  petition_version_hash text,
  ip_address            text,
  user_agent            text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(ps.signer_full_name, ps.signer_display_name) AS signer_full_name,
    ps.signer_display_name,
    ps.signed_at,
    ps.affirmation_text,
    ps.petition_version_hash,
    ps.ip_address::text,
    ps.user_agent
  FROM public.petition_signatures ps
  WHERE ps.petition_id = p_petition_id
  ORDER BY ps.signed_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_petition_signatures(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_petition_signatures(uuid) TO authenticated;

-- ── 4. export_petition_signatures — admin-only read + sets the export lock ───
CREATE OR REPLACE FUNCTION public.export_petition_signatures(p_petition_id uuid)
RETURNS TABLE (
  signer_full_name      text,
  signer_display_name   text,
  signed_at             timestamptz,
  affirmation_text      text,
  petition_version_hash text,
  ip_address            text,
  user_agent            text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- COALESCE so re-export preserves the FIRST export moment = the lock instant.
  UPDATE public.petitions
     SET exported_at = COALESCE(exported_at, now()),
         exported_by = COALESCE(exported_by, auth.uid())
   WHERE id = p_petition_id;

  RETURN QUERY
  SELECT
    COALESCE(ps.signer_full_name, ps.signer_display_name) AS signer_full_name,
    ps.signer_display_name,
    ps.signed_at,
    ps.affirmation_text,
    ps.petition_version_hash,
    ps.ip_address::text,
    ps.user_agent
  FROM public.petition_signatures ps
  WHERE ps.petition_id = p_petition_id
  ORDER BY ps.signed_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.export_petition_signatures(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.export_petition_signatures(uuid) TO authenticated;

-- ── 5. withdraw_petition_signature — owner-gated, allowed until export ───────
CREATE OR REPLACE FUNCTION public.withdraw_petition_signature(p_petition_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exported_at timestamptz;
  v_new_count   integer;
BEGIN
  SELECT exported_at INTO v_exported_at
  FROM public.petitions
  WHERE id = p_petition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'petition not found';
  END IF;

  IF v_exported_at IS NOT NULL THEN
    RAISE EXCEPTION 'petition signatures are locked (exported)';
  END IF;

  -- Ownership enforced in the DELETE predicate via auth.uid().
  DELETE FROM public.petition_signatures
  WHERE petition_id = p_petition_id
    AND signer_id = auth.uid();

  SELECT count(*)::integer INTO v_new_count
  FROM public.petition_signatures
  WHERE petition_id = p_petition_id;

  RETURN v_new_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.withdraw_petition_signature(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.withdraw_petition_signature(uuid) TO authenticated;
