## Objective

Introduce a persistent canonical Live TV channel model and a confidence-based deduplication pipeline so that the Live TV frontend receives one clean `Channel` per logical channel backed by one or more `ChannelSource` stream records, with a reusable source-selection function for preferred-stream resolution and failover.

## Included

### 1. DB schema (new files + migration)

- `apps/api/src/db/schema/channels.ts` — `channels` table:
  `id` (uuid pk), `canonicalName` (text), `normalizedName` (text), `logoUrl` (text nullable), `language` (text nullable), `country` (text nullable), `tvgId` (text nullable), `categories` (jsonb, `string[]`), `createdAt`, `updatedAt`

- `apps/api/src/db/schema/channel-sources.ts` — `channel_sources` table:
  `id` (uuid pk), `channelId` (fk → channels), `sourceId` (fk → sources), `providerItemId` (text), `providerName` (text), `streamUrl` (text), `tvgId` (text nullable), `tvgLogo` (text nullable), `groupTitle` (text nullable), `priority` (integer default 0), `matchConfidence` (real), `matchProvenance` (jsonb — debug object recording which signals matched), `status` (`AVAILABLE | UNAVAILABLE`), `firstSeenAt`, `lastSeenAt`, `unavailableAt` (nullable); UNIQUE(`sourceId`, `providerItemId`)

- Update `apps/api/src/db/schema/index.ts` to export both new schemas.

- New Drizzle migration `apps/api/migrations/0052_t131_live_tv_channels.sql` (generated via `drizzle-kit generate`).

### 2. M3U provider extensions

- `apps/api/src/providers/m3u/types.ts`:
  - Add `'live'` to `M3UClassifiedEntry.kind` union.
  - Add `liveChannels: M3UClassifiedEntry[]` to `M3UCatalogSnapshot`.

- `apps/api/src/providers/m3u/parser.ts` — update `classifyEntries`:
  - Entries that are neither `movie` nor `episode` **and** whose `group-title` does not match any VOD/series keyword pattern → classify as `'live'`.
  - Current `unclassified` kind is retained for truly unknown entries (no group-title at all).

### 3. Xtream provider extensions

- `apps/api/src/providers/xtream/types.ts`:
  - Add `XtreamLiveCategory` (same shape as `XtreamCategory`).
  - Add `XtreamLiveStream`: `{ num, name, stream_id, stream_icon, category_id, epg_channel_id?, added?, custom_sid?, tv_archive?, tv_archive_duration?, direct_source? }`.
  - Extend `XtreamCatalogSnapshot` with `liveCategories: XtreamLiveCategory[]` and `liveStreams: XtreamLiveStream[]`.

- `apps/api/src/providers/xtream/client.ts`:
  - Add `getLiveCategories(): Promise<XtreamLiveCategory[]>` — calls `action=get_live_categories`.
  - Add `getLiveStreams(categoryId?: string): Promise<XtreamLiveStream[]>` — calls `action=get_live_streams`.
  - Wire both into `fetchCatalogSnapshot()` to populate the new snapshot fields.

### 4. Channel normalization module (new directory `apps/api/src/channels/`)

- `apps/api/src/channels/channel-normalizer.ts`:
  - `normalizeChannelName(raw: string): string` — reuses `stripIptvPrefixes` logic from the existing title-normalizer; additionally strips trailing quality suffixes (`HD`, `FHD`, `4K`, `SD`, `720p`, `1080p`, `2160p`, `UHD`) and collapses whitespace/punctuation; returns lowercase trimmed result.
  - `toCanonicalDisplayName(normalized: string): string` — title-cases the normalized result.

- `apps/api/src/channels/category-mapper.ts`:
  - `mapCategory(raw: string): string` — data-driven lookup table mapping provider group-title strings to canonical labels: `generalist | sport | cinema | news | kids | music | documentary | entertainment | international`. Unknown values are preserved as-is rather than dropped.

- `apps/api/src/channels/source-selector.ts`:
  - `selectPreferredSources(sources: ChannelSourceRecord[]): ChannelSourceRecord[]` — pure function returning sources sorted by: AVAILABLE first → `priority` descending → quality score (derived from `providerName` quality signals) → `lastSeenAt` descending. Returns the ordered list; caller picks `[0]` for primary stream and the rest as fallbacks.

### 5. Channel sync service (new)

- `apps/api/src/services/channel-sync-service.ts`:
  - `syncLiveChannels(sourceId: string, entries: LiveChannelEntry[], opts?: { skipLifecycle?: boolean }): Promise<ChannelSyncResult>`
  - Per-entry matching flow:
    1. Build signals: `tvgId` exact match (confidence contribution +0.6), normalised-name exact match (+0.4), logo-URL-path similarity (+0.1 bonus).
    2. Query existing `channels` for candidates; total confidence threshold for merge = 0.75.
    3. Below threshold or multiple ambiguous candidates → create a new canonical channel (no merge).
    4. Above threshold → upsert into `channel_sources` (UNIQUE constraint enforces idempotence); update `channels.logoUrl` if new source provides a non-null logo and the current value is null.
    5. Persist `matchConfidence` (float) and `matchProvenance` (JSON object) on every `channel_source` row.
  - Lifecycle: entries absent from the new snapshot are set to `status = UNAVAILABLE` and `unavailableAt` is recorded (mirrors existing availability lifecycle pattern).
  - Exposes `ChannelSyncResult`: `{ channelsCreated, channelsUpdated, sourcesCreated, sourcesUpdated, unavailableCount }`.

