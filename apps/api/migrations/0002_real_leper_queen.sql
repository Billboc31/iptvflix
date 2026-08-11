CREATE TYPE "public"."source_type" AS ENUM('XTREAM', 'M3U');--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "source_type" NOT NULL,
	"base_url" text NOT NULL,
	"username" text,
	"password" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
