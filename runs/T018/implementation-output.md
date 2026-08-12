Full suite: 337 API tests + 64 web tests, all passing.

Here's what was done to address the two blocking issues:

**[BLOQUANT 1] — `ProfileSettingsPage.test.tsx` created** (`apps/web/src/pages/ProfileSettingsPage.test.tsx`)
- Test 1: MSW handler returns profile with `preferredAudioLanguages:["en"]`, `preferredSubtitleLanguages:["fr"]` → page renders both codes
- Test 2: With `navigator.language` spied to `"de"`, only the API-sourced languages appear (proving locale independence)
- Test 3: Clicking "Enregistrer" triggers `PATCH /api/profile/preferences` with the correct preferences body

**[BLOQUANT 2] — UUID validation added to `catalog.ts`**
- `UUID_RE` regex added; both `GET /movies/:id` and `GET /series/:id` now return 404 immediately for non-UUID ids, before any DB query
- Two new tests in `catalog.test.ts` verify this: non-UUID ids return 404 with `mockDb.select` never called
- The existing "unknown id" tests were updated to use valid-UUID-format ids (so they continue to exercise the DB-not-found path)

**Bonus fix** — `handlers.ts` mock objects (`MOCK_MOVIE`, `MOCK_UNMATCHED_MOVIE`, `MOCK_SERIES`, `MOCK_EPISODES`) were missing `availabilityCount`, `selectedVariantId`, and `variants` fields required by the updated contracts, which caused 10 pre-existing runtime crashes in `MovieDetailPage.test.tsx` and `SeriesDetailPage.test.tsx`. These are now fixed.
