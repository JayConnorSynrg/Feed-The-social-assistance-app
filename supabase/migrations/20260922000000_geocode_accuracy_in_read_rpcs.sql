-- Add geocode_accuracy as trailing column on the two read RPCs used by the map,
-- so callers can flag imprecise pins. Appended as the LAST column on both
-- RETURNS TABLE and SELECT lists so every existing column keeps its ordinal
-- position and name -- zero regression to existing positional/named callers.
-- All other lines (language, volatility, security mode, search_path, params,
-- WHERE/ORDER/LIMIT clauses) are byte-for-byte unchanged from the live definitions.

BEGIN;

DROP FUNCTION IF EXISTS public.resources_in_bounds(double precision,double precision,double precision,double precision,integer);

CREATE FUNCTION public.resources_in_bounds(west double precision, south double precision, east double precision, north double precision, max_results integer DEFAULT 500)
RETURNS TABLE(id uuid, name text, description text, category text, address_line1 text, city text, state text, phone text, website text, hours_of_operation jsonb, location geography, is_volunteer_resource boolean, geocode_accuracy text)
LANGUAGE sql
STABLE
SECURITY DEFINER
-- 'extensions' included for PostGIS-relocation resilience (unqualified ST_*/geography symbols resolve even if PostGIS moves out of public)
SET search_path TO 'public', 'extensions'
AS $function$
    SELECT id, name, description, category, address_line1, city, state, phone, website, hours_of_operation, location, is_volunteer_resource, geocode_accuracy
    FROM resources
    WHERE status = 'approved' AND location IS NOT NULL
      AND location::geometry && ST_MakeEnvelope(west, south, east, north, 4326)
    ORDER BY name LIMIT max_results;
$function$;

DROP FUNCTION IF EXISTS public.search_resources(text,integer,integer);

CREATE FUNCTION public.search_resources(p_query text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, name text, description text, category text, city text, state text, zip_code text, address_line1 text, phone text, website text, service_mode text, status text, source text, lat double precision, lng double precision, rank real, geocode_accuracy text)
LANGUAGE sql
STABLE
SET search_path TO 'public','extensions'
AS $function$
    WITH q AS (SELECT websearch_to_tsquery('english', coalesce(p_query,'')) AS tsq, coalesce(p_query,'') AS raw)
    SELECT r.id, r.name, r.description, r.category::text, r.city, r.state, r.zip_code, r.address_line1, r.phone, r.website, r.service_mode::text, r.status::text, r.source::text, st_y(r.location::geometry) AS lat, st_x(r.location::geometry) AS lng, (ts_rank_cd(r.search_document, q.tsq) + similarity(r.name || ' ' || coalesce(r.city,'') || ' ' || coalesce(r.state,''), q.raw))::real AS rank, r.geocode_accuracy
    FROM public.resources r CROSS JOIN q
    WHERE r.status = 'approved' AND (r.search_document @@ q.tsq OR (r.name || ' ' || coalesce(r.city,'')) % q.raw)
    ORDER BY rank DESC, r.name ASC LIMIT greatest(coalesce(p_limit,50),1) OFFSET greatest(coalesce(p_offset,0),0);
$function$;

GRANT EXECUTE ON FUNCTION public.resources_in_bounds(double precision,double precision,double precision,double precision,integer) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_resources(text,integer,integer) TO PUBLIC, anon, authenticated, service_role;

COMMIT;
