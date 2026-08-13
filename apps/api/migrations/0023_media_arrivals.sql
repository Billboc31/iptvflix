CREATE TABLE "media_arrivals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"media_type" "watchlist_media_type" NOT NULL,
	"media_id" uuid NOT NULL,
	"source_id" uuid,
	"release_event_id" uuid NOT NULL,
	"arrived_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_arrivals_profile_id_release_event_id_unique" UNIQUE("profile_id","release_event_id")
);
--> statement-breakpoint
ALTER TABLE "media_arrivals" ADD CONSTRAINT "media_arrivals_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_arrivals" ADD CONSTRAINT "media_arrivals_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_arrivals" ADD CONSTRAINT "media_arrivals_release_event_id_release_events_id_fk" FOREIGN KEY ("release_event_id") REFERENCES "public"."release_events"("id") ON DELETE restrict ON UPDATE no action;