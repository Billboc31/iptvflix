-- Upgrade embeddings to pgvector when the extension is installable.
-- No-op on stock Railway Postgres (vector not in pg_available_extensions).
DO $upgrade$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    RAISE NOTICE 'pgvector is not available; media_embeddings stays on float8[]';
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS vector;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'media_embeddings'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'media_embeddings'
      AND column_name = 'embedding'
      AND udt_name IN ('_float8', 'float8', '_float4')
  ) THEN
    ALTER TABLE media_embeddings
      ALTER COLUMN embedding TYPE vector(1536)
      USING embedding::vector;
  END IF;

  BEGIN
    CREATE INDEX IF NOT EXISTS media_embeddings_hnsw_idx
      ON media_embeddings USING hnsw (embedding vector_cosine_ops);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'HNSW index skipped: %', SQLERRM;
  END;
END
$upgrade$;
