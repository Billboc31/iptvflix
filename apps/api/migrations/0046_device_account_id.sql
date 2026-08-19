ALTER TABLE "devices" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "devices" SET "account_id" = (SELECT "id" FROM "accounts" ORDER BY "created_at" LIMIT 1) WHERE "account_id" IS NULL;
