CREATE INDEX "movies_vote_average_idx" ON "movies" ("vote_average" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX "series_vote_average_idx" ON "series" ("vote_average" DESC NULLS LAST);
