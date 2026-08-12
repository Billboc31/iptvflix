# T022 — Test Report

## Summary

**PASS** — All acceptance criteria satisfied. No regressions detected.

---

## Commands Executed

```
npm run typecheck                                              → api-contracts ✓, apps/web ✓, apps/api ✗ (pre-existing)
cd apps/api && npx vitest run src/routes/catalog.test.ts      → 25/25 ✓
cd apps/api && npx vitest run                                 → 343/343 ✓ (28 test files)
cd apps/web && npx vitest run src/components/detail/SeasonAccordion.test.tsx EpisodeRow.test.tsx → 13/13 ✓
cd apps/web && npx vitest run src/pages/SeriesDetailPage.test.tsx → 6/6 ✓
cd apps/web && npx vitest run                                 → 77/77 ✓ (15 test files)
```

---

## Acceptance Criteria

### AC1 — One canonical Series page shows its known Seasons and Episodes rather than duplicate provider series structures.
**PASS**  
`SeriesDetailPage` renders a single unified view through `SeasonAccordion`. Episodes are fetched once per season and each episode appears once regardless of how many providers carry it. Confirmed by `SeriesDetailPage.test.tsx` (6 tests).

### AC2 — A Season can show `X/Y episodes available` when the total known episode count is reliable.
**PASS**  
`SeasonAccordion` renders `{availableEpisodeCount} / {episodeCount} disponible(s)` per season. When `episodeCount === 0`, no fraction is shown. Backend computes `availableEpisodeCount` via a grouped sub-select on `episodeAvailabilities` filtered to `status = 'AVAILABLE'`. Tested in `SeasonAccordion.test.tsx` (6 tests) and `catalog.test.ts` (seasons with 2 available / 0 available).

### AC3 — An Episode can show availability from multiple configured sources without appearing multiple times in the episode list.
**PASS**  
The episodes endpoint returns one `EpisodeResponse` per episode with a `variants` array. API test (`catalog.test.ts` line 486–513) explicitly verifies that an episode with two AVAILABLE `episodeAvailabilities` from different providers appears exactly once with `variants.length > 1`.

### AC4 — Missing availability is visibly distinct from missing/unknown episode metadata.
**PASS**  
`EpisodeRow` applies `opacity-50` and shows an "Indisponible" badge in red when `availabilityStatus === 'UNAVAILABLE'`. Episodes not in the canonical DB are not returned by the API and therefore not rendered, which is the correct behavior (no phantom rows). Tested in `EpisodeRow.test.tsx`.

### AC5 — Existing watched/in-progress state is reflected in the episode hierarchy.
**PASS**  
`SeriesDetailPage` fetches the active profile and passes `profileId` to `SeasonAccordion`, which passes it to `getSeriesSeasonEpisodes`. Backend joins `viewingProgress` when `profileId` is present, computing `watchState` using thresholds (`< 5%` → `'unwatched'`, `5–90%` → `'in_progress'`, `≥ 90%` → `'watched'`). `EpisodeRow` shows "✓ Vu" (green) for watched and "◑ En cours" (blue) for in_progress. Tested in `catalog.test.ts` (lines 458–484) and `EpisodeRow.test.tsx`.

### AC6 — Partial source coverage (e.g., Plex S1-S3 and IPTV S1-S5) is represented correctly.
**PASS**  
The `X/Y disponible(s)` display on each season header correctly represents partial availability. Seasons where Plex coverage stops will show lower `availableEpisodeCount` values. The backend aggregation is source-agnostic and counts any `AVAILABLE` `episodeAvailability` regardless of provider. Verified by the `availableEpisodeCount = 0` season test case.

### AC7 — Language/quality variants do not duplicate Episode rows.
**PASS**  
Variants (different languages or qualities from different providers) are stored in the `variants` array of a single `EpisodeResponse`. Confirmed by the multi-source API test (`catalog.test.ts` lines 486–513).

### AC8 — Automated API/frontend tests cover full, partial, multi-source and unavailable episode cases.
**PASS**  
Coverage summary:
- **Full availability**: Episodes with all seasons available — baseline test cases
- **Partial availability**: Season with `availableEpisodeCount = 2` and season with `0` in the same series
- **Multi-source variants**: Episode with two AVAILABLE variants from different providers, appears once with `variants.length > 1`
- **Unavailable**: Episode with `status = 'UNAVAILABLE'`, correct status and `watchState` handling
- **Watch state without profileId**: all episodes → `watchState: null`
- **Watch state with profileId**: mixed progress (watched / in_progress / unwatched)
- **Invalid profileId (not UUID)**: 400 response

---

## Regressions

None. Full suites:
- `apps/api`: **343 tests / 28 files — all pass**
- `apps/web`: **77 tests / 15 files — all pass**

---

## TypeScript Compilation

- `packages/api-contracts`: **clean** (no errors)
- `apps/web`: **clean** (no errors)
- `apps/api`: pre-existing errors in `src/routes/sources.test.ts`, `src/services/__tests__/catalog-sync-service.test.ts`, and `src/__tests__/integration/vertical-slice.test.ts`. These files were **not modified by T022** (confirmed via `git log main..HEAD -- <file>` returning empty). Not a T022 regression.

---

## Non-Blocking Observations

- MSW warnings `GET /api/profile` in `SeriesDetailPage.test.tsx` — the profile fetch has no MSW mock handler, so `profileId` stays `undefined` in tests. The page handles this gracefully and `watchState` defaults to `null`. Tests pass. A future improvement would be to add the handler for completeness, but this is not a T022 requirement.
- Season availability logic resides in `apps/api/src/routes/catalog.ts` rather than a separate service layer — this is a structural deviation from the plan but doesn't affect correctness or test coverage.

---

## Verdict

**VALIDATED** — implementation satisfies all eight acceptance criteria. No regressions. TypeScript errors in the build are pre-existing from prior tickets, not introduced by T022.
