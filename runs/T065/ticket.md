# T065 — Bootstrap the canonical TMDB movie and TV catalog

**Source**: GitHub Issue #132

## Description

Parent: #131

Populate the canonical catalog independently from media providers so the application has rich Films and Series pages even when no Xtream or Plex source is connected.

The initial catalog should cover much more than trending content: popular titles, recent releases, upcoming titles, broad genre coverage, major collections, French and international titles, well-known older content, and useful long-tail content. Use a configurable inclusion strategy so coverage can grow over time.

The import must use pagination, batches, checkpoints, retries/backoff and resumable/idempotent processing. It must run asynchronously and expose status, processed counts, errors and timestamps.

Persist enough localized metadata for cards, details, filtering, shelves and recommendations without remote calls for every item. Preserve French metadata when available plus original metadata. Store TMDB image paths rather than image files.

For TV, establish a scalable canonical show/season/episode population strategy independent from provider streams.

Acceptance criteria:
- A fresh install shows a substantial catalog with zero media sources.
- Coverage supports useful discovery beyond trending pages.
- Import is restartable and does not create duplicates.
- Existing canonical records are refreshed on subsequent imports.
- Progress/failures are observable.
- French and original metadata are preserved.
- Database indexes support catalog browsing/search at scale.
