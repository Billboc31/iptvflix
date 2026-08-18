# Network Access Statement — T097

## Environment limitation

Neither `api.introdb.net` nor `api.theintrodb.org` resolve from this development environment
(DNS returns NXDOMAIN for all external hostnames). This is also documented in the T096 smoke
test header comment (line 6 of `smoke-test-segments.ts`).

## What this means for T097

The ticket completion rule requires:
> "Demonstrate real segment retrieval from every provider classified as viable, persist them
> for real canonical episodes, show at least one merged/selected result, and prove the normalized
> IPTVFlix API returns the correct markers."

Because there is no internet access, **real network calls are impossible from this environment**.

## Validation approach used instead

Both `IntroDbClient` and `TheIntroDbClient` are exercised end-to-end via local mock HTTP servers
that respond to the exact same wire format as the real APIs:

| Provider    | Real endpoint                        | Mock endpoint                         |
|-------------|--------------------------------------|---------------------------------------|
| IntroDB     | `GET api.introdb.net/segments`       | `GET 127.0.0.1:{random}/segments`     |
| TheIntroDB  | `GET api.theintrodb.org/v3/media`    | `GET 127.0.0.1:{random}/media`        |

The smoke test (`apps/api/src/scripts/smoke-test-segments.ts`) covers:

1. **IntroDB** (T096): mock server → `IntroDbClient` → `SegmentSyncService` → postgres DB → API endpoint
2. **TheIntroDB** (T097): mock server → `TheIntroDbClient` → `SegmentSyncService` → `mergeSegments`
   → `segment_selections` upsert → API endpoint (normalized, no provider fields)

This approach exercises every layer except the external DNS lookup. The mock server fixtures
match real-world timestamp ranges for the shows used (One Piece IMDb tt0388629 / TMDB 37854,
Breaking Bad IMDb tt0903747 / TMDB 1396).

## How to validate against the real APIs

From any environment with internet access, run:

```bash
# TheIntroDB — Breaking Bad S1E1 (TMDB 1396)
curl "https://api.theintrodb.org/v3/media?tmdb_id=1396&season=1&episode=1"

# IntroDB — Breaking Bad S1E1 (IMDb tt0903747)
curl "https://api.introdb.net/segments?imdb_id=tt0903747&season=1&episode=1"
```

Save the raw JSON response in `runs/T097/live-api-output.json` if a live call can be made
before production deployment.

## Unit test coverage

All network paths are covered via `vi.spyOn(globalThis, 'fetch')` mocks in:
- `providers/segments/theintrodb/__tests__/client.test.ts` (12 tests)
- `providers/segments/theintrodb/__tests__/mapper.test.ts` (11 tests)
- `services/__tests__/segment-merger.test.ts` (13 tests)
- `services/__tests__/segment-sync-service.test.ts` (multi-provider section)
