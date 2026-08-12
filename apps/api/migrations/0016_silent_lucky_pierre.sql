CREATE TYPE "public"."feedback_type" AS ENUM('LIKE', 'DISLIKE', 'NOT_INTERESTED');--> statement-breakpoint
CREATE TABLE "explicit_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"media_type" "watchlist_media_type" NOT NULL,
	"media_id" uuid NOT NULL,
	"feedback" "feedback_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explicit_feedback_profile_id_media_type_media_id_unique" UNIQUE("profile_id","media_type","media_id")
);
--> statement-breakpoint
ALTER TABLE "explicit_feedback" ADD CONSTRAINT "explicit_feedback_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
