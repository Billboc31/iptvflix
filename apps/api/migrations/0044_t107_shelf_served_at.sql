ALTER TABLE "shelf_instances" ADD COLUMN IF NOT EXISTS "served_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "shelf_instances_session_served_pos_idx"
  ON "shelf_instances" ("home_session_id", "served_at", "vertical_position")
  WHERE "home_session_id" IS NOT NULL;
