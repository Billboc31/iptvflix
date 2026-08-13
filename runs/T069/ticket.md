# T069 — Migrate existing IPTVFlix media and user state to canonical catalog identities

**Source**: GitHub Issue #136

## Description

Parent: #131

Migrate/reconcile existing IPTVFlix data created under the provider-first model into the new canonical catalog without losing useful state.

For existing movies/shows/episodes, resolve canonical TMDB identity using existing TMDB IDs first and the title normalization/matching pipeline when needed. Consolidate duplicates that represent the same work and move provider records into source/variant availability.

Preserve relationships wherever possible: watchlist/my-list, playback progress, history, source variants, sync provenance and any shelf/recommendation references already persisted.

Migration must be safe to run against an existing installation, transactionally cautious, restartable/idempotent, and produce a report of resolved, merged, ambiguous and unresolved records. Do not silently delete ambiguous data.

After migration, application read paths should use canonical identities so the old provider-first identity model can be retired rather than maintained indefinitely.

Acceptance criteria:
- Existing valid TMDB-linked records map directly.
- Duplicate provider-derived cards consolidate under one canonical entity.
- Existing variants remain playable after migration.
- User list/progress/history relationships survive.
- Ambiguous/unresolved records are reported and retained safely.
- Migration can be retried without duplication/corruption.
- A verification report summarizes before/after counts and unresolved items.
- Old identity paths are removed or explicitly deprecated once migration is complete.
