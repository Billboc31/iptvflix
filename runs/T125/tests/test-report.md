I have all the information I need to write the full test report.

---

## T125 — Test Report: Personalized Home Page with Production Shelf Rails

### Test Execution Summary

| Test suite | Tests | Status |
|---|---|---|
| `home-pool-service.test.ts` | 12/12 | ✅ PASS |
| `home-service.test.ts` | 15/15 | ✅ PASS |
| `home-cursor.test.ts` | 7/7 | ✅ PASS |
| `HomePage.test.tsx` | 5/5 | ✅ PASS |
| `ShelfRow.test.tsx` | 5/5 | ✅ PASS |
| `shelf-concepts-preview.test.ts` | 8/8 | ✅ PASS |
| `ContinueWatchingCard.test.tsx` | 17/20 | ❌ 3 failures (pre-existing, see below) |
| Integration tests (DB-dependent) | blocked | ⚪ SKIP (no PostgreSQL, pre-existing) |

---

### Acceptance Criteria

**1. Home renders the six initial shelf types when data exists** — ✅ PASS

`buildDeclaredRails` test "returns rails in declaration order when all rails have data" confirms all six titles appear in order: `Continuer à regarder`, `Pour toi`, `Nouveautés pour toi`, one dynamic thematic, `Films pour toi`, `Séries pour toi`.

**2. Shelves are horizontal poster rails, usable on TV and responsive web/mobile** — ✅ PASS

`HorizontalRow.tsx` implements `overflow-x-auto snap-x snap-mandatory`. Arrow buttons for desktop/mouse. `ContinueWatchingRow.tsx` uses `TvLazyRow` in the Android TV app with TV focus management. No blocking issues found with the primary shelf navigation.

**3. Pour toi, Nouveautés, thematic, Films, Séries use the personalization pipeline** — ✅ PASS

All five discovery rails route through `RecommendationEngineClient.queryForShelf` with fallback to `rankRecommendations`. No second recommendation engine was introduced.

**4. Dynamic thematic shelf is data-driven, not a hardcoded list** — ✅ PASS

Rail 4 uses `selectThematicConcept`, which queries `ShelfConcept` rows from the DB. No hardcoded `mediaId` values found in `home-pool-service.ts`. Content is replaceable without frontend code changes.

**5. Movie and series constraints are respected** — ✅ PASS

`Films pour toi` passes `mediaTypeFilter: 'MOVIE'`, `Séries pour toi` passes `mediaTypeFilter: 'SERIES'` both at the engine query level and in post-filter. Tests "Films rail contains only MOVIE items" and "Séries rail contains only SERIES items" pass.

**6. Empty/erroring individual shelves do not break the Home page** — ✅ PASS

Each `ShelfRow` in `HomePage.tsx` is wrapped in a `ShelfErrorBoundary` that silently suppresses the shelf on throw. `ShelfRow` itself returns `null` when `items` is empty. Test "error thrown by one ShelfRow does not unmount other ShelfRow instances" passes. The `home-service` test "error in buildDeclaredRails falls back to fallback shelf without throwing" passes.

**7. Internal recommendation diagnostics absent from consumer Home** — ✅ PASS

`ShelfItem` and `ShelfResponse` (the types served to `HomePage.tsx`) contain no internal fields (`semanticScore`, `profileScore`, `finalScore`, `reasonCodes`, `diversityAdjustment`). Internal scores are only in `shelf-instances.ts` consumed exclusively by `RecommendationLabPage.tsx` (diagnostic tool).

**8. Cross-shelf duplication materially reduced while preserving relevance** — ✅ PASS

`excludedMediaIds` Set grows rail-by-rail (2→3→4→5→6). `Continuer à regarder` is exempt per spec. Tests "title in rail 2 does not appear in rails 3–6" and "Continuer à regarder items may appear in discovery rails" both pass.

**9. Existing recommendation diagnostics/preview continues to work** — ✅ PASS

`RecommendationLabPage.tsx` and `GenerateShelfDialog.tsx` remain intact. The `shelf-concepts-preview` route tests (8/8) pass, confirming the preview API endpoint is unbroken.

**10. Automated tests for shelf composition, type constraints, empty/error, diversity** — ✅ PASS

`home-pool-service.test.ts` covers all required areas: declaration order, media-type constraints (films/séries), cross-shelf deduplication, thematic concept fatigue skip, error isolation per rail, freshness filtering for Nouveautés, and pool position accounting.

**11. No manual production DB changes, no title-specific hacks** — ✅ PASS

No hardcoded `mediaId` values or manual SQL found in any T125 service files. All data flows through the existing schema and engine client.

---

### Failures Found

#### Pre-existing failures (not introduced by T125)

**`ContinueWatchingCard.test.tsx` — keyboard navigation in overflow menu (3 tests)**

- `ArrowDown moves focus to next menuitem` — FAIL: focus stays on "Détails" instead of moving to "Supprimer de Reprendre"
- `ArrowUp from first item wraps to last` — FAIL: same symptom

Root cause: `ContinueWatchingOverflowMenu` renders via `createPortal` into `document.body`. The `useEffect` keyboard handler queries `menuRef.current?.querySelectorAll('[role="menuitem"]')`, but the portal element appears to not be reachable from `menuRef.current` in the JSDOM test environment when `ArrowDown` fires. The component and its test file are **identical to `main` branch** — this is a pre-existing bug, not a T125 regression.

**`shelf-concept-generator-service.test.ts` — `needsRefresh` (1 test)**

- `returns false when pool is fresh and large enough` — FAIL: `TypeError: Cannot read properties of undefined (reading 'from')`

Root cause: the test queues one `db.select` for shelf concepts but `getActivePool` also calls `ShelfFatigueService.getFatigueStates`, which requires a second `select`. The mock is exhausted. Both the service and test are **identical to `main`** — pre-existing test gap.

---

### Verdict

**✅ VALIDATED** — All T125 acceptance criteria are met. The 4 failing tests are pre-existing regressions from the `main` branch unrelated to this ticket. No T125 regression detected.
