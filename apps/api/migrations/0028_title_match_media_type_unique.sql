-- Movie and series Xtream ids often collide (both "12345"). The old unique key
-- (provider_id, provider_item_id) let a SERIES match overwrite a MOVIE match and
-- vice versa, causing FK failures when sync attached a series UUID as movie_id.
ALTER TABLE "title_match_results" DROP CONSTRAINT IF EXISTS "title_match_results_provider_id_provider_item_id_unique";--> statement-breakpoint
ALTER TABLE "title_match_results" ADD CONSTRAINT "title_match_results_provider_item_media_unique" UNIQUE("provider_id","provider_item_id","media_type");
