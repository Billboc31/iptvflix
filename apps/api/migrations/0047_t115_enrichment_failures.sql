-- T115: per-item enrichment failure persistence
CREATE TABLE enrichment_failures (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type     text NOT NULL,
  media_id       uuid NOT NULL,
  tmdb_id        integer,
  title          text,
  stage          text NOT NULL,
  error_class    text,
  error_code     text,
  error_message  text NOT NULL,
  retry_count    integer NOT NULL DEFAULT 0,
  occurred_at    timestamp with time zone NOT NULL DEFAULT now(),
  retryable      boolean NOT NULL DEFAULT false,
  run_id         uuid
);

CREATE UNIQUE INDEX enrichment_failures_media_idx ON enrichment_failures (media_type, media_id);
