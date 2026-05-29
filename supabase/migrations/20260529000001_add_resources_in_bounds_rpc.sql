-- RPC function: resources within a geographic bounding box
-- Uses the existing GiST index on resources.location for sub-millisecond filtering
-- Called via: supabase.rpc('resources_in_bounds', { west, south, east, north, max_results })

CREATE OR REPLACE FUNCTION resources_in_bounds(
  west  double precision,
  south double precision,
  east  double precision,
  north double precision,
  max_results integer DEFAULT 500
)
RETURNS TABLE (
  id                  uuid,
  name                text,
  description         text,
  category            text,
  address_line1       text,
  city                text,
  state               text,
  phone               text,
  website             text,
  hours_of_operation  jsonb,
  location            geography,
  is_volunteer_resource boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    id,
    name,
    description,
    category,
    address_line1,
    city,
    state,
    phone,
    website,
    hours_of_operation,
    location,
    is_volunteer_resource
  FROM resources
  WHERE status = 'approved'
    AND location IS NOT NULL
    AND location::geometry && ST_MakeEnvelope(west, south, east, north, 4326)
  ORDER BY name
  LIMIT max_results;
$$;

-- Grant execute to anon and authenticated roles so Supabase client can call it
GRANT EXECUTE ON FUNCTION resources_in_bounds(double precision, double precision, double precision, double precision, integer)
  TO anon, authenticated;
