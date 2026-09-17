-- One-time data cleanup: re-categorize mis-tagged trail shelters out of `housing`.
--
-- Root cause: the OSM resource-sync ingestion path assigns `category = 'housing'`
-- to `amenity=shelter` nodes without distinguishing backcountry trail lean-tos
-- from housing-assistance shelters. This mis-tagged 10 Vermont Long Trail /
-- Appalachian Trail lean-to shelters (all `source = 'osm'`) as `housing`.
--
-- Verified filter (adversarially measured both directions, 0 false positives,
-- 0 false negatives): `category = 'housing' AND source = 'osm'` matches exactly
-- these 10 rows:
--   Governor Clement Shelter, Stony Brook Shelter, Minerva Hinchey Shelter,
--   Tucker Johnson Shelter, Greenwall Shelter, Russell Hill Shelter,
--   Churchill Scott Shelter, Rolston Rest Shelter, David Logan Shelter,
--   Tinker Brook Shelter
--
-- The only real homeless/social-services shelter in `housing` with "Shelter"
-- in its name is HUD-sourced (`source = 'hud'`) and is untouched by this filter.
--
-- `free_camping` is an existing `resource_category` enum value and is the
-- correct destination category: these remain visible in-app as backcountry
-- shelters, just out of the housing-assistance category.
--
-- Idempotent: a second run matches 0 rows since the 10 rows are no longer
-- `category = 'housing'` after this migration applies.

UPDATE public.resources
SET category = 'free_camping', updated_at = now()
WHERE category = 'housing' AND source = 'osm';
