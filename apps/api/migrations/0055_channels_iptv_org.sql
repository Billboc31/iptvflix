ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "iptv_org_id" text;
CREATE INDEX IF NOT EXISTS "channels_iptv_org_id_idx" ON "channels" ("iptv_org_id");
CREATE INDEX IF NOT EXISTS "channels_country_idx" ON "channels" ("country");
CREATE INDEX IF NOT EXISTS "channels_normalized_name_idx" ON "channels" ("normalized_name");
