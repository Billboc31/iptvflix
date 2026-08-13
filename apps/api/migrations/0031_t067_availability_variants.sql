ALTER TABLE "movie_availabilities" ADD COLUMN "container_extension" text;
--> statement-breakpoint
ALTER TABLE "series_availabilities" ADD COLUMN "container_extension" text;
--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "resolved_count" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "ambiguous_count" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "unresolved_count" integer NOT NULL DEFAULT 0;
