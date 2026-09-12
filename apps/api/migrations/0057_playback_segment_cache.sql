CREATE TABLE IF NOT EXISTS playback_segment_responses (
  url text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS playback_segment_catalog (
  media_type text NOT NULL CHECK (media_type IN ('movie', 'episode')),
  media_id uuid NOT NULL,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  PRIMARY KEY (media_type, media_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS playback_segment_catalog_retry_idx ON playback_segment_catalog(retry_at);
