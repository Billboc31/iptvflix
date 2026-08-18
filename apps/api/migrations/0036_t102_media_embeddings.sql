-- Store embeddings as float8[] so Railway's stock Postgres can migrate
-- without the pgvector extension. Semantic search uses SQL cosine on the array.
CREATE TABLE IF NOT EXISTS "media_embeddings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "media_id" uuid NOT NULL,
  "media_type" text NOT NULL,
  "embedding" double precision[] NOT NULL,
  "model_provider" text NOT NULL,
  "model_name" text NOT NULL,
  "embedding_dimension" integer NOT NULL,
  "doc_hash" text NOT NULL,
  "generated_at" timestamptz NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "media_embeddings_media_model_idx"
  ON "media_embeddings" ("media_id", "media_type", "model_provider", "model_name");
