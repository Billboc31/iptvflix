All checks complete. I now have a full picture of the post-fix state.

---

# PR Review — T074: Populate canonical TV seasons and episodes from TMDB (attempt 2)

## Summary

This is a re-review after `IMPLEMENTATION_FIX_REQUIRED`. Both blocking issues flagged in the previous review have been correctly addressed. The implementation is functionally complete, TypeScript-clean (for T074 changes), and all 67 related tests pass.

---

## Vérifications effectuées

- `metadata-enrichment-service.ts` — upsert seasons + upsert episodes
- `catalog-bootstrap-service.ts` — priority tier, checkpoint, config
- `routes/catalog.ts` — fire-and-forget, concurrency guard, header
- `config/env.ts` — new env var
- `providers/metadata/types.ts` + `tmdb/client.ts` — `name`/`airDate` on seasons
- `index.ts` — wiring
- Tests: `metadata-enrichment-service.test.ts`, `catalog-bootstrap-service.test.ts`, `catalog.test.ts`
- TypeScript: `tsc --noEmit` (T074-scope errors only)
- Test run: `vitest run` — 67/67 passed

---

## Fixes from previous review — verified

### [BLOQUANT → RÉSOLU] TypeScript type error dans `catalog-bootstrap-service.test.ts`

`const config: BootstrapConfig` at line 16 now includes `hierarchyPriorityCount: 200` (line 23). The required interface field is satisfied. The `tsc --noEmit` output shows only two pre-existing errors in unrelated files (`authenticateDevice.test.ts` and `playback-resolver.test.ts`) — neither introduced by T074.

### [MINEUR → RÉSOLU] Concurrency guard for on-demand hydration

`catalog.ts:99` declares `const hydrationInProgress = new Set<string>()` at module level. The trigger block at line 295 checks `!hydrationInProgress.has(id)`, adds the id at line 297, and removes it via `.finally(() => hydrationInProgress.delete(id))` at line 298. Concurrent requests for the same un-hydrated series now fire exactly one TMDB call. Implementation matches the plan specification.

---

## Acceptance criteria — full check

| Criterion | Status |
|---|---|
| TMDB-imported Series can have seasons/episodes before any source | ✅ `enrichSeries()` upserts season rows; `enrichSeriesSeasons()` upserts episode rows |
| Canonical TMDB identity, not Xtream | ✅ Upsert keys are `(seriesId, seasonNumber)` / `(seasonId, episodeNumber)` from TMDB |
| Series with zero sources returns hierarchy via API | ✅ `GET /series/:id` returns `seasons[]` independent of availabilities |
| Bootstrap documents and implements scalable strategy | ✅ Priority tier (top-200 by popularity) + refresh scheduler for remainder; strategy documented in code comment |
| On-demand hydration without full bootstrap rerun | ✅ Fire-and-forget in `GET /series/:id`; `enrichSeries()` also callable directly |
| Scheduled refresh discovers new seasons/episodes | ✅ Refresh buckets already call `enrichSeries()`; upsert now creates hierarchy |
| Specials/season 0, miniseries, future/partial metadata | ✅ No filter on `seasonNumber`; nullable fields default to `null` |
| Repeated hydration is idempotent, no duplicates | ✅ `INSERT ... ON CONFLICT DO UPDATE` on both seasons and episodes; tested |
| Progress/watch-state/source links preserved on refresh | ✅ `episodeAvailabilities` and `viewingProgress` tables untouched by upserts |
| Xtream/Plex attach to canonical episodes, not define them | ✅ Source sync path not modified; enrichment is the write path |
| TMDB rate limits/retries handled | ✅ 250ms per-season throttle; 500ms inter-batch delay in bootstrap; client retry/backoff in place |
| Progress/observability for large hydration | ✅ `console.log` counts in bootstrap tier; `console.info` on on-demand trigger |
| Automated tests for all key scenarios | ✅ 5 enrichment tests, 3 on-demand hydration tests, 2 bootstrap config tests — all green |

---

## Observations (non-blocking, unchanged from previous review)

**Bootstrap may skip recently-enriched series without hierarchy**: `enrichSeries()` returns `'skipped'` when `metadataEnrichedAt` is within the stale window. A series enriched before this fix with a recent timestamp will be skipped by the priority tier and picked up at the next refresh cycle. Acceptable for an initial bootstrap; no code change required.

**Parallelism in bootstrap tier**: 5 concurrent `enrichSeries()` calls, each triggering 4 parallel TMDB calls = up to 20 simultaneous requests per batch. TMDB client backoff handles 429s. Acceptable given the documented strategy.

---

## Decision

Both blocking issues from the previous review are resolved. TypeScript is clean for T074 scope. All 67 tests pass. Implementation correctly satisfies all acceptance criteria. No new issues introduced.

IMPLEMENTATION_APPROVED
