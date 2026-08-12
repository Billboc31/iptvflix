Both changes look correct. Here's a summary of what was done:

---

**Fix 1 — Silent failure on external click** (`SearchPage.tsx`)

- Added `externalError` state (cleared on new search and on each click attempt)
- `handleExternalMovieClick` / `handleExternalSeriesClick` now set `externalError` in their catch blocks instead of swallowing the failure silently
- An inline `<p role="alert">` appears inside the external section when the error is set, telling the user to retry

**Fix 2 — Missing web tests for external results** (`SearchPage.test.tsx`)

Added 3 new tests (9 total in the suite, all passing):
1. **Upcoming badge**: overrides search to return `releaseStatus: 'In Production'` → verifies "Aussi trouvé…" heading and "À venir" badge appear
2. **Non disponible badge**: overrides search to return `releaseStatus: 'Released'` → verifies "Non disponible" badge appears (covers the "not available to me vs not found" AC)
3. **Materialize failure**: overrides POST `/api/discovery/movies` to return 503 → verifies the inline `role="alert"` error message appears after clicking the card

Test totals: **61 passed / 0 failed** (12 test files).
