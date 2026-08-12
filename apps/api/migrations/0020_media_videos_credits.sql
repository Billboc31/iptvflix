ALTER TABLE "movies" ADD COLUMN "vote_average" real;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "certification" text;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "vote_average" real;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "certification" text;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "status" text;--> statement-breakpoint
CREATE TABLE "media_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_type" text NOT NULL,
	"media_id" uuid NOT NULL,
	"youtube_key" text NOT NULL,
	"video_type" text NOT NULL,
	"official" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_type" text NOT NULL,
	"media_id" uuid NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"character" text,
	"credit_order" integer NOT NULL,
	"profile_path" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
