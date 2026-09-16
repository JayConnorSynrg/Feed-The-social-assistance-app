-- Migration: snap_retailers_in_bounds
-- Bounded viewport RPC for the isolated national snap_retailers table.
--
-- Mirrors resources_in_bounds (20260529000001) but reads ONLY snap_retailers —
-- it never touches the resources table or any curated resource surface.
-- Uses the existing GiST index (snap_retailers_location_idx) for fast envelope filtering.
-- Called via: supabase.rpc('snap_retailers_in_bounds', { west, south, east, north, max_results })

CREATE OR REPLACE FUNCTION snap_retailers_in_bounds(
  west  double precision,
  south double precision,
  east  double precision,
  north double precision,
  max_results integer DEFAULT 500
)
RETURNS TABLE (
  id                uuid,
  retailer_id       text,
  name              text,
  type              text,
  address           text,
  city              text,
  state             text,
  zip               text,
  incentive_program text,
  lat               double precision,
  lng               double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    id,
    retailer_id,
    retailer_name                AS name,
    retailer_type                AS type,
    address,
    city,
    state,
    zip_code                     AS zip,
    incentive_program,
    st_y(location::geometry)     AS lat,
    st_x(location::geometry)     AS lng
  FROM snap_retailers
  WHERE location IS NOT NULL
    AND location::geometry && ST_MakeEnvelope(west, south, east, north, 4326)
  ORDER BY retailer_name
  LIMIT max_results;
$$;

-- Public food-access data — mirror the resources_in_bounds grant surface.
GRANT EXECUTE ON FUNCTION snap_retailers_in_bounds(double precision, double precision, double precision, double precision, integer)
  TO anon, authenticated;
