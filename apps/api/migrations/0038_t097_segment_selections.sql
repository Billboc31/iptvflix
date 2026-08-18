-- Create segment_selections table for merged multi-provider segment results
CREATE TABLE IF NOT EXISTS "segment_selections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "episode_id" uuid NOT NULL REFERENCES "episodes"("id") ON DELETE CASCADE,
  "type" "segment_type" NOT NULL,
  "start_ms" integer NOT NULL,
  "end_ms" integer NOT NULL,
  "selected_provider" text NOT NULL,
  "selection_reason" text NOT NULL,
  "provenance" jsonb NOT NULL DEFAULT '[]',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "segment_selections_episode_id_type_unique" UNIQUE ("episode_id", "type")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "segment_selections_episode_idx" ON "segment_selections" ("episode_id");
