CREATE TYPE "public"."release_event_type" AS ENUM('ANNOUNCED', 'THEATRICAL_RELEASE', 'DIGITAL_RELEASE', 'SOURCE_APPEARED', 'SOURCE_DISAPPEARED');--> statement-breakpoint
CREATE TABLE "follow_release" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"media_type" "watchlist_media_type" NOT NULL,
	"media_id" uuid NOT NULL,
	"followed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_release_profile_id_media_type_media_id_unique" UNIQUE("profile_id","media_type","media_id")
);
--> statement-breakpoint
CREATE TABLE "release_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_type" "watchlist_media_type" NOT NULL,
	"media_id" uuid NOT NULL,
	"event_type" "release_event_type" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_events_media_type_media_id_event_type_occurred_at_unique" UNIQUE("media_type","media_id","event_type","occurred_at")
);
--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "announced_at" date;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "theatrical_release_date" date;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "digital_release_date" date;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "announced_at" date;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "theatrical_release_date" date;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "digital_release_date" date;--> statement-breakpoint
ALTER TABLE "follow_release" ADD CONSTRAINT "follow_release_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_events" ADD CONSTRAINT "release_events_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;