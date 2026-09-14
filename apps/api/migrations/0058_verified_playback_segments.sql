CREATE TABLE IF NOT EXISTS verified_playback_segments (
 availability_id uuid NOT NULL REFERENCES episode_availabilities(id) ON DELETE CASCADE,
 type segment_type NOT NULL,
 duration_ms integer NOT NULL CHECK (duration_ms > 0),
 start_ms integer NOT NULL CHECK (start_ms >= 0),
 end_ms integer NOT NULL CHECK (end_ms > start_ms AND end_ms <= duration_ms),
 evidence text NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (availability_id, type)
);
