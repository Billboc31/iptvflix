ALTER TABLE "profiles" ADD COLUMN "preferred_audio_languages" text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "preferred_subtitle_languages" text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "preferred_source_ids" text[] NOT NULL DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "max_video_quality" text;
