CREATE TABLE "movies_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"cursor_reference" text,
	CONSTRAINT "movies_sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "movies_sessions_profile_started_idx" ON "movies_sessions" ("profile_id","started_at");
--> statement-breakpoint
CREATE TABLE "movies_discovery_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"declared_shelf_instance_ids" text[] DEFAULT '{}' NOT NULL,
	"invalidated_at" timestamp with time zone,
	CONSTRAINT "movies_discovery_snapshots_profile_id_unique" UNIQUE("profile_id"),
	CONSTRAINT "movies_discovery_snapshots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
ALTER TABLE "shelf_instances" ADD COLUMN "movies_session_id" uuid;
