# T005 — Implement Xtream Codes Catalog Ingestion

## Objective

Implement an isolated Xtream Codes provider adapter inside `apps/api` that authenticates against a configured source, fetches VOD and series catalog data (categories, streams, series, episodes), and maps raw responses into typed provider DTOs — establishing a clear ingestion boundary that a future catalog-sync ticket can consume without touching the canonical domain.

## Included

### New files

**`apps/api/src/providers/xtream/types.ts`**
Provider-layer DTOs (never imported by canonical schema or routes):
- `XtreamUserInfo` — authentication response fields (`username`, `status`, `exp_date`, `max_connections`, etc.)
- `XtreamCategory` — `{ category_id: string; category_name: string; parent_id: number }`
- `XtreamVodStream` — `{ num: number; name: string; stream_id: number; stream_icon: string; rating: string; added: string; category_id: string; container_extension: string; tmdb: string; ... }`
- `XtreamSeries` — `{ series_id: number; name: string; cover: string; category_id: string; rating: string; ... }`
- `XtreamSeriesInfo` — `{ info: XtreamSeriesDetail; episodes: Record<string, XtreamEpisode[]> }`
- `XtreamEpisode` — `{ id: string; episode_num: number; title: string; container_extension: string; info: { duration_secs: number; ... } }`
- `XtreamCatalogSnapshot` — aggregate ingestion boundary type: `{ sourceId: string; fetchedAt: Date; vodCategories: XtreamCategory[]; vodStreams: XtreamVodStream[]; seriesCategories: XtreamCategory[]; series: XtreamSeries[] }`

**`apps/api/src/providers/xtream/errors.ts`**
- `XtreamAuthError extends Error` — authentication rejected by provider
- `XtreamNetworkError extends Error` — timeout or unreachable host (message must not contain credentials or stream URLs)
- `XtreamParseError extends Error` — unexpected response shape (message includes the endpoint name, not the raw body)

**`apps/api/src/providers/xtream/client.ts`**
`XtreamCodesClient` class:
- Constructor: `(config: { baseUrl: string; username: string; password: string; timeoutMs?: number })` — default timeout 10 000 ms
- Private `fetch(action: string, params?: Record<string, string>): Promise<unknown>` — builds `player_api.php` URL, sets `AbortSignal.timeout`, redacts credentials from any thrown error messages via a `sanitizeUrl()` helper
- `authenticate(): Promise<XtreamUserInfo>` — GET `action=get_account_info`; throws `XtreamAuthError` on non-200 or `user_info.status === 'Disabled'`
- `getVodCategories(): Promise<XtreamCategory[]>` — GET `action=get_vod_categories`
- `getVodStreams(categoryId?: string): Promise<XtreamVodStream[]>` — GET `action=get_vod_streams`; optional `category_id` filter
- `getSeriesCategories(): Promise<XtreamCategory[]>` — GET `action=get_series_categories`
- `getSeries(categoryId?: string): Promise<XtreamSeries[]>` — GET `action=get_series`; optional `category_id` filter
- `getSeriesInfo(seriesId: number): Promise<XtreamSeriesInfo>` — GET `action=get_series_info&series_id=<id>`
- All methods validate response shape with a `parseOrThrow<T>(raw, typeguard, endpointName)` utility; throws `XtreamParseError` on unexpected shape

**`apps/api/src/providers/xtream/index.ts`**
Barrel: re-exports `XtreamCodesClient`, all DTO types, and all error classes.

**`apps/api/src/providers/xtream/__tests__/client.test.ts`**
Vitest fixture-based tests (no live account):
- `authenticate()` success — fixture: valid `get_account_info` JSON → returns `XtreamUserInfo`
- `authenticate()` wrong credentials — fixture: provider returns `user_info.status === 'Disabled'` → throws `XtreamAuthError`
- `authenticate()` HTTP 401 — fixture: mocked fetch returning 401 → throws `XtreamAuthError`
- `getVodCategories()` — fixture: array of categories → returns `XtreamCategory[]`
- `getVodStreams()` — fixture: representative VOD list → returns `XtreamVodStream[]`
- `getVodStreams(categoryId)` — asserts `category_id` query param forwarded
- `getSeries()` — fixture: series list → returns `XtreamSeries[]`
- `getSeriesInfo(id)` — fixture: series info with episodes map → returns `XtreamSeriesInfo`
- Malformed JSON — fixture: non-JSON body → throws `XtreamParseError` (no credentials in message)
- Network timeout — fetch mock throws `DOMException` (TimeoutError) → throws `XtreamNetworkError` (no credentials in message)
- Unreachable host — fetch mock throws `TypeError` → throws `XtreamNetworkError`
- Empty catalog — fixture: `[]` response → returns empty array without crash
- Large catalog — fixture: 5 000-item array → returns parsed array without crash

**`apps/api/src/providers/xtream/__tests__/fixtures/`**
JSON files: `account-info.json`, `vod-categories.json`, `vod-streams.json`, `series-categories.json`, `series-list.json`, `series-info.json`, `large-vod-streams.json` (5 000 entries generated at fixture-creation time)

### Modified files

None — T005 adds only the new `providers/xtream/` subtree; no existing file is changed.

## Excluded

- Persisting any ingested data to the PostgreSQL schema (no Drizzle writes)
- Populating or touching the `movieAvailabilities` / `episodeAvailabilities` tables
- Canonical domain models (`movies`, `series`, `seasons`, `episodes`, `genres`)
- Any Fastify route exposing ingestion results to the frontend
- Scheduled or triggered catalog sync (future ticket)
- M3U ingestion
- Metadata enrichment (TMDB/IMDB matching)
- Playback URL resolution
- The web or android-tv apps

## Acceptance criteria

1. `pnpm --filter api typecheck` passes with no errors in the new `providers/xtream/` subtree.
2. `pnpm --filter api test` passes: all test cases in `client.test.ts` are green.
3. Constructing `XtreamCodesClient` and calling any method never writes `password` or a stream URL containing credentials to `console.log`, `console.error`, or any thrown `Error.message`.
4. `XtreamAuthError`, `XtreamNetworkError`, and `XtreamParseError` are distinct classes; a caller can catch them individually with `instanceof`.
5. `XtreamCatalogSnapshot` is the only type that crosses the provider/domain boundary; no Xtream DTO is imported in `db/schema/`, `routes/`, or `services/`.
6. The authentication-failure test, the malformed-response test, and the timeout test all pass without a live IPTV account.
7. The large-catalog test (5 000 items) completes without exceeding Vitest's default 5-second test timeout.
8. No `.env` change is required beyond what T004 already provides (`DATABASE_URL` plus source credentials stored in the `sources` table).
