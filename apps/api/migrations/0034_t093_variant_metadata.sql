ALTER TABLE "movie_availabilities" ADD COLUMN IF NOT EXISTS "codec_name" text;--> statement-breakpoint
ALTER TABLE "movie_availabilities" ADD COLUMN IF NOT EXISTS "hdr_format" text;--> statement-breakpoint
ALTER TABLE "movie_availabilities" ADD COLUMN IF NOT EXISTS "release_hint" text;--> statement-breakpoint
ALTER TABLE "movie_availabilities" ADD COLUMN IF NOT EXISTS "audio_format" text;--> statement-breakpoint
ALTER TABLE "series_availabilities" ADD COLUMN IF NOT EXISTS "codec_name" text;--> statement-breakpoint
ALTER TABLE "series_availabilities" ADD COLUMN IF NOT EXISTS "hdr_format" text;--> statement-breakpoint
ALTER TABLE "series_availabilities" ADD COLUMN IF NOT EXISTS "release_hint" text;--> statement-breakpoint
ALTER TABLE "series_availabilities" ADD COLUMN IF NOT EXISTS "audio_format" text;--> statement-breakpoint
ALTER TABLE "episode_availabilities" ADD COLUMN IF NOT EXISTS "codec_name" text;--> statement-breakpoint
ALTER TABLE "episode_availabilities" ADD COLUMN IF NOT EXISTS "hdr_format" text;--> statement-breakpoint
ALTER TABLE "episode_availabilities" ADD COLUMN IF NOT EXISTS "release_hint" text;--> statement-breakpoint
ALTER TABLE "episode_availabilities" ADD COLUMN IF NOT EXISTS "audio_format" text;
