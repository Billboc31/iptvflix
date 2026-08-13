# Plan — T049: M3U Catalog Ingestion

## Objective

Implement a real M3U provider adapter that fetches, parses, and normalizes extended M3U playlists into the existing `NormalizedSnapshot` boundary, enabling connection-test and full catalog synchronization for M3U sources without introducing any M3U-specific path in the catalog or matching layers.

## Included

### New files

**`apps/api/src/providers/m3u/types.ts`**
- `M3UEntry`: raw parsed line group — `{ tvgId, tvgName, tvgLogo, groupTitle, rawTitle, streamUrl }`
- `M3UClassifiedEntry`: extends `M3UEntry` with `kind: 'movie' | 'episode' | 'unclassified'` plus `seasonNumber`, `episodeNumber`, `seriesKey` (nullable, for episodes only)
- `M3UCatalogSnapshot`: `{ sourceId, fetchedAt, movies: M3UClassifiedEntry[], episodes: M3UClassifiedEntry[], unclassified: M3UClassifiedEntry[] }`

**`apps/api/src/providers/m3u/errors.ts`**
- `M3UAuthError extends Error` — HTTP 401/403 or missing credentials
- `M3UNetworkError extends Error` — fetch failure, timeout, redirect loop
- `M3UParseError extends Error` — missing `#EXTM3U` header or completely empty body

**`apps/api/src/providers/m3u/parser.ts`**
- `parseM3U(text: string): M3UEntry[]` — line-by-line parser of the extended M3U format:
  - Validates first non-empty line starts with `#EXTM3U`; throws `M3UParseError` otherwise
  - Pairs each `#EXTINF` directive with the following URL line
  - Extracts `tvg-id`, `tvg-name`, `tvg-logo`, `group-title` attributes from the `#EXTINF` line via regex
  - Treats the comma-trailing segment as `rawTitle`
  - Silently skips malformed pairs (no URL following `#EXTINF`, duplicate `#EXTINF` without URL)
- `classifyEntries(entries: M3UEntry[]): M3UClassifiedEntry[]`
  - Determines `kind` conservatively from `groupTitle` (case-insensitive):
    - Contains `movie` or `film` or `vod` (and no S\d+E\d+ in title) → `'movie'`
    - Contains `series` or `show` or `episode` AND title matches `S\d{1,2}E\d{1,2}` → `'episode'`
    - Otherwise → `'unclassified'`
  - For episodes: extracts `seasonNumber`, `episodeNumber` from the regex match; derives `seriesKey` by normalizing the title fragment preceding the pattern (lowercase, trim)
  - `tvgId` is used as the stable provider item identity when present; falls back to `streamUrl`

**`apps/api/src/providers/m3u/client.ts`** — `M3UClient`
- Constructor: `new M3UClient({ playlistUrl, username, password, timeoutMs })`
  - `playlistUrl` may contain `{username}` / `{password}` template placeholders; substitutes them with credentials at construction time; never logs the resolved URL
- `sanitizeUrl(url: string): string` — removes query params named `username`, `password`, `token`, and HTTP Basic-auth userinfo before any log or error message
- `testConnection(): Promise<{ ok: boolean; message?: string }>`
  - Fetches up to 4 KB of the playlist (range request if server supports it, full fetch otherwise)
  - Returns `{ ok: true }` if body starts with `#EXTM3U`; returns `{ ok: false, message }` otherwise
  - Catches HTTP 401/403 → `M3UAuthError`; timeout / network → `M3UNetworkError`
- `fetchSnapshot(sourceId: string): Promise<M3UCatalogSnapshot>`
  - Fetches the full playlist body with configurable timeout (env `M3U_FETCH_TIMEOUT_MS`, default 60 000 ms)
  - Calls `parseM3U` then `classifyEntries`
  - Returns snapshot; never surfaces `streamUrl` credentials in thrown errors

**`apps/api/src/providers/m3u/index.ts`** — re-exports `M3UClient`, snapshot type, error classes

**`apps/api/src/providers/m3u/__tests__/parser.test.ts`**
- Fixtures (inline strings): valid two-movie playlist, series playlist with S01E02 entries, playlist with mixed live/movie/series groups, playlist missing `#EXTM3U`, empty string, entries with missing URL, entries with no `group-title`
- Asserts: correct entry count, attribute extraction, classification kind distribution, `M3UParseError` on invalid header

**`apps/api/src/providers/m3u/__tests__/client.test.ts`**
- Stubs `fetch` (via `vi.stubGlobal`) for happy-path, 401, timeout, redirect-loop, non-M3U body scenarios
- Asserts: `testConnection()` returns correct `ok` value; credentials never appear in thrown error messages; `fetchSnapshot()` returns snapshot with classified counts

### Modified files

