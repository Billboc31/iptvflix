ALTER TABLE "episode_availabilities" ADD COLUMN "status" "availability_status" DEFAULT 'AVAILABLE' NOT NULL;--> statement-breakpoint
ALTER TABLE "episode_availabilities" ADD COLUMN "unavailable_at" timestamp with time zone;
