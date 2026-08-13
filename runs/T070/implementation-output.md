All 4 occurrences are fixed. The pattern now correctly places `DESC NULLS LAST` as a plain SQL expression rather than wrapping with `desc()` which would have appended a second ` DESC` keyword after `NULLS LAST`.

**Fix applied:** 4 occurrences in `apps/api/src/services/catalog-service.ts`
- Lines 91, 93: `movies.popularity` and `movies.voteAverage`
- Lines 293, 295: `series.popularity` and `series.voteAverage`

Changed from `desc(sql`${...} NULLS LAST`)` → `sql`${...} DESC NULLS LAST`` to match the correct PostgreSQL syntax already used for `recentAvailability`. The "Populaires" and "Les mieux notés" shelves will now sort correctly.
