---

## Test Report — T022

**Verdict: PASS** — All 8 acceptance criteria satisfied, no regressions.

### Results by criterion

| AC | Description | Status |
|---|---|---|
| AC1 | Canonical Series page — no duplicate provider structures | **PASS** |
| AC2 | Season shows `X/Y episodes available` | **PASS** |
| AC3 | Episode with multi-source availability appears once | **PASS** |
| AC4 | UNAVAILABLE episodes visually distinct | **PASS** |
| AC5 | Watch state (watched/in_progress/unwatched) reflected | **PASS** |
| AC6 | Partial source coverage represented correctly | **PASS** |
| AC7 | Language/quality variants don't duplicate episode rows | **PASS** |
| AC8 | Automated tests cover all cases | **PASS** |

### Test runs

- **API (343 tests):** all pass — including new catalog tests for `availableEpisodeCount` aggregation, `watchState` with/without `profileId`, multi-source variants, UNAVAILABLE episodes, invalid `profileId` → 400.
- **Web (77 tests):** all pass — including new `SeasonAccordion` tests (fraction display, 0/N, plural/singular) and `EpisodeRow` tests (watched/in_progress/null/unwatched states, UNAVAILABLE styling).

### TypeScript

- `api-contracts` and `web`: no errors.
- `api`: pre-existing errors in `vertical-slice.test.ts`, `sources.test.ts`, `catalog-sync-service.test.ts` — all in files **not touched by T022**, carried forward from earlier tickets.

Report saved to `runs/T022/tests/tester-report.md`.
