## Objective

Extend the T096 multi-provider segment ingestion architecture with a real TheIntroDB adapter, classify SkipMe as NOT VIABLE with evidence, implement deterministic multi-provider merge/ranking with persisted provenance, and enhance diagnostics — without duplicating the T096 schema or replacing the IntroDB adapter.

## Included

### Provider verification (runs/T097/provider-research.md)

Document from research conducted before implementation:

**TheIntroDB — CONDITIONALLY VIABLE**
- API: `https://api.theintrodb.org/v3`
- Auth: None required for reads; optional user key for pending-submission inclusion
- Identifiers: TMDB (primary, preferred), IMDb and TVDB as fallback
- Segment types: `intro`, `recap`, `credits`, `preview` — each returned as an **array** (multiple sub-segments per type are possible)
- Rate limits: Enforced server-side via `X-RateLimit-Limit/Remaining/Reset` and `X-UsageLimit-Limit/Remaining/Reset` response headers; exact thresholds are not published
- Bulk export: Not available
- ToS: `/terms` returns 403; no publicly readable data-reuse or caching policy found — contact `hello@theintrodb.org` required before production-scale caching/redistribution
- Production read intent: Clear — official Jellyfin, Emby, Kodi, Infuse integrations exist and make live API calls
- **Gate**: ToS confirmation from TheIntroDB required before scale deployment; adapter is built with this caveat documented