### 6. Catalog sync integration

- `apps/api/src/services/catalog-sync-service.ts`:
  - After existing movie/series sync, call `channelSyncService.syncLiveChannels()` for:
    - M3U: `snapshot.liveChannels` mapped to `LiveChannelEntry`.
    - Xtream: `snapshot.liveStreams` mapped to `LiveChannelEntry`.
  - Extend `CatalogSyncResult.counts` with `channelsCreated`, `channelsUpdated` counters.

### 7. API layer

- `apps/api/src/routes/channels.ts`:
  - `GET /channels` — query `channels` LEFT JOIN `channel_sources` (at least one AVAILABLE source), return `ChannelResponse[]` ordered by `canonicalName`.
  - `GET /channels/:id/stream` — call `selectPreferredSources()`, return `{ streamUrl: string }` for the first AVAILABLE source; 404 if no source available.

- `packages/api-contracts/src/channels.ts`:
  - Extend `ChannelResponse`: add `categories: string[]` (replaces the optional `category?: string` field).
  - Add `ChannelStreamResponse: { streamUrl: string }`.

### 8. Unit tests

- `apps/api/src/channels/__tests__/channel-normalizer.test.ts` — cases: provider prefix stripping (`FR | TF1` → `tf1`), trailing suffix stripping (`TF1 HD` → `tf1`, `TF1 FHD` → `tf1`, `TF1 4K` → `tf1`), hyphenated variants, no-op on clean names.
- `apps/api/src/channels/__tests__/category-mapper.test.ts` — known category mappings (sport, news, kids…), unknown value preservation.
- `apps/api/src/services/__tests__/channel-sync-service.test.ts`:
  - Confident merge via `tvgId` match produces one channel, two sources.
  - Confident merge via normalised-name produces one channel, two sources.
  - Ambiguous / below-threshold entries remain separate channels.
  - Multi-provider: same tvgId from two different sources → one channel, two `channel_sources`.
  - Logo selection: null logo on first sync, non-null on second sync → `channels.logoUrl` updated.
  - Source ordering: AVAILABLE before UNAVAILABLE; higher priority before lower.
  - Idempotence: second sync with identical entries creates zero new channels and zero new sources.
  - Lifecycle: entry removed from snapshot → `status = UNAVAILABLE`, `unavailableAt` set.

### 9. E2E test

- `e2e/tests/live-tv-sync.spec.ts`:
  - Fake M3U server fixture returning a playlist with live TV entries including name variants (`TF1`, `TF1 HD`, `TF1 FHD` from one provider).
  - Flow: create source → trigger sync → `GET /channels` → assert returned channel count is less than raw entry count (dedup happened) → trigger sync again → assert zero new channels created (idempotence).

## Excluded

- EPG (Electronic Program Guide) data fetching or schedule ingestion.
- Active health probing or real-time stream availability monitoring.
- Logo binary downloading or local image caching.
- Plex provider live TV (Plex has no live TV API equivalent used in this project).
- Frontend player integration, playback UI, or HLS/RTMP client changes.
- Per-profile favorites and watch-history persistence at canonical channel level (model is designed for it; persistence is a follow-up).
- TMDB or any external metadata enrichment for channels.
- Manual or scripted production DB data migrations.

## Acceptance criteria

1. `GET /channels` returns canonical channels; syncing the same source twice produces zero new channels (idempotence enforced by UNIQUE constraint on `channel_sources(sourceId, providerItemId)`).
2. A provider playlist containing `TF1`, `TF1 HD`, and `TF1 FHD` entries produces exactly one canonical channel after sync.
3. Two genuinely distinct channels with similar names but different `tvgId` values are never merged into one canonical channel.
4. Every `channel_sources` row has a non-null `match_confidence` value and a non-null `match_provenance` JSON object.
5. `channels.logo_url` is populated when any source provides a non-null logo; `GET /channels` returns `null` for `logoUrl` when no source has a logo (frontend handles initials placeholder).
6. `GET /channels/:id/stream` returns the stream URL of the highest-priority AVAILABLE source; calling it again after marking that source UNAVAILABLE returns the next in fallback order.
7. All unit tests in `channel-normalizer.test.ts`, `category-mapper.test.ts`, and `channel-sync-service.test.ts` pass, covering the cases listed in §8.
8. E2E test `live-tv-sync.spec.ts` passes end-to-end: source creation → sync → channel list → idempotent re-sync.
9. No hardcoded channel-name rules targeting specific channels by name.
10. All changes are applied via Drizzle migration; no manual DB edits are required.
