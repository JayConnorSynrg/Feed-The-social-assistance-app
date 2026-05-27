-- Add new resource_source enum values for public data integrations
ALTER TYPE resource_source ADD VALUE IF NOT EXISTS 'imls';
ALTER TYPE resource_source ADD VALUE IF NOT EXISTS 'dol';
ALTER TYPE resource_source ADD VALUE IF NOT EXISTS 'cms';
ALTER TYPE resource_source ADD VALUE IF NOT EXISTS 'npi';
ALTER TYPE resource_source ADD VALUE IF NOT EXISTS 'usajobs';
