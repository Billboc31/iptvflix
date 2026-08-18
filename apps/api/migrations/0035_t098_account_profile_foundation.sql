-- Create accounts table
CREATE TABLE IF NOT EXISTS "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "username" text NOT NULL,
  "password_hash" text NOT NULL,
  "email" text,
  "max_profiles" integer NOT NULL DEFAULT 5,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_username_unique" UNIQUE("username");--> statement-breakpoint

-- Extend profiles with account link and new preference columns
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "account_id" uuid REFERENCES "accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "avatar_key" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "is_kids" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "maturity_level" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "preferred_ui_language" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "subtitles_enabled_preference" boolean;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "autoplay_next_episode" boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "auto_skip_intro" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "auto_skip_recap" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "never_stop_mode" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "last_used_at" timestamptz;--> statement-breakpoint

-- Create profile_interaction_events table
CREATE TABLE IF NOT EXISTS "profile_interaction_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "media_type" text,
  "media_id" uuid,
  "episode_id" uuid,
  "event_type" text NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "position_ms" integer,
  "duration_ms" integer,
  "shelf_id" uuid,
  "device_type" text,
  "source_id" uuid,
  "metadata_json" jsonb
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_interaction_events_profile_occurred_idx"
  ON "profile_interaction_events" ("profile_id", "occurred_at" DESC);
