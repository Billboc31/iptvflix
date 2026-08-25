CREATE TABLE "channel_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_favorites_profile_id_channel_id_unique" UNIQUE("profile_id","channel_id")
);

CREATE TABLE "channel_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"watched_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "channel_favorites" ADD CONSTRAINT "channel_favorites_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "channel_favorites" ADD CONSTRAINT "channel_favorites_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "channel_history" ADD CONSTRAINT "channel_history_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "channel_history" ADD CONSTRAINT "channel_history_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;
