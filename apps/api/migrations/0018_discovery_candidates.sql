CREATE TABLE "discovery_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"media_type" "media_type" NOT NULL,
	"title" text NOT NULL,
	"year" integer,
	"synopsis" text,
	"poster_path" text,
	"popularity" double precision,
	"vote_average" double precision,
	"release_status" text,
	"provenance" text NOT NULL,
	"canonical_movie_id" uuid,
	"canonical_series_id" uuid,
	"refreshed_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_candidates_external_id_media_type_unique" UNIQUE("external_id","media_type")
);
--> statement-breakpoint
ALTER TABLE "profile_taste" ALTER COLUMN "genre_scores" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "profile_taste" ALTER COLUMN "genre_meta" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_canonical_movie_id_movies_id_fk" FOREIGN KEY ("canonical_movie_id") REFERENCES "public"."movies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_candidates" ADD CONSTRAINT "discovery_candidates_canonical_series_id_series_id_fk" FOREIGN KEY ("canonical_series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discovery_candidates_expires_at_idx" ON "discovery_candidates" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "discovery_candidates_media_type_expires_at_idx" ON "discovery_candidates" USING btree ("media_type","expires_at");