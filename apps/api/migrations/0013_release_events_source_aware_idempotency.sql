ALTER TABLE "release_events" DROP CONSTRAINT "release_events_media_type_media_id_event_type_occurred_at_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "release_events_source_events_unique" ON "release_events" ("media_type","media_id","event_type","occurred_at","source_id") WHERE event_type IN ('SOURCE_APPEARED', 'SOURCE_DISAPPEARED');--> statement-breakpoint
CREATE UNIQUE INDEX "release_events_non_source_events_unique" ON "release_events" ("media_type","media_id","event_type","occurred_at") WHERE event_type NOT IN ('SOURCE_APPEARED', 'SOURCE_DISAPPEARED');
