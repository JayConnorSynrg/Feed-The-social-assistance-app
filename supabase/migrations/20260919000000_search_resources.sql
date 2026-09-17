-- Migration: search_resources
-- Adds an EXHAUSTIVE server-side resource search RPC that replaces the old UI-side
-- whole-phrase literal substring match (viewport-gated, no query understanding) which
-- returned 0 results for "housing in rutland vermont" despite 21 approved Rutland/VT/
-- housing resources existing.
--
-- Empirical system model (prod ndtpovonpadugthmcntl, re-verified live 2026-09-16):
--   * resources: ~19,136 rows; state stored as 2-letter code ('VT'); city 'Rutland';
--     category is enum resource_category (value 'housing'); the 21 target rows are
--     status='approved'. Geo model is a SINGLE PostGIS column location geography(Point,4326);
--     lat/lng DERIVED at read time via st_y/st_x (NO stored lat/lng).
--   * Extensions: postgis + pg_trgm BOTH already installed (schema public). The
--     CREATE EXTENSION guard below is therefore a no-op here but keeps the migration
--     self-contained / replayable on a fresh DB.
--   * RLS on resources (verified via pg_policy): policy
--       "Approved resources are viewable by everyone"  FOR SELECT TO public
--       USING (status = 'approved')
--     makes approved rows visible to BOTH anon and authenticated. => SECURITY INVOKER
--     is sufficient and preferred (no elevated privilege, caller RLS applies). A
--     belt-and-suspenders WHERE r.status = 'approved' is included regardless.
--
-- Migration ordering (FEED 5-step discipline):
--   1. Extensions            — pg_trgm (guarded; already present).
--   2. Core functions        — expand_state(text) IMMUTABLE (2-letter -> "CODE Fullname").
--   3. Dependent table col    — resources.search_document GENERATED ALWAYS AS (...) STORED tsvector.
--   4. Indexes                — GIN on search_document (FTS) + GIN trgm (fuzzy fallback).
--   5. Function + grants      — search_resources() SECURITY INVOKER + grants to anon,authenticated.
--
-- Idempotency: extension guarded (IF NOT EXISTS); expand_state is CREATE OR REPLACE;
-- column add is ADD COLUMN IF NOT EXISTS (a generated column cannot be altered later,
-- so re-running is a safe no-op); indexes use CREATE INDEX IF NOT EXISTS; the function
-- uses DROP IF EXISTS + CREATE (RETURNS TABLE shape is fixed by contract).

