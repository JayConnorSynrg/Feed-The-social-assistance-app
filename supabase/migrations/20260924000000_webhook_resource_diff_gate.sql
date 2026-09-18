-- ============================================
-- Federation Webhook — Resource UPDATE Diff Gate
-- Version: 1.0.0
-- Created: 2026-09-24
-- Description: Stops the federation webhook trigger from firing on
--   resources UPDATEs that only touch non-federated columns (e.g. the
--   geocode-accuracy re-tagging cadence writing geocode_accuracy /
--   geocode_confidence across ~19k rows). INSERT and DELETE keep firing
--   unconditionally. UPDATE fires only when a column actually exposed to
--   federation peers changed.
--
-- Federated-column derivation (see supabase/functions/federation-resources
-- /index.ts toFederationResource(), ~L160-198, and the single-resource
-- fetch path `.from('resources').select('*').eq('status','approved')`,
-- ~L362-372, which is what a peer calls after receiving this webhook):
--   name, description, category (payload's "resource_type"), address_line1,
--   city, state, zip_code, phone, email, website, hours_of_operation,
--   location, status.
-- Excluded: address_line2/country (never serialized to peers),
--   is_verified (not checked on the single-resource fetch path the webhook
--   drives — only the separate polling collection sync gates on it),
--   geocode_accuracy/geocode_confidence (the exact columns this gate exists
--   to exclude), updated_at/created_at (bookkeeping, not peer content),
--   latitude/longitude (referenced by toFederationResource() but resources
--   has no such columns — always null; pre-existing dead mapping, out of
--   scope here).
-- ============================================

-- Function body, SECURITY DEFINER, and search_path pinning are unchanged
-- and preserved verbatim from the live definition (hardened by
-- 20260601043054_harden_security_definer_fns.sql /
-- 20260603150000_harden_function_search_path.sql). Only the trigger
-- registration below changes.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'resources'
  ) THEN

    -- Drop the single combined trigger (fires unconditionally on every op)
    DROP TRIGGER IF EXISTS on_resource_change_webhook ON public.resources;
    DROP TRIGGER IF EXISTS on_resource_change_webhook_write ON public.resources;
    DROP TRIGGER IF EXISTS on_resource_change_webhook_update ON public.resources;

    -- INSERT/DELETE: fire unconditionally, exactly as before
    CREATE TRIGGER on_resource_change_webhook_write
    AFTER INSERT OR DELETE ON public.resources
    FOR EACH ROW
    EXECUTE FUNCTION public.on_resource_change_webhook();

    -- UPDATE: fire only when a federated column actually changed
    CREATE TRIGGER on_resource_change_webhook_update
    AFTER UPDATE ON public.resources
    FOR EACH ROW
    WHEN (
      OLD.name IS DISTINCT FROM NEW.name
      OR OLD.description IS DISTINCT FROM NEW.description
      OR OLD.category IS DISTINCT FROM NEW.category
      OR OLD.address_line1 IS DISTINCT FROM NEW.address_line1
      OR OLD.city IS DISTINCT FROM NEW.city
      OR OLD.state IS DISTINCT FROM NEW.state
      OR OLD.zip_code IS DISTINCT FROM NEW.zip_code
      OR OLD.phone IS DISTINCT FROM NEW.phone
      OR OLD.email IS DISTINCT FROM NEW.email
      OR OLD.website IS DISTINCT FROM NEW.website
      OR OLD.hours_of_operation IS DISTINCT FROM NEW.hours_of_operation
      OR OLD.location IS DISTINCT FROM NEW.location
      OR OLD.status IS DISTINCT FROM NEW.status
    )
    EXECUTE FUNCTION public.on_resource_change_webhook();

    RAISE NOTICE '✅ Webhook trigger split: INSERT/DELETE unconditional, UPDATE gated on federated-column diff';

  ELSE
    RAISE NOTICE '⚠️ resources table not found - webhook diff-gate trigger not created';
  END IF;
END $$;
