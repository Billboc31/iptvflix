CREATE TYPE "public"."watchlist_media_type" AS ENUM('MOVIE', 'SERIES');--> statement-breakpoint
CREATE TYPE "public"."progress_media_type" AS ENUM('MOVIE', 'EPISODE');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"media_type" "watchlist_media_type" NOT NULL,
	"media_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_profile_id_media_type_media_id_unique" UNIQUE("profile_id","media_type","media_id")
);
--> statement-breakpoint
CREATE TABLE "viewing_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"media_type" "progress_media_type" NOT NULL,
	"media_id" uuid NOT NULL,
	"progress_seconds" integer NOT NULL,
	"duration_seconds" integer NOT NULL,
	"last_watched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "viewing_progress_profile_id_media_type_media_id_unique" UNIQUE("profile_id","media_type","media_id")
);
--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewing_progress" ADD CONSTRAINT "viewing_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "profiles" ("id", "name") VALUES ('00000000-0000-0000-0000-000000000001', 'Default') ON CONFLICT DO NOTHING;