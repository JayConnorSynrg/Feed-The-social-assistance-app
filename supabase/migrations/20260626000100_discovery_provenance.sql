-- Discovery provenance columns for admin resource-sourcing review tiles.
--
-- Phase B of the admin resource-sourcing feature: the resource-discover edge
-- function sources candidate resources/forms, verifies provenance
-- (authoritative-domain OR >=2 corroborating sources), and STAGES them as
-- pending for human review in the Resources tab (Phase C).
--
-- discovery_metadata holds the provenance the reviewer needs to judge a tile:
--   {
--     source_url:            text   -- primary citation
--     confidence:            text   -- 'high' | 'medium'
--     corroborating_count:   int    -- distinct source hosts
--     authoritative_domain:  bool   -- any source host ends in .gov / .org
--     query:                 text   -- the admin natural-language query
--     discovered_at:         text   -- ISO timestamp
--     sources:               text[] -- all citation URLs
--   }
--
-- Additive + non-breaking: nullable jsonb columns, no constraint changes,
-- no impact on existing rows or RLS.

alter table public.resources
  add column if not exists discovery_metadata jsonb;

alter table public.form_templates
  add column if not exists discovery_metadata jsonb;