-- ============================================================
-- 1. Extensions — pg_trgm (already installed in schema public; no-op guard).
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 2. Core function: expand_state(text)
-- Maps a stored 2-letter state code to "CODE Fullname" (e.g. 'VT' -> 'VT Vermont')
-- so the search document contains BOTH tokens. This is the fix for the VT/Vermont bug:
-- a query "vermont" then matches a row whose state column only stores 'VT'.
-- IMMUTABLE + pure (no object references) => usable inside a GENERATED column and
-- carries zero injection surface. Unknown / already-full values pass through unchanged
-- (a row storing 'Vermont' still yields the 'vermont' lexeme).
-- ============================================================
CREATE OR REPLACE FUNCTION public.expand_state(p_state text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(trim(coalesce(p_state, '')))
    WHEN 'AL' THEN 'AL Alabama'
    WHEN 'AK' THEN 'AK Alaska'
    WHEN 'AZ' THEN 'AZ Arizona'
    WHEN 'AR' THEN 'AR Arkansas'
    WHEN 'CA' THEN 'CA California'
    WHEN 'CO' THEN 'CO Colorado'
    WHEN 'CT' THEN 'CT Connecticut'
    WHEN 'DE' THEN 'DE Delaware'
    WHEN 'DC' THEN 'DC District of Columbia'
    WHEN 'FL' THEN 'FL Florida'
    WHEN 'GA' THEN 'GA Georgia'
    WHEN 'HI' THEN 'HI Hawaii'
    WHEN 'ID' THEN 'ID Idaho'
    WHEN 'IL' THEN 'IL Illinois'
    WHEN 'IN' THEN 'IN Indiana'
    WHEN 'IA' THEN 'IA Iowa'
    WHEN 'KS' THEN 'KS Kansas'
    WHEN 'KY' THEN 'KY Kentucky'
    WHEN 'LA' THEN 'LA Louisiana'
    WHEN 'ME' THEN 'ME Maine'
    WHEN 'MD' THEN 'MD Maryland'
    WHEN 'MA' THEN 'MA Massachusetts'
    WHEN 'MI' THEN 'MI Michigan'
    WHEN 'MN' THEN 'MN Minnesota'
    WHEN 'MS' THEN 'MS Mississippi'
    WHEN 'MO' THEN 'MO Missouri'
    WHEN 'MT' THEN 'MT Montana'
    WHEN 'NE' THEN 'NE Nebraska'
    WHEN 'NV' THEN 'NV Nevada'
    WHEN 'NH' THEN 'NH New Hampshire'
    WHEN 'NJ' THEN 'NJ New Jersey'
    WHEN 'NM' THEN 'NM New Mexico'
    WHEN 'NY' THEN 'NY New York'
    WHEN 'NC' THEN 'NC North Carolina'
    WHEN 'ND' THEN 'ND North Dakota'
    WHEN 'OH' THEN 'OH Ohio'
    WHEN 'OK' THEN 'OK Oklahoma'
    WHEN 'OR' THEN 'OR Oregon'
    WHEN 'PA' THEN 'PA Pennsylvania'
    WHEN 'RI' THEN 'RI Rhode Island'
    WHEN 'SC' THEN 'SC South Carolina'
    WHEN 'SD' THEN 'SD South Dakota'
    WHEN 'TN' THEN 'TN Tennessee'
    WHEN 'TX' THEN 'TX Texas'
    WHEN 'UT' THEN 'UT Utah'
    WHEN 'VT' THEN 'VT Vermont'
    WHEN 'VA' THEN 'VA Virginia'
    WHEN 'WA' THEN 'WA Washington'
    WHEN 'WV' THEN 'WV West Virginia'
    WHEN 'WI' THEN 'WI Wisconsin'
    WHEN 'WY' THEN 'WY Wyoming'
    ELSE coalesce(p_state, '')
  END;
$$;

-- ============================================================
-- 2b. Core function: category_label(resource_category)
-- The bare `category::text` cast resolves to enum_out which is STABLE (not IMMUTABLE),
-- so it cannot appear in a STORED generated column (42P17). This IMMUTABLE wrapper maps
-- each enum value to its identical text label via enum-equality compares + text literals
-- (both IMMUTABLE). The ELSE p_category::text fallback covers any future-added enum value;
-- Postgres accepts the IMMUTABLE declaration on this function (trusted-immutable fallback).
-- Enum labels pulled live from pg_enum on prod ndtpovonpadugthmcntl (2026-09-16).
-- ============================================================
CREATE OR REPLACE FUNCTION public.category_label(p_category public.resource_category)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_category
    WHEN 'food'                THEN 'food'
    WHEN 'housing'             THEN 'housing'
    WHEN 'healthcare'          THEN 'healthcare'
    WHEN 'employment'          THEN 'employment'
    WHEN 'education'           THEN 'education'
    WHEN 'legal'               THEN 'legal'
    WHEN 'transportation'      THEN 'transportation'
    WHEN 'utilities'           THEN 'utilities'
    WHEN 'clothing'            THEN 'clothing'
    WHEN 'financial'           THEN 'financial'
    WHEN 'mental_health'       THEN 'mental_health'
    WHEN 'substance_abuse'     THEN 'substance_abuse'
    WHEN 'domestic_violence'   THEN 'domestic_violence'
    WHEN 'childcare'           THEN 'childcare'
    WHEN 'senior_services'     THEN 'senior_services'
    WHEN 'disability_services' THEN 'disability_services'
    WHEN 'veteran_services'    THEN 'veteran_services'
    WHEN 'immigration'         THEN 'immigration'
    WHEN 'other'               THEN 'other'
    WHEN 'eitc_tax_filing'     THEN 'eitc_tax_filing'
    WHEN 'free_legal'          THEN 'free_legal'
    WHEN 'prenatal_natal_care' THEN 'prenatal_natal_care'
    WHEN 'waste_disposal'      THEN 'waste_disposal'
    WHEN 'free_camping'        THEN 'free_camping'
    WHEN 'free_goods_donation' THEN 'free_goods_donation'
    ELSE p_category::text
  END;
$$;

-- ============================================================
-- 3. Dependent column: resources.search_document (STORED generated tsvector)
-- Composition: name + description + city + expand_state(state) + category + address_line1.
-- coalesce() on every nullable part so a NULL never voids the whole document; category
-- (a NOT NULL enum) is cast ::text. Every part of the expression is IMMUTABLE
-- (to_tsvector with a literal 'english' config, coalesce, the ::text cast, and the
-- IMMUTABLE expand_state), which is the requirement for a GENERATED column.
--
-- Generated-column vs functional-index choice: STORED generated column is chosen over a
-- bare functional GIN index because the RPC RANKS with ts_rank_cd(search_document, tsq).
-- A functional index would only accelerate the @@ membership test; ts_rank_cd would still
-- recompute to_tsvector(...) per candidate row. Materialising the tsvector once makes
-- ranking read the stored value, and the GIN index (step 4) sits directly on the column.
-- ============================================================
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS search_document tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(name, '')          || ' ' ||
      coalesce(description, '')    || ' ' ||
      coalesce(city, '')           || ' ' ||
      public.expand_state(state)   || ' ' ||
      public.category_label(category) || ' ' ||
      coalesce(address_line1, '')
    )
  ) STORED;

