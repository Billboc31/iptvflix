-- T100: comprehensive profile interaction data capture
-- Creates viewing_sessions, persons tables; extends profile_interaction_events, media_credits, profile_taste

-- Create persons table for cast/crew recommendation features
CREATE TABLE IF NOT EXISTS "persons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tmdb_person_id" integer NOT NULL,
  "name" text NOT NULL,
  "profile_path" text,
  "fetched_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "persons_tmdb_person_id_unique" UNIQUE ("tmdb_person_id")
);--> statement-breakpoint

-- Create viewing_sessions table for structured playback session summaries
CREATE TABLE IF NOT EXISTS "viewing_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "media_type" text NOT NULL,
  "media_id" uuid NOT NULL,
  "episode_id" uuid,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "ended_at" timestamptz,
  "start_position_ms" integer NOT NULL DEFAULT 0,
  "end_position_ms" integer,
  "max_position_ms" integer NOT NULL DEFAULT 0,
  "watched_ms_approx" integer NOT NULL DEFAULT 0,
  "completed" boolean NOT NULL DEFAULT false,
  "device_type" text,
  "client_type" text,
  "source_id" uuid,
  "availability_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "viewing_sessions_profile_media_idx" ON "viewing_sessions" ("profile_id", "media_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "viewing_sessions_profile_started_idx" ON "viewing_sessions" ("profile_id", "started_at" DESC);--> statement-breakpoint

-- Extend profile_interaction_events with new signal columns
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "series_id" uuid;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "season_id" uuid;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "season_number" integer;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "progress_percent" integer;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "shelf_concept_id" text;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "shelf_position" integer;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "item_position_in_shelf" integer;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "search_query_normalized" text;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "availability_id" uuid;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "client_type" text;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "app_version" text;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "session_id" uuid REFERENCES "viewing_sessions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "referrer_surface" text;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "schema_version" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profile_interaction_events_idempotency_key_unique" ON "profile_interaction_events" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_interaction_events_profile_event_idx" ON "profile_interaction_events" ("profile_id", "event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_interaction_events_profile_media_idx" ON "profile_interaction_events" ("profile_id", "media_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_interaction_events_session_idx" ON "profile_interaction_events" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_interaction_events_occurred_at_idx" ON "profile_interaction_events" ("occurred_at" DESC);--> statement-breakpoint

-- Extend media_credits with person normalization and role detail
ALTER TABLE "media_credits" ADD COLUMN IF NOT EXISTS "tmdb_person_id" integer;--> statement-breakpoint
ALTER TABLE "media_credits" ADD COLUMN IF NOT EXISTS "person_id" uuid REFERENCES "persons"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "media_credits" ADD COLUMN IF NOT EXISTS "department" text;--> statement-breakpoint
ALTER TABLE "media_credits" ADD COLUMN IF NOT EXISTS "job" text;--> statement-breakpoint
ALTER TABLE "media_credits" ADD COLUMN IF NOT EXISTS "is_director" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "media_credits" ADD COLUMN IF NOT EXISTS "is_creator" boolean NOT NULL DEFAULT false;--> statement-breakpoint

-- Extend profile_taste with rich feature scores for recommendation models
ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "person_scores" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "person_meta" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "keyword_scores" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "franchise_scores" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "language_scores" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "country_scores" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "decade_scores" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "media_type_preferences" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "completion_rate" numeric;--> statement-breakpoint
ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "avg_progress_percent" integer;--> statement-breakpoint
ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "taste_version" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE "profile_taste" ADD COLUMN IF NOT EXISTS "history_event_count" integer NOT NULL DEFAULT 0;
