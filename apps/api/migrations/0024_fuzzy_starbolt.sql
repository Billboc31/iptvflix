CREATE TYPE "public"."match_status" AS ENUM('PENDING', 'MATCHED', 'UNMATCHED');--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "match_status" "match_status" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "match_status" "match_status" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "title_matched_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "title_unmatched_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "movies" SET "match_status" = 'MATCHED' WHERE "tmdb_id" IS NOT NULL;--> statement-breakpoint
UPDATE "series" SET "match_status" = 'MATCHED' WHERE "tmdb_id" IS NOT NULL;