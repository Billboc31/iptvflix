-- Remove pre-existing cross-episode duplicates (keep earliest firstSeenAt; break ties by id asc)
DELETE FROM episode_availabilities
WHERE id NOT IN (
  SELECT DISTINCT ON (provider_id, provider_item_id) id
  FROM episode_availabilities
  ORDER BY provider_id, provider_item_id, first_seen_at ASC, id ASC
);--> statement-breakpoint

-- Add cross-episode uniqueness constraint (mirrors movie_availabilities / series_availabilities)
ALTER TABLE "episode_availabilities" ADD CONSTRAINT "episode_availabilities_provider_id_provider_item_id_unique" UNIQUE("provider_id","provider_item_id");
