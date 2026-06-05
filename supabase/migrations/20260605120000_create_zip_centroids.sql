-- Migration: create_zip_centroids
-- Data source: US Census Bureau 2020 ZCTA5 Gazetteer (public domain)
-- https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip
-- Interior-point centroids (INTPTLAT / INTPTLONG) represent the Census-computed
-- centroid of the ZIP Code Tabulation Area polygon.
-- This table contains NO user data — it is pure public-domain reference geometry.
-- Clients may SELECT to resolve zip codes to approximate coordinates.
-- Only the DB owner (via seed migration) writes to this table; client roles never write.

CREATE TABLE IF NOT EXISTS public.zip_centroids (
    zip  text PRIMARY KEY,
    lat  double precision NOT NULL,
    lng  double precision NOT NULL
);

COMMENT ON TABLE public.zip_centroids IS
    'US Census 2020 ZCTA interior-point centroids (public domain). '
    'Used as a fallback geocoder when a user provides only a zip_code. '
    'Data source: 2020_Gaz_zcta_national.zip (Census Bureau Gazetteer).';

-- Row-level security: required on all tables per project conventions.
-- USING (true) is acceptable here because this is non-sensitive public-domain
-- reference data — there are no user rows and no PII.  Any authenticated user
-- may read zip centroids (required for the autocomplete + proximity search flows).
ALTER TABLE public.zip_centroids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read zip centroids"
    ON public.zip_centroids
    FOR SELECT
    TO authenticated
    USING (true);

-- Clients (anon + authenticated) NEVER write reference data;
-- only the DB owner (migration / seed) writes.
REVOKE INSERT, UPDATE, DELETE ON public.zip_centroids FROM anon, authenticated;
