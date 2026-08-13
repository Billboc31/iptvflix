---

## Test Report — T070

**Verdict: FAIL — 2 blocking test regressions require fixes.**

All 7 acceptance criteria are satisfied by the implementation. The backend and frontend logic are correct. However, **2 web unit tests regress** because their expectations were written with shelf labels that don't match what was actually implemented.

---

### Acceptance Criteria Results

| # | Criterion | Status |
|---|-----------|--------|
| AC1 | Movies/Series pages rich without providers | **PASS** |
| AC2 | Multiple auto shelves from canonical metadata | **PASS** |
| AC3 | Upcoming/unavailable titles discoverable + addable to My List | **PASS** |
| AC4 | Available titles have playable variants, no duplicate cards | **PASS** |
| AC5 | Availability filter/discovery toggle | **PASS** |
| AC6 | Hero/cards use canonical titles and artwork | **PASS** |
| AC7 | Shelf APIs performant (indexes, batch loading) | **PASS** |

---

### Blocking Issues Found

**Test failures in `apps/web` (2 failed / 199 total):**

**1. `MoviesPage.test.tsx:41`** — "renders Disponibles and Tous les films shelf rows by default"  
- Expects `'Disponibles'` visible in default 'all' mode → but `MoviesPage.tsx` only shows "Disponibles" in "available" mode  
- Expects shelf heading `'Tous les films'` → doesn't exist (actual shelves: "Populaires", "Les mieux notés", etc.)

**2. `SeriesPage.test.tsx:49`** — "renders Disponibles and Toutes les séries shelf rows by default"  
- Same mismatch: "Disponibles" only shows in "available" mode, "Toutes les séries" never appears

**Required fixes:**

```ts
// MoviesPage.test.tsx:42-43 — replace with:
expect(screen.getByText('Populaires')).toBeInTheDocument()
expect(screen.getByText('Les mieux notés')).toBeInTheDocument()

// SeriesPage.test.tsx:52-53 — replace with:
expect(screen.getByText('Populaires')).toBeInTheDocument()
expect(screen.getByText('Les mieux notées')).toBeInTheDocument()
```

---

### Non-blocking

- **`apps/web/src/test/handlers.ts`** — 6 TypeScript errors (test fixtures missing new fields added by prior tickets T065/T067/T069). Runtime unaffected.
- **API test fixtures** — 2 pre-existing TypeScript errors in unrelated tests.
- **`vertical-slice.test.ts` + `scheduler-service.test.ts`** — 4+1 pre-existing environment failures (no DATABASE_URL, timing race); not T070-introduced.
