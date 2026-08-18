-- Create segment_type enum
CREATE TYPE IF NOT EXISTS "segment_type" AS ENUM ('RECAP', 'INTRO', 'OUTRO', 'CREDITS', 'PREVIEW');--> statement-breakpoint

-- Create media_segments table
CREATE TABLE IF NOT EXISTS "media_segments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "episode_id" uuid NOT NULL REFERENCES "episodes"("id") ON DELETE CASCADE,
  "type" "segment_type" NOT NULL,
  "start_ms" integer NOT NULL,
  "end_ms" integer NOT NULL,
  "source_provider" text NOT NULL,
  "source_external_id" text,
  "confidence" real,
  "submission_count" integer,
  "status" text,
  "source_updated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "media_segments_episode_id_type_source_provider_unique" UNIQUE ("episode_id", "type", "source_provider")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_segments_episode_idx" ON "media_segments" ("episode_id");