**`apps/api/src/services/sync-runs-service.ts`**
- Add `fetchM3USnapshot(source: Source): Promise<M3UCatalogSnapshot>` — instantiates `M3UClient`, calls `fetchSnapshot`, wraps errors identically to `fetchXtreamSnapshot`
- Expand the supported-type guard to include `'M3U'`; route M3U sources to `fetchM3USnapshot` + `syncM3UCatalog`

**`apps/api/src/services/catalog-sync-service.ts`**
- Add `syncM3UCatalog(snapshot: M3UCatalogSnapshot): NormalizedSnapshot`
  - Maps `snapshot.movies` → `NormalizedMovieItem[]`:
    - `providerItemId`: `entry.tvgId ?? entry.streamUrl` (sanitized, no credentials)
    - `rawTitle`: `entry.rawTitle`
    - `title`: `entry.tvgName ?? entry.rawTitle`
    - `posterPath`: `entry.tvgLogo ?? null`
    - `synopsis`: `null` (M3U carries no synopsis)
    - `tmdb`: `null` (M3U carries no tmdbId)
    - `audioLanguage`, `subtitleLanguage`, `videoQuality`: from `extractVariantAttributes(entry.rawTitle)`
  - Maps `snapshot.episodes` → `NormalizedEpisodeItem[]` + synthesizes `NormalizedSeriesItem[]` keyed by `entry.seriesKey`
    - `seriesProviderItemId`: `entry.seriesKey` (stable within a playlist)
    - `seasonNumber`, `episodeNumber` from classified entry
  - `unclassified` entries are omitted from the snapshot entirely (not persisted)
  - Returns `NormalizedSnapshot` consumed by the existing `syncNormalized()` without modification

**`apps/api/src/services/source-service.ts`**
- Replace the `M3U` stub in `testSourceConnection` with a real call to `M3UClient.testConnection()`
- Redact credential-bearing URLs before returning any error `message`

**`apps/api/src/routes/sources.test.ts`**
- Remove the assertion that M3U test returns `'M3U connection test not yet implemented'`
- Add assertions for M3U connection test: happy path returns `{ ok: true }`, auth failure returns `{ ok: false }`, network error returns `{ ok: false }` without credentials in message

**`apps/api/src/config/env.ts`**
- Add optional `M3U_FETCH_TIMEOUT_MS` (default `60000`)

**`e2e/fixtures/m3u-server.ts`** (new)
- `startFakeM3U(mode, port): Promise<FakeM3UHandle>`
- Modes: `happy` (valid playlist with 2 movies + 1 series with 2 episodes), `auth-fail` (401), `empty` (valid header, no entries), `malformed` (missing `#EXTM3U`)
- Inline fixture content; no external file reads

## Excluded

- Live TV browsing, EPG ingestion, or any playback UX for M3U streams
- Rewriting the title normalization, candidate scoring, or TMDB matching algorithms
- Adding new columns to the `sources`, `movieAvailabilities`, `seriesAvailabilities`, or `episodeAvailabilities` schemas — existing `rawTitle`, `providerItemId`, `audioLanguage`, `subtitleLanguage`, `videoQuality` fields are sufficient
- Streaming/chunked download of large playlists — full fetch with timeout is the failure boundary
- M3U playlist URL rotation or multi-URL failover
- Encrypting credentials at rest (separate concern)
- Android TV or frontend playback changes

## Acceptance criteria

- `POST /sources/:id/test` for an M3U source with a valid playlist URL returns `{ ok: true }`.
- `POST /sources/:id/test` for an M3U source with a 401-returning URL returns `{ ok: false }` and the response body contains no URL credentials.
- `POST /sync-runs` for an M3U source with a valid playlist completes with status `COMPLETED` and non-zero `moviesCreated` or `seriesCreated` counts.
- A second `POST /sync-runs` for the same M3U source is idempotent: counts reflect updates only, no duplicate `movieAvailabilities` rows exist (verified by unique constraint on `(providerId, providerItemId)`).
- M3U entries whose `groupTitle` does not match movie or series patterns produce zero rows in `movies`, `series`, `movieAvailabilities`, or `seriesAvailabilities`.
- An M3U entry matched to an existing canonical movie (via title+year) creates a new `movieAvailabilities` row rather than a duplicate `movies` row.
- Fetching a URL that returns non-M3U content does not crash the sync run; the run record ends with status `FAILED` and a sanitized error message.
- A playlist URL containing `username=` or `password=` query params never surfaces those values in log output or API responses (verified by asserting on thrown error messages in unit tests).
- Parser unit tests cover: happy path, missing `#EXTM3U`, entries with no URL, mixed group titles, episode extraction with S\d+E\d+, and empty playlist.
- Client unit tests cover: happy path, HTTP 401, network timeout, and non-M3U body.
