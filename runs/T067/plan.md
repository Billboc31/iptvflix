## Objective

Refactor Xtream ingestion so that provider records never define canonical identity. Each provider item must first resolve to an existing or freshly TMDB-imported canonical entity (Movie / Show / Season / Episode), then create or update a provider availability variant. Unresolvable or ambiguous records must land in an explicit, retryable state without polluting the canonical catalog.

## Included

**Schema changes (`apps/api/src/db/schema/availabilities.ts`)**
- Audit `movieAvailabilities`, `episodeAvailabilities`, `seriesAvailabilities` for any missing provider-specific columns: `sourceAccountId` (FK to sources), `providerStreamId` (text), `containerExtension` (text, episodes already have this — verify movies), `rawProviderTitle` (text). Add whatever is absent.
- New migration.

**New service: `apps/api/src/services/canonical-resolver.ts`**
- `resolveMovieCanonical(providerId, tmdbId?, rawTitle, year?): Promise<Movie | null>`
  1. If `tmdbId` present: look up `movies.tmdbId`. If found, return. If not found, call `MetadataEnrichmentService.importMovieByTmdbId()` then return.
  2. Else: delegate to `TitleMatchingService.matchMovie()`. On MATCHED, check local DB; if absent, import from TMDB. On AMBIGUOUS or UNMATCHED, persist to `titleMatchResults` and return `null`.
- `resolveEpisodeCanonical(providerId, seriesTmdbId?, rawSeriesTitle, seasonNumber, episodeNumber): Promise<Episode | null>`
  - Resolve series first (same logic as above), then resolve season and episode via TMDB season/episode endpoint, upsert season + episode into local DB, return episode.
- No canonical entity is created from raw provider data. Canonical fields (title, synopsis, posterPath, etc.) are only written from TMDB responses.

**Refactor `apps/api/src/services/catalog-sync-service.ts`**
- Replace the existing "upsert canonical then upsert availability" flow with "resolve canonical via `CanonicalResolver`, skip if null, then upsert availability."
- Remove all code paths that create or update canonical metadata (title, year, synopsis, poster) using raw Xtream field values.
- Ensure the movie and episode branches both call `CanonicalResolver` — same resolution path, no divergence.
- Ambiguous / unresolved items: accumulate per-run counters (`resolvedCount`, `ambiguousCount`, `unresolvedCount`) and expose them in the `syncRuns` row (add columns if absent).

**Guard in `apps/api/src/db/` upsert helpers (or inline in sync service)**
- All canonical upserts must use `onConflictDoNothing` (or `onConflictDoUpdate` restricted to non-metadata fields only, e.g. `tmdbSyncedAt`). Provider data must never overwrite `title`, `originalTitle`, `synopsis`, `posterPath`, `backdropPath`, `voteAverage`, `year`.

**Tests**
- `apps/api/src/services/__tests__/canonical-resolver.test.ts` — unit tests for all three resolution paths (TMDB ID hit locally, TMDB ID miss → import, title-match MATCHED → import, AMBIGUOUS → null, UNMATCHED → null).
- Update `apps/api/src/services/__tests__/catalog-sync-service.test.ts` — remove test cases that assert canonical creation from provider-only data; add cases asserting ambiguous items produce no canonical record.

## Excluded

- UI / frontend changes.
- M3U and Plex provider sync paths (same architecture already applies; T067 scope is Xtream only).
- Retry mechanism for AMBIGUOUS records (observable state is sufficient; automated retry is a follow-up ticket).
- Metadata enrichment scheduling changes.
- Collection, genre, credit enrichment logic.
- Watchlist / notification triggers.

## Acceptance criteria

1. A sync run against a fixture with valid `tmdb` fields on VOD/series items results in availability records linked to canonical entities whose `title` and `synopsis` come from TMDB, not from the Xtream raw title.
2. A sync run where the provider TMDB ID is absent but the normalized title matches a TMDB result creates the canonical entity via TMDB import (not from provider fields) before inserting the availability.
3. A provider item with no resolvable TMDB ID and a title-match result of AMBIGUOUS produces a `titleMatchResults` row with `matchState = 'AMBIGUOUS'`, no canonical Movie/Show row, and no availability row.
4. A provider item that is UNMATCHED produces a `titleMatchResults` row with `matchState = 'UNMATCHED'`, no canonical row, no availability row.
5. Re-running the same sync twice (idempotency) produces no duplicate availability rows and does not alter canonical metadata on the second run.
6. Episode availability is attached only after the parent series and season canonical entities exist locally.
7. `syncRuns` rows expose `resolvedCount`, `ambiguousCount`, and `unresolvedCount` counters.
8. All new and modified unit tests pass (`pnpm test` in `apps/api`).
