---

## Test Report — T107

**Verdict: FAIL** — 1 blocking issue

### Results by acceptance criterion

| AC | Status | Notes |
|----|--------|-------|
| Opaque cursor pagination | **PASS** | HMAC-SHA256 signed, versioned (v=1), TTL 48h, timing-safe verify — 7 cursor unit tests pass |
| Infinite vertical scrolling | **PASS** | `IntersectionObserver` (400px rootMargin), `isFetchingMoreRef` prevents concurrent requests, shelves appended not reset |
| Shelf item count 24/max 30 | **PASS** | `HOME_ITEMS_PER_SHELF=24`, hard `.slice(0, HOME_ITEMS_PER_SHELF)` in pool service, env-configurable |
| No up-front catalog load | **PASS** | 6 shelves/batch (`HOME_BATCH_SIZE`), pool pre-computed, lazy media enrichment via batched `inArray` queries |
| Cross-shelf media dedup | **PASS** | `excludedMediaIds` Set loaded from all session items at fill time, updated per shelf — fixed shelves also registered |
| Concept fatigue/dedup | **PASS** | `usedConceptIds` prevents concept reuse in session; `ShelfFatigueService` cooldown filters applied |
| Fixed + generated coexist | **PASS** | Continue Watching/My List prepended (`[...fixed, ...generatedShelves]`), ordering validated in tests |
| Pool-based serving | **PASS** | Cursor requests only call `serveBatch()` — no LLM call; async `fillPool` is fire-and-forget |
| Profile isolation | **PASS** | Client resets all state on `profileId`/`profileVersion` change; API enforces `session.profileId !== profileId` → 403 |
| **Visibility integrates #209** | **FAIL** | See blocking issue below |
| Rec-engine outage fallback | **PASS** | `buildFallbackShelf()` returns popular movies from local DB; tested |
| Long scroll responsiveness | CANNOT VERIFY | No live environment; architecture is sound |

### Blocking Issue — AC-10: Frontend visibility tracking not wired

`ShelfInstanceService.markFirstDisplayed`, `markItemVisible`, `markItemOpened`, `markItemPlayed` are fully implemented server-side, and `shelfInstanceId` is present in the API response. However:

- **No API route** exposes these tracking calls for the client to hit
- **`ShelfRow.tsx`** renders shelves without any IntersectionObserver or tracking call — shelves are never reported as "reached" or "displayed"
- `HomePage.tsx` only emits `HOME_OPENED` — insufficient

The ticket completion rule explicitly requires "attribution/history capture" validated across 30 shelves. Without frontend tracking, the #209 feedback loop is broken.

**Fix needed**: Add an API endpoint (or reuse the interaction events endpoint) and wire `markFirstDisplayed` when a shelf enters the viewport in `ShelfRow`.

### Regressions

19 pre-existing test failures — **none introduced by T107**. Confirmed: all failing test files are absent from `git diff origin/main..HEAD --name-only`.

### T107-specific tests

All 19 pass: 7 cursor unit tests + 12 home-service unit tests.
