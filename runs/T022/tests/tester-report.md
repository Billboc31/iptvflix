# T022 — Test Report

Date: 2026-08-12

## Summary

**PASS** — All 8 acceptance criteria are satisfied. All automated tests pass with no regressions.

---

## Acceptance Criteria

### AC1 — One canonical Series page shows its known Seasons and Episodes rather than duplicate provider series structures.

**PASS**

`GET /series/:id` returns a unified `SeriesDetailResponse` with a `seasons` array. `GET /series/:id/seasons/:seasonNumber/episodes` returns episodes once per episode (not once per provider). The `SeasonAccordion` component renders a single expandable list per season, calling `getSeriesSeasonEpisodes` once per season on expand.

---

### AC2 — A Season can show `X/Y episodes available` when the total known episode count is reliable.

**PASS**

`SeasonSummary` in `packages/api-contracts/src/catalog.ts` includes `availableEpisodeCount: number`. The backend computes it via a grouped sub-select on `episodeAvailabilities` (status = AVAILABLE, count distinct by episodeId). `SeasonAccordion` renders `{availableEpisodeCount} / {episodeCount} disponible(s)` when `episodeCount > 0`; hides the fraction when `episodeCount === 0`.

Verified by:
- API test: "returns availableEpisodeCount per season aggregated from episode availabilities" (S1 → 2, S2 → 0)
- Frontend test: "shows availableEpisodeCount / episodeCount fraction in header", "shows '0 / N disponible' when no episodes available", "does not show fraction when episodeCount is 0"

---

### AC3 — An Episode can show availability from multiple configured sources without appearing multiple times in the episode list.

**PASS**

The episode endpoint groups `episodeAvailabilities` rows into a `Map<episodeId, AvailabilityVariantResponse[]>`. Each episode appears exactly once in the response, with all source variants in its `variants` array.

Verified by:
- API test: "episode with multiple AVAILABLE variants appears once with all variants" — one episode row, `variants.length === 2`, `availabilityCount === 2`.

---

### AC4 — Missing availability is visibly distinct from missing/unknown episode metadata.

**PASS**

`EpisodeRow` applies `opacity-50` styling and displays "Indisponible" badge when `availabilityStatus === 'UNAVAILABLE'`. Episodes that do not exist in the canonical episodes table simply do not appear in the list (per plan exclusion; metadata matching is out of scope).

Verified by:
- Frontend test: "shows Indisponible badge and muted style for UNAVAILABLE episode"
- API test: "episode with all UNAVAILABLE variants shows availabilityStatus UNAVAILABLE and watchState null"

---

### AC5 — Existing watched/in-progress state is reflected in the episode hierarchy.

**PASS**

`EpisodeResponse.watchState: 'unwatched' | 'in_progress' | 'watched' | null` is computed using `progressSeconds / durationSeconds` thresholds (< 0.05 → unwatched, 0.05–0.90 → in_progress, ≥ 0.90 → watched). `EpisodeRow` renders "✓ Vu" for watched and "◑ En cours" for in_progress; no indicator for unwatched/null. `SeriesDetailPage` fetches the active profile ID and passes it to `SeasonAccordion` → `getSeriesSeasonEpisodes`.

Verified by:
- API test: "returns correct watchState per episode when profileId is provided" (EP1=watched, EP2=in_progress, EP3=unwatched)
- API test: "returns watchState null for all episodes when profileId is absent"
- Frontend tests: "shows 'Vu' indicator for watched state", "shows 'En cours' indicator for in_progress state", "shows no watch state indicator when watchState is null/unwatched"

---

### AC6 — Partial source coverage (e.g. Plex S1-S3 and IPTV S1-S5) is represented correctly.

**PASS**

`availableEpisodeCount` is computed per season across all sources using `count(distinct episodeAvailabilities.episodeId)` joined through `episodes → seasons` for the given series. Seasons absent from the available-count query default to 0 via `availEpCountMap.get(s.seasonNumber) ?? 0`. This means partial coverage from any combination of sources is reflected correctly per season.

Verified by:
- API test: 2-season series with S1 having 2 available episodes and S2 having 0.

---

### AC7 — Language/quality variants do not duplicate Episode rows.

**PASS**

All `episodeAvailabilities` rows (regardless of language, quality, or provider) for an episode are collected into the same `variants` array via `epVariantMap`. The episode row count in the response equals the number of distinct episodes, not the number of availability records.

Verified by AC3 test and by the `epVariantMap` grouping logic in `apps/api/src/routes/catalog.ts:323-329`.

---

### AC8 — Automated API/frontend tests cover full, partial, multi-source and unavailable episode cases.

**PASS**

| Test suite | Count | Result |
|---|---|---|
| `apps/api` — all tests | 343 | ✓ PASS |
| `apps/web` — all tests | 77 | ✓ PASS |

New tests added by T022:
- `catalog.test.ts`: availableEpisodeCount aggregation, watchState without profileId, watchState with profileId (3 states), multi-source variants (1 episode / 2 variants), UNAVAILABLE episode, invalid profileId → 400
- `SeasonAccordion.test.tsx`: fraction display, 0/N, no fraction when 0 episodes, plural/singular
- `EpisodeRow.test.tsx`: watched, in_progress, null, unwatched states, UNAVAILABLE styling, title fallback

---

## TypeScript Compilation

| Package | Result |
|---|---|
| `packages/api-contracts` | ✓ No errors |
| `apps/web` | ✓ No errors |
| `apps/api` | Pre-existing errors in `vertical-slice.test.ts`, `sources.test.ts`, `catalog-sync-service.test.ts` — all in files not touched by T022 |

The pre-existing API errors are in test files modified by earlier tickets (T018–T021) and do not affect the T022 scope. No new type errors were introduced.

---

## Regressions

None observed. All 343 API tests and 77 web tests pass, including tests from previous tickets.

---

## Verdict

**PASS** — Implementation satisfies all acceptance criteria. No blocking issues found.