**SkipMe (`db.skipme.workers.dev`) — NOT VIABLE**
- Source: Internal undocumented Cloudflare Workers endpoint operated by the Jellyfin `intro-skipper` org; exposed incidentally by the open-source plugin source code
- Segment types technically present in source: `intro`, `recap`, `credits`, `preview`, `commercial`
- Identifiers: TMDB, IMDb, TVDB, AniList (inferred from C# plugin)
- Rate limits: Unknown — not documented anywhere
- ToS: None — no terms of service file, no data license, no permission grant for third-party use in any repository or public channel
- Bulk export: Not available
- **Decision**: NOT VIABLE — using an undocumented endpoint with no ToS provides no legal permission and no stability or availability guarantee
- **Alternative on record**: SkipDB (`api.skipdb.tv`) has a documented public API, 120 req/min read limit, and ODbL 1.0 license (requires publishing derived segment data under ODbL if cached server-side). Separate follow-up ticket if this trade-off is acceptable.

---

### 1. Extend CanonicalEpisodeRef — `apps/api/src/providers/segments/types.ts`

Add `seriesTmdbId: number | null` to `CanonicalEpisodeRef`. TheIntroDB's primary lookup path requires a numeric TMDB series ID. Update all callers:
- `SegmentSyncService.syncEpisode()` — populate from the series DB row (already available)
- `SegmentSyncService.syncEpisodeById()` — pass through
- Existing IntroDB client ignores the new field (no change needed to IntroDB adapter)

---

### 2. TheIntroDB adapter — `apps/api/src/providers/segments/theintrodb/`

**`types.ts`** — wire types for API v3:
```ts
interface TheIntroDbSegment { start: number; end: number; submissions?: number; verified?: boolean }
interface TheIntroDbResponse {
  intro?: TheIntroDbSegment[]
  recap?: TheIntroDbSegment[]
  credits?: TheIntroDbSegment[]
  preview?: TheIntroDbSegment[]
}
```

**`errors.ts`** — `TheIntroDbRateLimitError` (with `retryAfterSec` parsed from `X-RateLimit-Reset`), `TheIntroDbNetworkError` (timeout, connection, bad response). Match the IntroDB error pattern.

**`mapper.ts`** — converts TheIntroDB response to `RawSegment[]`:
- `intro` → `INTRO`, `recap` → `RECAP`, `credits` → `CREDITS`, `preview` → `PREVIEW`
- Timestamps are in **seconds** → multiply by 1000 for ms
- `sourceProvider: 'theintrodb'`
- When the response returns an array for a type, select the entry with the highest `submissions` (tie-break: first entry); the unique constraint `(episodeId, type, sourceProvider)` allows only one row per type per provider
- `submissionCount` and `confidence` (normalized 0–1 from submissions count, or pass `verified` as a binary signal) preserved

**`client.ts`** — implements `SegmentProvider`:
- Env var: `THEINTRODB_BASE_URL` (default `https://api.theintrodb.org/v3`)
- Primary path: `GET /media?tmdb_id=<seriesTmdbId>&season=<n>&episode=<n>`
- Fallback path: `GET /media?imdb_id=<seriesImdbId>&season=<n>&episode=<n>` when no TMDB ID
- Parse `X-RateLimit-Remaining` and `X-UsageLimit-Remaining` on every response; log a warning when either drops below a configurable threshold (default 10)
- On 429: exponential backoff using `X-RateLimit-Reset` or `Retry-After` header (same pattern as IntroDB client, max 60s, 3 retries)
- On 404: return empty array
- Timeout: 10s with AbortSignal
- Unknown segment type keys in response: log warning and skip (do not map incorrectly)

**`__tests__/client.test.ts`** — cover: 429/backoff respects reset header, 404 returns empty, timeout aborts, TMDB path used when available, falls back to IMDb path when `seriesTmdbId` is null, unknown segment key in response is skipped

**`__tests__/mapper.test.ts`** — cover: type mapping for all four types, seconds-to-ms conversion, multi-entry array → picks highest submissions, anime fixture (known episode with non-trivial timestamps), null-start / null-end handling

---

### 3. Multi-provider merge/ranking — `apps/api/src/services/segment-merger.ts`

Pure function with no DB access:

```ts
interface MergedSegment {
  type: SegmentType
  startMs: number
  endMs: number
  selectedProvider: string
  selectionReason: string
  provenance: Array<{
    provider: string; startMs: number; endMs: number
    confidence?: number; submissionCount?: number
  }>
}

function mergeSegments(
  rawSegments: RawSegment[],
  providerPriority: string[],  // ordered list, e.g. ['introdb', 'theintrodb']
): MergedSegment[]
```

Algorithm (deterministic):
1. Group raw segments by `type`
2. Within each type group, cluster segments whose `startMs` values fall within `±CLUSTER_TOLERANCE_MS` (constant: 2000ms) of each other
3. For each cluster:
   - If ≥ 2 providers agree: select the segment with highest `submissionCount` (tie-break: highest `confidence`, then lowest index in `providerPriority`); `selectionReason = 'cluster-consensus'`
   - If singleton (only one provider): use it; `selectionReason = 'sole-provider'`
4. Duration sanity: discard any segment where `endMs - startMs < 5000` (< 5 s) or `startMs >= endMs`; `selectionReason = 'discarded-invalid-duration'` logged but not emitted
5. Return one `MergedSegment` per type with full `provenance` array

---

### 4. New DB table `segment_selections` — migration

**New migration file: `apps/api/src/db/migrations/XXXX_add_segment_selections.ts`**

```sql
CREATE TABLE segment_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  selected_provider TEXT NOT NULL,
  selection_reason TEXT NOT NULL,
  provenance JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (episode_id, type)
);
```

Add corresponding Drizzle schema definition: `apps/api/src/db/schema/segment-selections.ts`

---

### 5. Update SegmentSyncService — `apps/api/src/services/segment-sync-service.ts`

After collecting all provider `RawSegment[]` results:
1. Upsert all raw rows into `media_segments` as before (existing behaviour unchanged)
2. Call `mergeSegments(allRawSegments, providerPriority)` to produce `MergedSegment[]`
3. Upsert `MergedSegment[]` into `segment_selections` on conflict `(episodeId, type)` — update all fields including `provenance`

One provider failure (network error, 429) must not block the other provider; errors are caught per-provider, the successful provider's raw rows are still upserted, and merge runs on the subset of available results.

Provider priority order (configurable, default): `['introdb', 'theintrodb']` — passed from registration site in `index.ts`.

---

### 6. Update client API — `apps/api/src/routes/episodes.ts`

`GET /episodes/:id/segments` now queries `segment_selections` instead of `media_segments`:
- Returns `{ episodeId, segments: [{ type, startMs, endMs }] }` (same contract as T096)
- No provider provenance in client response

---

### 7. Update provider registry — `apps/api/src/index.ts` and `apps/api/src/config/env.ts`

`env.ts`: add `THEINTRODB_BASE_URL` (optional, default `https://api.theintrodb.org/v3`).

`index.ts`: add `TheIntroDbClient` to the provider array:
```ts
[
  new IntroDbClient({ baseUrl: INTRODB_BASE_URL }),
  new TheIntroDbClient({ baseUrl: THEINTRODB_BASE_URL }),
]
```

Pass a `providerPriority` string array derived from the provider list order to `SegmentSyncService` constructor.

---

### 8. Enhanced diagnostics — `apps/api/src/routes/segment-admin.ts`

**`GET /admin/segments/coverage`** — extend response:
```json
{
  "totalEpisodes": 0,
  "episodesWithAnySegment": 0,
  "episodesWithMergedSelection": 0,
  "byProvider": {
    "introdb": { "episodes": 0, "byType": { "INTRO": 0, "RECAP": 0, "OUTRO": 0 } },
    "theintrodb": { "episodes": 0, "byType": { "INTRO": 0, "RECAP": 0, "CREDITS": 0, "PREVIEW": 0 } }
  },
  "providerOverlap": { "introdb+theintrodb": 0 },
  "disagreementRate": 0.0,
  "noDataRate": 0.0,
  "identifierMismatchRate": 0.0,
  "animeEpisodes": 0,
  "animeWithAnySegment": 0
}
```
`disagreementRate` = episodes where same-type segments from ≥2 providers fall outside ±2s cluster / total episodes with ≥2 providers for that type.

**`GET /admin/segments/episode/:id`** — extend response to include:
- All raw `media_segments` rows (existing)
- All `segment_selections` rows for the episode, each with `selectedProvider`, `selectionReason`, and full `provenance` array

---

### 9. Update backfill script — `apps/api/src/scripts/backfill-segments.ts`

No structural change required — `SegmentSyncService.backfillCatalog()` already iterates all registered providers. Verify:
- `seriesTmdbId` is passed through in `CanonicalEpisodeRef` from the series row
- Per-provider error counters are tracked independently in `BackfillResult`

---

### 10. New and updated tests

**New: `apps/api/src/services/__tests__/segment-merger.test.ts`**
- Cluster match within ±2s → single merged segment with both providers in provenance
- Providers disagree (>2s apart) → two clusters, each emitted (different types clash handled gracefully)
- Ranking: higher submissionCount wins; tie-break by confidence; tie-break by provider priority
- Duration sanity: segment < 5s discarded
- Sole provider → emitted with `selectionReason = 'sole-provider'`
- Provenance array contains all contributing provider entries

**New: `apps/api/src/providers/segments/theintrodb/__tests__/client.test.ts` and `mapper.test.ts`** (described above)

**Update: `apps/api/src/services/__tests__/segment-sync-service.test.ts`**
- Two-provider path: both providers succeed → merge runs, `segment_selections` upserted
- One provider fails (network) → other provider's raw rows stored, merge runs on partial data
- Idempotent re-run → same `segment_selections` row updated, not duplicated
- Identifier mismatch (no IMDb ID, no TMDB ID) → skip with `segment_numbering_ambiguous` event (existing behaviour)

---

### 11. Anime validation documentation — `runs/T097/anime-validation.md`

Before closing the ticket, manually validate using real anime episodes (minimum 3, including one long-running series). Document:
- Which provider returned data, timestamps compared to expected
- Season 0 / specials: how each provider handles absolute vs ordinal numbering
- AniList gap: neither IntroDB nor TheIntroDB uses AniList as a lookup key; both rely on TMDB/IMDb which may not cover all anime
- Split-cours handling: document any numbering discrepancy observed

---

## Excluded

- SkipMe (`db.skipme.workers.dev`) integration — NOT VIABLE; no ToS, undocumented endpoint
- SkipDB (`api.skipdb.tv`) integration — not a named provider in this ticket; separate follow-up required
- Anime Skip / AniSkip integration
- `POST_CREDITS` segment type — no real provider in scope exposes it
- Client-side skip UI ("Passer l'intro" button, auto-skip settings) — data only, no player UX
- AniList ID resolution — neither viable provider accepts AniList as a lookup key
- TVDB ID resolution — not needed for IntroDB (IMDb) or TheIntroDB (TMDB primary) primary paths
- Storing multiple sub-segments per type per provider — current unique constraint allows one; multi-segment selection is handled at mapper level (pick best entry)
- Changing the T096 IntroDB adapter, schema, or existing test suite beyond the `seriesTmdbId` addition to `CanonicalEpisodeRef`

## Acceptance criteria

- [ ] `runs/T097/provider-research.md` exists; TheIntroDB documented as conditionally viable (ToS gap noted, contact required); SkipMe documented as NOT VIABLE with evidence (undocumented endpoint, no ToS)
- [ ] `apps/api/src/providers/segments/theintrodb/client.ts` exists, implements `SegmentProvider`, uses TMDB primary path and falls back to IMDb path, parses rate-limit headers, handles 429 with exponential backoff, returns empty array on 404
- [ ] Smoke test or manual run confirms `TheIntroDbClient` fetches real segments for at least one live-action episode and one anime episode
- [ ] `CanonicalEpisodeRef` in `types.ts` includes `seriesTmdbId: number | null` and all callers pass it correctly
- [ ] DB migration creates `segment_selections` with unique constraint `(episode_id, type)`; `drizzle-kit migrate` runs cleanly
- [ ] `mergeSegments()` in `segment-merger.ts`: clusters within ±2s, ranks by submissionCount → confidence → providerPriority, discards segments < 5s, preserves full provenance array
- [ ] `SegmentSyncService.syncEpisode()` upserts raw rows into `media_segments` AND merged results into `segment_selections` after each sync
- [ ] `GET /episodes/:id/segments` queries `segment_selections`; returns exactly one `INTRO` segment when two providers agree within ±2s
- [ ] A network failure from one provider does not prevent the other provider's data from being stored and merged
- [ ] `GET /admin/segments/coverage` returns per-provider episode counts, type breakdowns, overlap count, disagreement rate, no-data rate
- [ ] `GET /admin/segments/episode/:id` returns all raw `media_segments` rows plus `segment_selections` rows with `selectionReason` and `provenance`
- [ ] `segment-merger.test.ts` passes: cluster match, sole provider, conflict resolution, duration sanity, provenance preservation
- [ ] `TheIntroDbClient` tests pass: 429/backoff, 404→empty, timeout, TMDB path, IMDb fallback, unknown key skipped
- [ ] All existing T096 IntroDB tests pass without modification
- [ ] `THEINTRODB_BASE_URL` documented in `apps/api/src/config/env.ts`
- [ ] `runs/T097/anime-validation.md` exists with results for ≥3 real anime episodes and documents the AniList gap and season 0 behaviour
