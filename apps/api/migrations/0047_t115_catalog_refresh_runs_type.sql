-- T115: add type column to catalog_refresh_runs to distinguish REFRESH vs ENRICH_MISSING runs
ALTER TABLE catalog_refresh_runs ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'REFRESH';
