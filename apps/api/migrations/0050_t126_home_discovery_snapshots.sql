CREATE TABLE "home_discovery_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"declared_shelf_instance_ids" text[] DEFAULT '{}' NOT NULL,
	"hero_media_id" text,
	"hero_media_type" text,
	"invalidated_at" timestamp with time zone,
	CONSTRAINT "home_discovery_snapshots_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
ALTER TABLE "home_discovery_snapshots" ADD CONSTRAINT "home_discovery_snapshots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "home_discovery_snapshots" ADD CONSTRAINT "home_discovery_snapshots_session_id_recommendation_home_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."recommendation_home_sessions"("id") ON DELETE cascade ON UPDATE no action;
