I now have a complete picture. Let me write the final review.

---

# PR Review — T022: Unified Series Season and Episode Availability (Attempt 2)

## Context

This is a second review following `IMPLEMENTATION_FIX_REQUIRED`. The previous review flagged two medium issues and one minor issue. All three were addressed in commit `a5c268a`.

---

## Fix verification

### [MEDIUM] Double map redundancy — `catalog.ts`
**Fixed.** `epRawVariantMap` has been removed. Only `epVariantMap` remains; it feeds both `variants:` and `resolveVariant()` at lines 333–344. The code is now clean and readable.

### [MEDIUM] Hardcoded `DEFAULT_PROFILE_ID` — `SeriesDetailPage.tsx`
**Fixed.** The constant is gone. A `useEffect` at mount calls `getProfile()`, stores the id in state, and silently ignores failures (leaving `profileId` undefined, so `watchState` will be null). The catch is appropriate and the comment explains the non-obvious fallback.

### [MINOR] No test for invalid `profileId` → 400
**Fixed.** Test added at `catalog.test.ts:515`, injecting `profileId=not-a-uuid` and asserting `statusCode === 400`. The backend validation at lines 255–257 is now covered.

---

## Full implementation review

### Acceptance criteria

| AC | Status |
|---|---|
| One canonical Series page shows known Seasons and Episodes | ✅ `SeriesDetailResponse.seasons` + per-season episode endpoint |
| Season shows `X/Y episodes available` | ✅ `SeasonSummary.availableEpisodeCount` populated via 6th parallel query; displayed as "X / Y disponible(s)" in `SeasonAccordion` |
| Episode shows multi-source availability without duplication | ✅ `variants[]` grouped by `episodeId`, one row per episode |
| Missing availability visibly distinct | ✅ `opacity-50` + `Badge variant="unavailable"` for `UNAVAILABLE` episodes |
| Watched/in-progress state reflected | ✅ `computeWatchState` with correct thresholds (< 5% = unwatched, ≥ 90% = watched) |
| Partial source coverage (Plex S1-S3 + IPTV S1-S5) | ✅ Per-season `availEpCountMap` using `count(distinct episodeId)` grouped by `seasonNumber` |
| Language/quality variants do not duplicate rows | ✅ Verified by multi-variant test at line 486 |
| Tests: full, partial, multi-source, unavailable | ✅ 6 API test cases + 13 component tests |

### Code quality

- `computeWatchState` (lines 58–68): clean pure function, correct thresholds, handles `durationSeconds === 0` edge case.
- `SeasonAccordion`: lazy-load with cache per `seasonNumber`, proper accordion toggle, passes `profileId` down correctly.
- `EpisodeRow`: minimal, no logic beyond render; `aria-label` on watch state indicators is correct for accessibility.
- Backend availability count query uses `count()` with `eq(status, 'AVAILABLE')` filter — correctly counts only available variants.
- `UUID_RE` validation on `profileId` before DB access: correct security boundary.

### Scope

No scope drift detected. The resolver, viewingProgress write path, player, and multi-profile UI are untouched. The docs changes (`domain-model.md`, `overview.md`) are relevant domain documentation, not scope creep.

### Security

No secrets exposed. External input (`profileId`) is validated against `UUID_RE` before use. No destructive operations.

---

## No blocking issues remain.

IMPLEMENTATION_APPROVED
