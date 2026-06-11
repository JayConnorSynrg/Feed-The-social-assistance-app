-- Wave-1-A pre-step: expand search_path of geo SECURITY DEFINER functions to include `extensions`.
-- Purpose: a subsequent PostGIS extension relocation from `public` to `extensions` (owner action via
-- Supabase Support) would otherwise break unqualified ST_*/geography resolution in these SECDEF
-- functions, which are pinned to `SET search_path TO 'public'`. Adding `extensions` is additive and
-- idempotent: while PostGIS still lives in `public`, behavior is unchanged (public stays on the path);
-- the `extensions` entry becomes load-bearing only after relocation. No type/signature changes.

ALTER FUNCTION public.geocode_profile_location() SET search_path TO 'public, extensions';
ALTER FUNCTION public.nearby_resources(double precision, double precision, double precision) SET search_path TO 'public, extensions';
ALTER FUNCTION public.notify_seekers_near_resource(uuid, double precision) SET search_path TO 'public, extensions';
ALTER FUNCTION public.place_safety_alert(text, integer, text, double precision, double precision) SET search_path TO 'public, extensions';
ALTER FUNCTION public.resources_in_bounds(double precision, double precision, double precision, double precision, integer) SET search_path TO 'public, extensions';
ALTER FUNCTION public.safety_alerts_in_view(double precision, double precision, double precision, double precision) SET search_path TO 'public, extensions';
ALTER FUNCTION public.seekers_within_radius(uuid, double precision) SET search_path TO 'public, extensions';
ALTER FUNCTION public.set_resource_location(text, text, double precision, double precision) SET search_path TO 'public, extensions';
ALTER FUNCTION public.set_resource_location_by_id(uuid, double precision, double precision) SET search_path TO 'public, extensions';
