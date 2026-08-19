ALTER TABLE "profile_taste" ADD COLUMN "disliked_media_ids" text[] NOT NULL DEFAULT '{}';
ALTER TABLE "profile_taste" ADD COLUMN "not_interested_media_ids" text[] NOT NULL DEFAULT '{}';
