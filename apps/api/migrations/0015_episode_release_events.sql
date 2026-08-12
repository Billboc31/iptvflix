CREATE TYPE "release_event_media_type" AS ENUM('MOVIE', 'SERIES', 'EPISODE');--> statement-breakpoint
ALTER TABLE "release_events" ALTER COLUMN "media_type" TYPE "release_event_media_type" USING "media_type"::text::"release_event_media_type";
