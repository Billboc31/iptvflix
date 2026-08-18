CREATE TYPE "public"."shelf_concept_generation_type" AS ENUM('PERSONALIZED', 'EXPLORATION', 'DISCOVERY', 'FIXED', 'EDITORIAL');--> statement-breakpoint
CREATE TABLE "shelf_concepts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "profile_id" uuid,
    "title" text NOT NULL,
    "raw_intent" text NOT NULL,
    "semantic_intent" text NOT NULL,
    "generation_type" "shelf_concept_generation_type" NOT NULL,
    "reason_codes" jsonb DEFAULT '[]' NOT NULL,
    "source_model" text NOT NULL,
    "prompt_version" text NOT NULL,
    "desired_media_types" jsonb DEFAULT '[]' NOT NULL,
    "freshness_policy" text,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone,
    "reach_count" integer DEFAULT 0 NOT NULL,
    "open_count" integer DEFAULT 0 NOT NULL,
    "play_count" integer DEFAULT 0 NOT NULL,
    "completion_count" integer DEFAULT 0 NOT NULL,
    "dismiss_count" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
ALTER TABLE "shelf_concepts" ADD CONSTRAINT "shelf_concepts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shelf_concepts_profile_active_created_idx" ON "shelf_concepts" ("profile_id", "active", "created_at");
