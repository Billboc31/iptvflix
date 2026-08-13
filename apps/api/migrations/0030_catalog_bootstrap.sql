CREATE TABLE "catalog_bootstrap_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "checkpoint" jsonb,
  "movies_created" integer NOT NULL DEFAULT 0,
  "movies_updated" integer NOT NULL DEFAULT 0,
  "series_created" integer NOT NULL DEFAULT 0,
  "series_updated" integer NOT NULL DEFAULT 0,
  "failed_count" integer NOT NULL DEFAULT 0,
  "error_message" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_bootstrap_runs_running_idx" ON "catalog_bootstrap_runs" ("status") WHERE "status" = 'RUNNING';
--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "localizations" jsonb;
--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "localizations" jsonb;
--> statement-breakpoint
CREATE INDEX "movies_popularity_idx" ON "movies" ("popularity" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "movies_original_language_idx" ON "movies" ("original_language");
--> statement-breakpoint
CREATE INDEX "movies_year_idx" ON "movies" ("year");
--> statement-breakpoint
CREATE INDEX "series_popularity_idx" ON "series" ("popularity" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "series_original_language_idx" ON "series" ("original_language");
--> statement-breakpoint
CREATE INDEX "series_first_air_year_idx" ON "series" ("first_air_year");
--> statement-breakpoint
CREATE INDEX "movie_genres_genre_id_idx" ON "movie_genres" ("genre_id");
--> statement-breakpoint
CREATE INDEX "series_genres_genre_id_idx" ON "series_genres" ("genre_id");
