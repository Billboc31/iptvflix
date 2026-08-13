CREATE TYPE "public"."reconciliation_status" AS ENUM('RUNNING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TABLE "reconciliation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "reconciliation_status" NOT NULL,
	"media_type" text DEFAULT 'BOTH' NOT NULL,
	"cursor_movie_id" uuid,
	"cursor_series_id" uuid,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"matched_count" integer DEFAULT 0 NOT NULL,
	"merged_count" integer DEFAULT 0 NOT NULL,
	"ambiguous_count" integer DEFAULT 0 NOT NULL,
	"unmatched_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text
);--> statement-breakpoint
CREATE UNIQUE INDEX "reconciliation_runs_running_idx" ON "reconciliation_runs" ("status") WHERE "status" = 'RUNNING';
