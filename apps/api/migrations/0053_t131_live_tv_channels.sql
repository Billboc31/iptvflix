CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"logo_url" text,
	"language" text,
	"country" text,
	"tvg_id" text,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "channel_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"provider_item_id" text NOT NULL,
	"provider_name" text NOT NULL,
	"stream_url" text NOT NULL,
	"tvg_id" text,
	"tvg_logo" text,
	"group_title" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"match_confidence" real NOT NULL,
	"match_provenance" jsonb NOT NULL,
	"status" "availability_status" DEFAULT 'AVAILABLE' NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"unavailable_at" timestamp with time zone,
	CONSTRAINT "channel_sources_source_id_provider_item_id_unique" UNIQUE("source_id","provider_item_id")
);

ALTER TABLE "channel_sources" ADD CONSTRAINT "channel_sources_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "channel_sources" ADD CONSTRAINT "channel_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;
