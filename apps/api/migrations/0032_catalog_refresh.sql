CREATE TABLE "catalog_refresh_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "checkpoint" jsonb,
  "movies_refreshed" integer NOT NULL DEFAULT 0,
  "series_refreshed" integer NOT NULL DEFAULT 0,
  "movies_imported" integer NOT NULL DEFAULT 0,
  "series_imported" integer NOT NULL DEFAULT 0,
  "failed_count" integer NOT NULL DEFAULT 0,
  "error_message" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_refresh_runs_running_idx" ON "catalog_refresh_runs" ("status") WHERE "status" = 'RUNNING';
