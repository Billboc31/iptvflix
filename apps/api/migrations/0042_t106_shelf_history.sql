CREATE TABLE "shelf_instances" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "profile_id" uuid NOT NULL,
    "shelf_concept_id" uuid,
    "title" text NOT NULL,
    "semantic_intent_snapshot" text,
    "generation_type" text,
    "generation_reason_codes" jsonb DEFAULT '[]' NOT NULL,
    "home_session_id" uuid,
    "vertical_position" integer,
    "ranker_version" text NOT NULL,
    "query_planner_version" text NOT NULL,
    "embedding_model_version" text NOT NULL,
    "candidate_count" integer,
    "final_item_count" integer,
    "latency_ms" integer,
    "cache_hit" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "first_displayed_at" timestamp with time zone,
    "last_displayed_at" timestamp with time zone,
    "expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shelf_instance_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "shelf_instance_id" uuid NOT NULL,
    "media_type" text NOT NULL,
    "media_id" uuid NOT NULL,
    "rank_position" integer NOT NULL,
    "semantic_score" real,
    "profile_score" real,
    "final_score" real,
    "diversity_adjustment" real,
    "availability_status" text,
    "reason_codes" jsonb DEFAULT '[]' NOT NULL,
    "was_eligible_at_generation" boolean DEFAULT true NOT NULL,
    "was_visible" boolean DEFAULT false NOT NULL,
    "opened_at" timestamp with time zone,
    "played_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recommendation_home_sessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "profile_id" uuid NOT NULL,
    "started_at" timestamp with time zone DEFAULT now() NOT NULL,
    "expires_at" timestamp with time zone,
    "model_version" text NOT NULL,
    "cursor_reference" text
);
--> statement-breakpoint
CREATE TABLE "shelf_concept_fatigue" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "profile_id" uuid NOT NULL,
    "shelf_concept_id" uuid NOT NULL,
    "impression_count" integer DEFAULT 0 NOT NULL,
    "visible_impression_count" integer DEFAULT 0 NOT NULL,
    "zero_interaction_streak_count" integer DEFAULT 0 NOT NULL,
    "last_shown_at" timestamp with time zone,
    "cooldown_until" timestamp with time zone,
    "suppression_reason" text,
    "suppression_version" text,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_media_exposure" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "profile_id" uuid NOT NULL,
    "media_type" text NOT NULL,
    "media_id" uuid NOT NULL,
    "exposure_count" integer DEFAULT 0 NOT NULL,
    "first_exposed_at" timestamp with time zone DEFAULT now() NOT NULL,
    "last_exposed_at" timestamp with time zone DEFAULT now() NOT NULL,
    "open_count" integer DEFAULT 0 NOT NULL,
    "play_count" integer DEFAULT 0 NOT NULL,
    "last_opened_at" timestamp with time zone,
    "last_played_at" timestamp with time zone,
    "shown_in_concept_ids" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_interaction_events" ADD COLUMN "shelf_instance_id" uuid;
--> statement-breakpoint
ALTER TABLE "shelf_instances" ADD CONSTRAINT "shelf_instances_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shelf_instances" ADD CONSTRAINT "shelf_instances_shelf_concept_id_shelf_concepts_id_fk" FOREIGN KEY ("shelf_concept_id") REFERENCES "public"."shelf_concepts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shelf_instance_items" ADD CONSTRAINT "shelf_instance_items_shelf_instance_id_shelf_instances_id_fk" FOREIGN KEY ("shelf_instance_id") REFERENCES "public"."shelf_instances"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recommendation_home_sessions" ADD CONSTRAINT "recommendation_home_sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shelf_concept_fatigue" ADD CONSTRAINT "shelf_concept_fatigue_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shelf_concept_fatigue" ADD CONSTRAINT "shelf_concept_fatigue_shelf_concept_id_shelf_concepts_id_fk" FOREIGN KEY ("shelf_concept_id") REFERENCES "public"."shelf_concepts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "profile_media_exposure" ADD CONSTRAINT "profile_media_exposure_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "shelf_instances_profile_created_idx" ON "shelf_instances" ("profile_id","created_at");
--> statement-breakpoint
CREATE INDEX "shelf_instances_concept_created_idx" ON "shelf_instances" ("shelf_concept_id","created_at");
--> statement-breakpoint
CREATE INDEX "shelf_instance_items_instance_rank_idx" ON "shelf_instance_items" ("shelf_instance_id","rank_position");
--> statement-breakpoint
CREATE INDEX "recommendation_home_sessions_profile_started_idx" ON "recommendation_home_sessions" ("profile_id","started_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "shelf_concept_fatigue_profile_concept_idx" ON "shelf_concept_fatigue" ("profile_id","shelf_concept_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "profile_media_exposure_profile_type_media_idx" ON "profile_media_exposure" ("profile_id","media_type","media_id");
--> statement-breakpoint
CREATE INDEX "profile_media_exposure_profile_exposed_idx" ON "profile_media_exposure" ("profile_id","last_exposed_at");
