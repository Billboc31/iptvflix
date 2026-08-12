CREATE TABLE "profile_taste" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"genre_scores" jsonb DEFAULT '{}' NOT NULL,
	"genre_meta" jsonb DEFAULT '{}' NOT NULL,
	"positive_media_ids" text[] DEFAULT '{}' NOT NULL,
	"negative_media_ids" text[] DEFAULT '{}' NOT NULL,
	"signal_count" integer DEFAULT 0 NOT NULL,
	"built_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_taste" ADD CONSTRAINT "profile_taste_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
