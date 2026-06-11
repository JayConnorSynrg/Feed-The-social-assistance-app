-- Supersedes 20260610220000: that migration used SET search_path TO 'public, extensions'
-- (single-quoted, embedded comma) which Postgres stored as one invalid schema -> empty effective
-- search_path -> 42P01 in the 9 geo SECDEF functions. This re-applies the UNQUOTED list form
-- `SET search_path TO public, extensions`, which stores as a real 2-element list.
-- On a fresh reset, 220000 applies then this file corrects it; the transient state is harmless
-- (no app traffic mid-migration).

ALTER FUNCTION public.geocode_profile_location() SET search_path TO public, extensions;
ALTER FUNCTION public.nearby_resources(double precision, double precision, double precision) SET search_path TO public, extensions;
ALTER FUNCTION public.notify_seekers_near_resource(uuid, double precision) SET search_path TO public, extensions;
ALTER FUNCTION public.place_safety_alert(text, integer, text, double precision, double precision) SET search_path TO public, extensions;
ALTER FUNCTION public.resources_in_bounds(double precision, double precision, double precision, double precision, integer) SET search_path TO public, extensions;
ALTER FUNCTION public.safety_alerts_in_view(double precision, double precision, double precision, double precision) SET search_path TO public, extensions;
ALTER FUNCTION public.seekers_within_radius(uuid, double precision) SET search_path TO public, extensions;
ALTER FUNCTION public.set_resource_location(text, text, double precision, double precision) SET search_path TO public, extensions;
ALTER FUNCTION public.set_resource_location_by_id(uuid, double precision, double precision) SET search_path TO public, extensions;
