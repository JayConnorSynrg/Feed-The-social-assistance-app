-- ─────────────────────────────────────────────────────────────
-- 20260923000000_untagged_geocode_targets_fn.sql
--
-- PURPOSE (PR-4, life-safety map-accuracy — ORPHAN-PROOF closure): select
-- EVERY approved, located resource whose geocode_accuracy is NULL, so the
-- geocode-backfill edge function (untagged mode) can verify+upgrade or
-- explicitly tag every remaining pin, closing the gap left by PR-3's
-- collision-only heuristic.
--
-- SUPERSEDES coarse_geocode_targets() (20260922000100), dropped below in the
-- same migration. The collision-based population (rows sharing an exact
-- coordinate with >=1 other approved row) was a strict SUBSET of the
-- accuracy-based population here: any row with geocode_accuracy IS NULL
-- qualifies, whether or not it collides with a sibling. A collision-only
-- selector left an orphan gap — an isolated (non-colliding) row that is
-- already precise-but-never-tagged, or genuinely mis-placed, was never
-- selected by any run of coarse_geocode_targets(). Accuracy-based selection
-- has no such gap because it depends only on the row's OWN accuracy column,
-- never on another row's coordinate — processing any row removes ONLY that
-- row from future selection (no orphans, ever, across any number of runs).
--
-- TARGET POPULATION (live at authoring time, ~18,004 rows): approved rows
-- where location IS NOT NULL AND geocode_accuracy IS NULL. No self-join /
-- group-by required (unlike the superseded collision check), so this could
-- in principle be expressed as a plain PostgREST filter — kept as a
-- dedicated SECURITY DEFINER function to mirror the existing
-- coarse_geocode_targets() grant model (service_role/postgres only) and to
-- keep the edge function's RPC-call shape uniform across modes.
--
-- Does NOT touch or supersede set_resource_geocode (20260920000000) — this
-- function is read-only target selection; the write-decision (move vs tag)
-- lives in the edge function per-row (decision.ts resolveCoarseWrite).
--
-- 5-STEP ORDER: no extensions/tables/enums here (resources already exists);
-- this is step (5) — a function + its grant model, layered on an existing
-- core table. No RLS change: resources RLS is untouched; this function is
-- SECURITY DEFINER with an explicit, narrow grant model below.
-- ─────────────────────────────────────────────────────────────

-- Supersede: the accuracy-based selector below is a strict superset of the
-- collision-based one, and is orphan-proof where the collision check was
-- not — drop the now-redundant function (anti-speculation: no dead code).
DROP FUNCTION IF EXISTS public.coarse_geocode_targets(integer);

DROP FUNCTION IF EXISTS public.untagged_geocode_targets(integer);

CREATE FUNCTION public.untagged_geocode_targets(p_limit integer DEFAULT 4000)
RETURNS TABLE (
  id                uuid,
  address_line1     text,
  address_line2     text,
  city              text,
  state             text,
  zip_code          text,
  country           text,
  geocode_accuracy  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    r.id,
    r.address_line1,
    r.address_line2,
    r.city,
    r.state,
    r.zip_code,
    r.country,
    r.geocode_accuracy
  FROM public.resources r
  WHERE r.status = 'approved'
    AND r.location IS NOT NULL
    AND r.geocode_accuracy IS NULL
  ORDER BY r.id
  LIMIT p_limit;
$$;

-- ── Grant model: server/admin primitive only (mirrors coarse_geocode_targets / set_resource_geocode) ──
-- The backfill edge function runs as service_role; grant EXECUTE there only.
-- REVOKE from PUBLIC/anon/authenticated so this read primitive (which still
-- bypasses RLS as SECURITY DEFINER) cannot be invoked by client-origin roles.
REVOKE ALL     ON FUNCTION public.untagged_geocode_targets(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.untagged_geocode_targets(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.untagged_geocode_targets(integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.untagged_geocode_targets(integer) TO service_role;
GRANT  EXECUTE ON FUNCTION public.untagged_geocode_targets(integer) TO postgres;
