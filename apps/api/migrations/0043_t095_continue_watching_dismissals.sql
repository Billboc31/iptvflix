CREATE TABLE "continue_watching_dismissals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL,
  "media_type" "progress_media_type" NOT NULL,
  "media_id" uuid NOT NULL,
  "dismissed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "continue_watching_dismissals_profile_id_media_type_media_id_unique" UNIQUE("profile_id","media_type","media_id")
);
ALTER TABLE "continue_watching_dismissals" ADD CONSTRAINT "continue_watching_dismissals_profile_id_profiles_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
