CREATE TYPE "public"."match_state" AS ENUM('MATCHED', 'UNMATCHED', 'AMBIGUOUS');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('MOVIE', 'SERIES');--> statement-breakpoint
CREATE TABLE "title_match_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"provider_item_id" varchar(255) NOT NULL,
	"media_type" "media_type" NOT NULL,
	"raw_title" text NOT NULL,
	"normalized_title" text NOT NULL,
	"extracted_year" integer,
	"match_state" "match_state" NOT NULL,
	"movie_id" uuid,
	"series_id" uuid,
	"confidence" numeric(5, 4),
	"candidate_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"matched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "title_match_results_provider_id_provider_item_id_unique" UNIQUE("provider_id","provider_item_id")
);
--> statement-breakpoint
ALTER TABLE "title_match_results" ADD CONSTRAINT "title_match_results_provider_id_sources_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_match_results" ADD CONSTRAINT "title_match_results_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_match_results" ADD CONSTRAINT "title_match_results_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;