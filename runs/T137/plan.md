## Objective

Add a `GET /channels/search?q=` endpoint backed by a new `LiveSearchService` that queries canonical channels from PostgreSQL and EPG programs from the existing in-memory EPG cache, returning results grouped as `LIVE_NOW`, `UPCOMING`, and `CHANNEL` with ranking and source deduplication.

## Included

### Migration

- `/apps/api/migrations/0056_t137_live_search.sql`
  - Enable `unaccent` extension (accent-insensitive matching for channel ILIKE queries).
  - No schema table changes required; EPG remains in-memory.

### Query normalizer

- `/apps/api/src/services/live-search-normalizer.ts`
  - Export `normalizeQuery(raw: string): string`.
  - Strip deterministic French conversational prefixes via regex: `je veux regarder`, `mettre`, `regarder`, `voir`.
  - Lowercase + trim + collapse whitespace.
  - No LLM call; pure string transformation.

### EPG search helper (modify existing file)

- `/apps/api/src/services/epg-service.ts`
  - Add `searchEpgPrograms(normalizedQuery: string, cache: EpgCache): EpgMatch[]`.
  - `EpgMatch` = `{ catalogId: string; title: string; startTime: string; endTime: string; isLive: boolean }`.
  - Scan `cache.byChannel` across all channels.
  - Match on `title` (primary weight) then `subtitle`/`description` (lower weight).
  - Normalize titles the same way as the query (lowercase + unaccent equivalent in JS: `NFD` decompose + strip combining chars).
  - Mark each match as live (`now >= start && now < end`) or upcoming.
  - Skip programs whose `endTime` is in the past.

### Core search service

- `/apps/api/src/services/live-search-service.ts`
  - Export `searchLiveTV(query: string, db: DrizzleDb, epgService: EpgService): Promise<LiveSearchResponse>`.
  - **Channel search**: query `channels` table with `unaccent(lower(canonical_name)) ILIKE unaccent(lower('%query%'))` and same on `normalized_name`; also match `categories` JSONB array contains the term.
  - **EPG search**: call `searchEpgPrograms(normalizedQuery, cache)` then resolve each `catalogId` to a canonical channel via `channels.iptvOrgId` lookup (single batch join).
  - **Collapse sources**: join `channel_sources` where `status = 'AVAILABLE'` ordered by `priority` descending to obtain the best stream URL per canonical channel — never surface individual `ChannelSource` rows to the caller.
  - **Group results**:
    - `LIVE_NOW`: EPG matches where `isLive = true`; include `channelId`, `channelName`, `logoUrl`, `programTitle`, `startTime`, `endTime`, `progress` (`(now - start) / (end - start)`), `streamUrl`, `deliveryMode` (copy from existing `channel-playback-resolver` for the chosen source).
    - `UPCOMING`: EPG matches where `isLive = false`; include `channelId`, `channelName`, `logoUrl`, `programTitle`, `startTime`, `endTime`.
    - `CHANNEL`: canonical channel matches from DB query, not already returned as `LIVE_NOW`/`UPCOMING`.
  - **Ranking order within each group**:
    1. Exact title match (after normalization).
    2. Prefix match.
    3. Substring match.
    4. Description-only match (lowest rank; only for UPCOMING, never surfaces above title matches).
  - **Deduplication**: same canonical channel id appearing in multiple EPG matches → one `LIVE_NOW` entry (merge sources, take best); repeated future occurrences of the same program on the same channel → deduplicate to soonest occurrence unless `maxUpcomingOccurrences` (cap = 3) is useful.
  - **Horizon**: only return upcoming programs within the EPG cache window (determined by latest `endTime` in cache); never return stale past programs.
  - **EPG absent**: if `cache.byChannel` is empty, skip EPG search and return only `CHANNEL` results.
  - Exported response type:
    ```typescript
    type LiveSearchResponse = {
      liveNow: LiveNowResult[]
      upcoming: UpcomingResult[]
      channels: ChannelResult[]
    }
    ```

### Route

- `/apps/api/src/routes/channels.ts`
  - Add `GET /channels/search` (no auth required, consistent with existing channel endpoints).
  - Query param: `q: string` (required, min 1 char, max 100 chars; 400 if missing/empty).
  - Call `normalizeQuery(q)` then `searchLiveTV(normalized, ...)`.
  - Return `LiveSearchResponse` with appropriate JSON schema for Fastify type box validation.

### Android TV client

- `/apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/livetv/ChannelApi.kt`
  - Add `suspend fun searchLiveTV(query: String): LiveSearchResponse`.
  - Calls `GET /channels/search?q=<encoded>`.
  - Data classes: `LiveSearchResponse`, `LiveNowResult`, `UpcomingResult`, `ChannelResult` (Kotlin data classes, Gson/Moshi deserialization matching API JSON).
- Wire the existing `SearchPage` or equivalent Android TV search entry point to call `searchLiveTV(query)` and render the three result groups.

### Tests

- `/apps/api/src/services/__tests__/live-search-service.test.ts`
  - Live match: program currently airing → appears in `liveNow`.
  - Future match: program scheduled later → appears in `upcoming`.
  - Direct channel match: query matches channel name → appears in `channels`.
  - Duplicate source collapse: two `ChannelSource` rows for the same canonical channel → one result.
  - Repeated program: same program on same channel at two future times → at most one entry (soonest).
  - Accents/case: `"tf1"`, `"TF1"`, `"tél"` → all match the same canonical channel.
  - No-EPG behavior: empty EPG cache → only `channels` returned, no error.
  - Ranking: title match outranks description-only match.
  - Conversational prefix normalization: `"je veux regarder TF1"` → resolves same as `"TF1"`.

## Excluded

- Persisting EPG programs to the database (EPG remains in-memory; a separate ticket can add DB persistence if scale requires it).
- Semantic / LLM-based query expansion beyond deterministic prefix stripping.
- Pagination of search results (not in the ticket; search is intended for incremental/typeahead use).
- Category or country filter parameters on the search endpoint (existing `/channels` handles those separately).
- Channels from providers not yet synced to the `channels` table (search only covers persisted canonical channels).
- Android TV UI design or search UX beyond wiring the API call to the existing search entry point.
- Any change to the VOD/content search endpoint (`/search`).

## Acceptance criteria

- `GET /channels/search?q=TF1` returns a `channels` array containing the canonical TF1 entry; no raw `ChannelSource` rows appear.
- `GET /channels/search?q=US+Open` returns at least one `liveNow` entry when an EPG program titled "US Open" is currently airing, and at least one `upcoming` entry when it is scheduled later; when EPG is empty the response is `{ liveNow: [], upcoming: [], channels: [] }` with no error.
- `GET /channels/search?q=je+veux+regarder+TF1` returns the same result as `?q=TF1`.
- Querying `tf1`, `TF1`, or an accented variant returns the same canonical channel.
- `liveNow` results include `streamUrl` / `deliveryMode` sufficient for Android TV to initiate playback.
- `upcoming` results include `channelId`, `channelName`, `startTime`, `endTime` in ISO UTC format.
- Two `ChannelSource` rows for the same canonical channel produce one result, not two.
- A program title match ranks above a description-only match in the `upcoming` array.
- All tests in `live-search-service.test.ts` pass.
- No provider-specific or program-specific strings are hardcoded in the search service.
