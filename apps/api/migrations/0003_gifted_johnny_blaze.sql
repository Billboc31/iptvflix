CREATE TYPE "public"."availability_status" AS ENUM('AVAILABLE', 'UNAVAILABLE');--> statement-breakpoint
CREATE TYPE "public"."sync_run_status" AS ENUM('RUNNING', 'COMPLETED', 'FAILED');--> statement-breakpoint
ALTER TABLE "movie_availabilities" ADD COLUMN "status" "availability_status" DEFAULT 'AVAILABLE' NOT NULL;--> statement-breakpoint
ALTER TABLE "movie_availabilities" ADD COLUMN "unavailable_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movie_availabilities" ADD CONSTRAINT "movie_availabilities_provider_id_provider_item_id_unique" UNIQUE("provider_id","provider_item_id");--> statement-breakpoint
CREATE TABLE "series_availabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"series_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"provider_item_id" text NOT NULL,
	"status" "availability_status" DEFAULT 'AVAILABLE' NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"unavailable_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_availabilities_series_id_provider_id_provider_item_id_unique" UNIQUE("series_id","provider_id","provider_item_id"),
	CONSTRAINT "series_availabilities_provider_id_provider_item_id_unique" UNIQUE("provider_id","provider_item_id")
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "sync_run_status" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"movies_created" integer DEFAULT 0 NOT NULL,
	"movies_updated" integer DEFAULT 0 NOT NULL,
	"series_created" integer DEFAULT 0 NOT NULL,
	"series_updated" integer DEFAULT 0 NOT NULL,
	"unavailable_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "series_availabilities" ADD CONSTRAINT "series_availabilities_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sync_runs_source_running_idx" ON "sync_runs" USING btree ("source_id") WHERE "status" = 'RUNNING';
