CREATE TYPE "public"."shelf_type" AS ENUM('SYSTEM', 'MANUAL', 'DYNAMIC');--> statement-breakpoint
CREATE TYPE "public"."layout_hint" AS ENUM('ROW', 'GRID');--> statement-breakpoint
CREATE TYPE "public"."shelf_media_type" AS ENUM('MOVIE', 'SERIES');--> statement-breakpoint
CREATE TABLE "shelves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid,
	"title" text NOT NULL,
	"type" "shelf_type" NOT NULL,
	"system_key" text,
	"rules" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"layout_hint" "layout_hint" DEFAULT 'ROW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shelf_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shelf_id" uuid NOT NULL,
	"media_type" "shelf_media_type" NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shelf_members_shelf_id_media_type_media_id_unique" UNIQUE("shelf_id","media_type","media_id")
);
--> statement-breakpoint
ALTER TABLE "shelves" ADD CONSTRAINT "shelves_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelf_members" ADD CONSTRAINT "shelf_members_shelf_id_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "public"."shelves"("id") ON DELETE cascade ON UPDATE no action;
