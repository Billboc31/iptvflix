CREATE TYPE "public"."pairing_code_status" AS ENUM('pending', 'approved', 'expired');--> statement-breakpoint
CREATE TYPE "public"."command_state" AS ENUM('pending', 'delivered', 'acknowledged', 'expired');--> statement-breakpoint
CREATE TYPE "public"."playback_media_type" AS ENUM('movie', 'episode');--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) DEFAULT 'TV' NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "pairing_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(8) NOT NULL,
	"status" "pairing_code_status" DEFAULT 'pending' NOT NULL,
	"device_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pairing_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "playback_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"media_type" "playback_media_type" NOT NULL,
	"media_id" uuid NOT NULL,
	"availability_id" uuid,
	"start_position_ms" integer DEFAULT 0 NOT NULL,
	"state" "command_state" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_commands" ADD CONSTRAINT "playback_commands_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;