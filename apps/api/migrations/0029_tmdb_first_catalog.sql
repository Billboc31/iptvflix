CREATE TABLE "collections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tmdb_id" integer UNIQUE NOT NULL,
  "name" text NOT NULL,
  "overview" text,
  "poster_path" text,
  "backdrop_path" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "popularity" real;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "vote_count" integer;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "original_language" varchar(10);--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "spoken_languages" jsonb;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "production_countries" jsonb;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "keywords" jsonb;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "collection_id" uuid;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "external_ids" jsonb;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "tmdb_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movies" ADD CONSTRAINT "movies_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "popularity" real;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "vote_count" integer;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "original_language" varchar(10);--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "spoken_languages" jsonb;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "production_countries" jsonb;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "in_production" boolean;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "networks" jsonb;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "created_by" jsonb;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "number_of_seasons" integer;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "number_of_episodes" integer;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "keywords" jsonb;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "external_ids" jsonb;--> statement-breakpoint
ALTER TABLE "series" ADD COLUMN "tmdb_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "tmdb_id" integer;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "poster_path" text;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "episode_count" integer;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_tmdb_id_unique" UNIQUE("tmdb_id");--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "tmdb_id" integer;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "poster_path" text;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "vote_average" real;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "vote_count" integer;--> statement-breakpoint
ALTER TABLE "genres" ADD COLUMN "tmdb_id" integer;--> statement-breakpoint
ALTER TABLE "genres" ADD CONSTRAINT "genres_tmdb_id_unique" UNIQUE("tmdb_id");
