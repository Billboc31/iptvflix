CREATE TABLE "recommendation_series_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"model_version" text NOT NULL,
	"cursor_reference" text
);
--> statement-breakpoint
CREATE INDEX "recommendation_series_sessions_profile_started_idx" ON "recommendation_series_sessions" ("profile_id","started_at");
--> statement-breakpoint
CREATE TABLE "series_discovery_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"declared_shelf_instance_ids" text[] DEFAULT '{}' NOT NULL,
	"invalidated_at" timestamp with time zone,
	CONSTRAINT "series_discovery_snapshots_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
ALTER TABLE "recommendation_series_sessions" ADD CONSTRAINT "recommendation_series_sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "series_discovery_snapshots" ADD CONSTRAINT "series_discovery_snapshots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "series_discovery_snapshots" ADD CONSTRAINT "series_discovery_snapshots_session_id_recommendation_series_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."recommendation_series_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shelf_instances" ADD COLUMN "series_session_id" uuid;
