ALTER TABLE "episode_availabilities" ADD COLUMN "audio_language" text;--> statement-breakpoint
ALTER TABLE "episode_availabilities" ADD COLUMN "subtitle_language" text;--> statement-breakpoint
ALTER TABLE "episode_availabilities" ADD COLUMN "video_quality" text;--> statement-breakpoint
ALTER TABLE "episode_availabilities" ADD COLUMN "raw_title" text;--> statement-breakpoint
ALTER TABLE "movie_availabilities" ADD COLUMN "audio_language" text;--> statement-breakpoint
ALTER TABLE "movie_availabilities" ADD COLUMN "subtitle_language" text;--> statement-breakpoint
ALTER TABLE "movie_availabilities" ADD COLUMN "video_quality" text;--> statement-breakpoint
ALTER TABLE "movie_availabilities" ADD COLUMN "raw_title" text;--> statement-breakpoint
ALTER TABLE "series_availabilities" ADD COLUMN "audio_language" text;--> statement-breakpoint
ALTER TABLE "series_availabilities" ADD COLUMN "subtitle_language" text;--> statement-breakpoint
ALTER TABLE "series_availabilities" ADD COLUMN "video_quality" text;--> statement-breakpoint
ALTER TABLE "series_availabilities" ADD COLUMN "raw_title" text;
