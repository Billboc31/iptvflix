ALTER TABLE "movies" ADD COLUMN "metadata_provider" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "metadata_enriched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "metadata_provider" text;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "metadata_enriched_at" timestamp with time zone;