-- ============================================================
-- 4. Indexes
-- 4a. GIN on the FTS document — powers `search_document @@ websearch_to_tsquery(...)`.
-- 4b. GIN trigram on (name || ' ' || coalesce(city,'')) — powers the fuzzy fallback via
--     the `%` operator so a typo / partial term still surfaces. The indexed expression
--     is IDENTICAL to the one used in the function's WHERE clause so the planner can use it.
-- ============================================================
CREATE INDEX IF NOT EXISTS resources_search_document_gin
  ON public.resources USING gin (search_document);

CREATE INDEX IF NOT EXISTS resources_name_city_trgm
  ON public.resources USING gin ((name || ' ' || coalesce(city, '')) gin_trgm_ops);

-- ============================================================
-- 5. Function: search_resources(p_query, p_limit, p_offset) + grants
-- SECURITY INVOKER: the caller's RLS applies. anon + authenticated already see only
-- approved rows via the public SELECT policy; the extra `r.status = 'approved'` in WHERE
-- is belt-and-suspenders so the RPC can NEVER return a non-approved row.
--
-- Matching (union of two standard mechanisms, both index-backed via BitmapOr):
--   (a) FTS:   search_document @@ websearch_to_tsquery('english', p_query)
--              websearch_to_tsquery drops stopwords ("in") and handles phrasing, so
--              "housing in rutland vermont" -> 'housing & rutland & vermont'.
--   (b) Fuzzy: (name || ' ' || coalesce(city,'')) % p_query   -- pg_trgm similarity op,
--              default threshold 0.3, catches typos / partial terms the FTS misses.
-- Ranking: ts_rank_cd(FTS) + similarity(name+city+state, p_query), ORDER BY rank desc.
-- No dynamic SQL: p_query is only ever passed as a value to websearch_to_tsquery /
-- the `%` operator / similarity() — zero injection surface.
-- ============================================================
DROP FUNCTION IF EXISTS public.search_resources(text, int, int);

CREATE FUNCTION public.search_resources(
  p_query  text,
  p_limit  int default 50,
  p_offset int default 0
)
RETURNS TABLE (
  id            uuid,
  name          text,
  description   text,
  category      text,
  city          text,
  state         text,
  zip_code      text,
  address_line1 text,
  phone         text,
  website       text,
  service_mode  text,
  status        text,
  source        text,
  lat           double precision,
  lng           double precision,
  rank          real
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH q AS (
    SELECT
      websearch_to_tsquery('english', coalesce(p_query, '')) AS tsq,
      coalesce(p_query, '')                                   AS raw
  )
  SELECT
    r.id,
    r.name,
    r.description,
    r.category::text,
    r.city,
    r.state,
    r.zip_code,
    r.address_line1,
    r.phone,
    r.website,
    r.service_mode::text,
    r.status::text,
    r.source::text,
    st_y(r.location::geometry) AS lat,
    st_x(r.location::geometry) AS lng,
    (
      ts_rank_cd(r.search_document, q.tsq)
      + similarity(
          r.name || ' ' || coalesce(r.city, '') || ' ' || coalesce(r.state, ''),
          q.raw
        )
    )::real AS rank
  FROM public.resources r
  CROSS JOIN q
  WHERE r.status = 'approved'
    AND (
      r.search_document @@ q.tsq
      OR (r.name || ' ' || coalesce(r.city, '')) % q.raw
    )
  ORDER BY rank DESC, r.name ASC
  LIMIT  greatest(coalesce(p_limit, 50), 1)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

GRANT EXECUTE ON FUNCTION public.search_resources(text, int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.search_resources(text, int, int) TO authenticated;
