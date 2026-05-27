-- Extend resource_source enum with external data provider values.
-- Using ADD VALUE IF NOT EXISTS so this migration is idempotent.

ALTER TYPE resource_source ADD VALUE IF NOT EXISTS 'osm';
ALTER TYPE resource_source ADD VALUE IF NOT EXISTS 'snap';
ALTER TYPE resource_source ADD VALUE IF NOT EXISTS 'hrsa';
ALTER TYPE resource_source ADD VALUE IF NOT EXISTS 'hud';
ALTER TYPE resource_source ADD VALUE IF NOT EXISTS 'headstart';
ALTER TYPE resource_source ADD VALUE IF NOT EXISTS 'cdc';
ALTER TYPE resource_source ADD VALUE IF NOT EXISTS 'samhsa';

-- Add a unique constraint on (external_id, source) so upserts are idempotent
-- across any external provider. Only add when both columns are non-null.
-- Using a partial unique index because external_id is nullable.
CREATE UNIQUE INDEX IF NOT EXISTS resources_external_id_source_uniq
  ON public.resources (external_id, source)
  WHERE external_id IS NOT NULL AND source IS NOT NULL;

-- Helper function called by the resource-sync Edge Function to set the
-- PostGIS geography column after upsert (Supabase JS upsert cannot express
-- ST_MakePoint inline).
CREATE OR REPLACE FUNCTION public.set_resource_location(
  p_external_id TEXT,
  p_source      TEXT,
  p_lat         DOUBLE PRECISION,
  p_lng         DOUBLE PRECISION
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.resources
  SET location = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  WHERE external_id = p_external_id
    AND source::text  = p_source;
$$;
