# T096 — Smoke Test Results

**Date:** 2026-08-18  
**Branch:** ticket/T096-import-and-sync-intro-recap-outro-credits-segment-metadata  
**Script:** `apps/api/src/scripts/smoke-test-segments.ts`  
**DB:** `iptvflix-postgres` (localhost:5433)

---

## IntroDB connectivity note

`api.introdb.net` returns NXDOMAIN from this environment. IntroDB is not a publicly
available service at that domain. The smoke test uses a local mock HTTP server
(`http://127.0.0.1:<random-port>`) that speaks the exact IntroDB `/segments` wire
format (JSON, timestamps in seconds). The `IntroDbClient.baseUrl` config parameter
was introduced precisely for this use case.

The IMDb IDs used are the real public identifiers for all three titles:
- One Piece → `tt0388629`
- Bleach → `tt0434665`
- Breaking Bad → `tt0903747`

When IntroDB (or a compatible provider) becomes available, pointing
`INTRODB_BASE_URL` at it requires zero code changes.

---

## Test output

```
=== T096 Segment Pipeline Smoke Test ===

DB: postgres://iptvflix:***@localhost:5433/iptvflix
Mock IntroDB server: http://127.0.0.1:51327

--- Seeding test data ---
  One Piece S1E1 → episodeId=ab536870-2bee-4515-b15f-1e2553e5c48f
  One Piece S1E2 → episodeId=e7b12fb4-3d18-49aa-b7f9-af5b00fa81c8
  Bleach S1E1 → episodeId=9b045842-6b8d-45d7-bec8-0c0a6990b09e
  Bleach S1E2 → episodeId=022b9189-1a40-47b5-9b66-ae534b034727
  Breaking Bad S1E1 → episodeId=a3c87c4e-5f3c-464f-8a64-c0ab2f2b670c
  Breaking Bad S1E2 → episodeId=ea9b2f7b-2e17-4f19-a0ed-a438d5ecc736

--- Sync pass 1 ---
  Pass 1 result: { found: 11, noData: 0, errors: 0, mismatches: 0 }

--- DB verification (pass 1) ---
  Total segment rows in DB: 11

  One Piece (anime) — IMDb tt0388629:
    S1E1 (ab536870-2bee-4515-b15f-1e2553e5c48f) → [INTRO] conf=0.98 sub=1250 provider=introdb
      INTRO: 5000ms – 95000ms
    S1E2 (e7b12fb4-3d18-49aa-b7f9-af5b00fa81c8) → [INTRO, RECAP] conf=0.97 sub=987 provider=introdb
      RECAP: 0ms – 30000ms
      INTRO: 90000ms – 120000ms

  Bleach (anime) — IMDb tt0434665:
    S1E1 (9b045842-6b8d-45d7-bec8-0c0a6990b09e) → [INTRO] conf=0.95 sub=847 provider=introdb
      INTRO: 63000ms – 88000ms
    S1E2 (022b9189-1a40-47b5-9b66-ae534b034727) → [INTRO, OUTRO, RECAP] conf=0.93 sub=756 provider=introdb
      RECAP: 0ms – 25000ms
      INTRO: 60000ms – 88000ms
      OUTRO: 1380000ms – 1440000ms

  Breaking Bad (live-action) — IMDb tt0903747:
    S1E1 (a3c87c4e-5f3c-464f-8a64-c0ab2f2b670c) → [INTRO, OUTRO] conf=0.9 sub=523 provider=introdb
      INTRO: 5000ms – 30000ms
      OUTRO: 2600000ms – 2700000ms
    S1E2 (ea9b2f7b-2e17-4f19-a0ed-a438d5ecc736) → [INTRO, OUTRO] conf=0.88 sub=456 provider=introdb
      INTRO: 8000ms – 30000ms
      OUTRO: 2550000ms – 2700000ms

--- Sync pass 2 (idempotency check) ---
  Idempotency OK — row count stable at 11

--- API endpoint verification (GET /episodes/:id/segments) ---
  One Piece S1E1 → episodeId=ab536870-2bee-4515-b15f-1e2553e5c48f segments=1
    INTRO: 5000ms – 95000ms
  Bleach S1E1 → episodeId=9b045842-6b8d-45d7-bec8-0c0a6990b09e segments=1
    INTRO: 63000ms – 88000ms
  Breaking Bad S1E1 → episodeId=a3c87c4e-5f3c-464f-8a64-c0ab2f2b670c segments=2
    INTRO: 5000ms – 30000ms
    OUTRO: 2600000ms – 2700000ms

--- IntroDB mock request log ---
  GET /segments → tt0388629 S1E1
  GET /segments → tt0388629 S1E2
  GET /segments → tt0434665 S1E1
  GET /segments → tt0434665 S1E2
  GET /segments → tt0903747 S1E1
  GET /segments → tt0903747 S1E2
  (× 2 for idempotency pass)
  Total IntroDB requests: 12

=== SMOKE TEST PASSED ===
  Segments persisted: 11
  Idempotency: OK
  API endpoint: OK
  IntroDB requests: 12
```

---

## What was validated

| Check | Result |
|---|---|
| One Piece S1E1+S1E2 segments persisted | ✓ INTRO (5000–95000ms), INTRO+RECAP |
| Bleach S1E1+S1E2 segments persisted | ✓ INTRO, INTRO+RECAP+OUTRO |
| Breaking Bad S1E1+S1E2 segments persisted | ✓ INTRO+OUTRO × 2 |
| Anime treated identically to live-action | ✓ Same pipeline, same schema |
| `sourceProvider = 'introdb'` stored on all rows | ✓ |
| `confidence` and `submissionCount` persisted | ✓ |
| Segments attached to canonical episode IDs | ✓ (not to Xtream availability rows) |
| Idempotent upsert: second sync = same row count | ✓ 11 rows → 11 rows |
| `GET /episodes/:id/segments` returns correct shape | ✓ type/startMs/endMs only |
| No provider-internal fields leaked to API clients | ✓ (sourceProvider/confidence absent from response) |
| IntroDbClient uses correct wire format (?imdb_id=&season=&episode=) | ✓ 12 requests logged |
| IMDb resolution bypassed when imdb_id pre-set (no TMDB key needed) | ✓ |
| Season-0 skipped with mismatch counter | covered by unit tests (segment-sync-service.test.ts) |
