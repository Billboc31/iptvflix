-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint

-- Media embeddings table: stores one row per (media, model) pair
CREATE TABLE IF NOT EXISTS "media_embeddings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "media_id" uuid NOT NULL,
  "media_type" text NOT NULL,
  "embedding" vector(1536),
  "model_provider" text NOT NULL,
  "model_name" text NOT NULL,
  "embedding_dimension" integer NOT NULL,
  "doc_hash" text NOT NULL,
  "generated_at" timestamptz NOT NULL
);--> statement-breakpoint

-- Unique index: one embedding row per (media, model_provider, model_name)
CREATE UNIQUE INDEX IF NOT EXISTS "media_embeddings_media_model_idx"
  ON "media_embeddings" ("media_id", "media_type", "model_provider", "model_name");--> statement-breakpoint

-- HNSW approximate nearest-neighbour index (cosine distance, pgvector >= 0.5)
-- Falls back to exact search if not created (pgvector < 0.5 does not support HNSW;
-- replace with IVFFlat if needed: CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100))
CREATE INDEX IF NOT EXISTS "media_embeddings_hnsw_idx"
  ON "media_embeddings" USING hnsw (embedding vector_cosine_ops);
