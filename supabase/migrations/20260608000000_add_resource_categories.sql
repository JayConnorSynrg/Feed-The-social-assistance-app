-- Migration: 20260608000000_add_resource_categories.sql
--
-- Adds 6 new resource_category enum values for Phase 1a discovery features.
--
-- APPLY METHOD: Supabase Management-API SQL endpoint, NOT `supabase db push`.
-- The local migration ledger (supabase_migrations.schema_migrations) is ~14 rows
-- behind the live schema; `db push` would fail with "already exists" on prior
-- migrations. DDL is applied directly via:
--
--   POST https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query
--   Authorization: Bearer $SUPABASE_ACCESS_TOKEN
--   {"query": "<SQL here>"}
--
-- All 6 statements are idempotent (IF NOT EXISTS). ADD VALUE is additive-only
-- and safe on PG 17.6 outside a multi-statement transaction that also USES
-- the new values.

DO $$ BEGIN
  ALTER TYPE resource_category ADD VALUE IF NOT EXISTS 'eitc_tax_filing';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE resource_category ADD VALUE IF NOT EXISTS 'free_legal';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE resource_category ADD VALUE IF NOT EXISTS 'prenatal_natal_care';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE resource_category ADD VALUE IF NOT EXISTS 'waste_disposal';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE resource_category ADD VALUE IF NOT EXISTS 'free_camping';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE resource_category ADD VALUE IF NOT EXISTS 'free_goods_donation';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
