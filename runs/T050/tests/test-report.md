---

## Test Report — T050

**Verdict: REJECTED** — 2 blocking issues prevent acceptance.

---

### Acceptance Criteria Results

| # | Criterion | Status |
|---|---|---|
| AC1 | Clicking Play on a Movie resolves profile-preferred variant | ✅ PASS |
| AC2 | Episode launched from Series/Episode experience | ✅ PASS |
| AC3 | User can choose another variant when alternatives exist | ✅ PASS |
| AC4 | Disabled/stale/unavailable variants rejected server-side | ✅ PASS |
| AC5 | Provider secrets absent from catalog/detail responses and logs | ✅ PASS |
| AC6 | Progress updates Continue Watching; resume from stored position | ✅ PASS |
| AC7 | Resolution failures produce usable UI error, no internals exposed | ✅ PASS |
| AC8 | Tests cover preferred selection, explicit variant, invalid/stale, progress, redaction | ⚠️ PARTIAL (service-level tests ✅; no route-level or UI tests) |

---

### Bugs Found

**BUG-1 — BLOCKING: 7 failing web tests in `EpisodeRow.test.tsx`**

`EpisodeRow` now calls `useNavigate()` for the new Play button, but the test file never wraps renders in a `MemoryRouter`. All 7 tests crash with `useNavigate() may be used only in the context of a <Router>`. Fix: wrap renders in `<MemoryRouter>` (same pattern used in `MovieDetailPage.test.tsx`).

**BUG-2 — NEAR-BLOCKING: TypeScript type error in `playback-resolver.test.ts:75`**

`EMPTY_PREFS` is missing `autoplayPreviews: boolean` required by `ProfilePreferences`. `tsc --noEmit` fails. Vitest passes at runtime. Fix: add `autoplayPreviews: false` to `EMPTY_PREFS`.

---

### Test Execution

- API vitest: **623/623 pass** ✅  
- Web vitest: **122/129 — 7 fail** ❌ (all in `EpisodeRow.test.tsx`)

Both fixes are one-liners. Report saved to `runs/T050/tests/test-report.md`.
