TypeScript compiles clean. Here is the full test report.

---

## Test Report — T003: Define canonical media catalog domain

### Commands executed

```
cd apps/api && DATABASE_URL=postgres://iptvflix:iptvflix@localhost:5432/iptvflix pnpm test --reporter=verbose
npx tsc --noEmit
grep -r "xtream|m3u|XtreamDto|XtreamItem" apps/api/src --include="*.ts" -l
```

### Results

```
Test Files  3 passed (3)
     Tests  9 passed (9)
```

All suites green. TypeScript compiles with zero errors.

---

### Acceptance criteria

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | Movies, series, seasons, and episodes have clear canonical representations | **PASS** | Four tables with UUID PKs, proper hierarchical FKs (series → seasons → episodes). Genre tables with junction tables. |
| 2 | Provider-specific identifiers through source availability, not canonical primary identity | **PASS** | Canonical PKs are random UUIDs. `providerId`/`providerItemId` live only in the availability tables. |
| 3 | `firstSeenAt` and `lastSeenAt` persisted; first-seen not overwritten on re-sync | **PASS** | Both columns are independent NOT NULL fields. Test "preserves first_seen_at when only last_seen_at is updated" passes. No DB trigger forces `firstSeenAt` to update — the application controls it, which is the correct layer. |
| 4 | One canonical item can be available from multiple sources | **PASS** | Unique constraint is `(movieId, providerId, providerItemId)` — not `(movieId, providerId)` — so same movie can have rows for different providers. Test "allows one movie to have availabilities on multiple sources" passes. |
| 5 | Database constraints prevent invalid/duplicate source mappings | **PASS** | `movie_availabilities` and `episode_availabilities` both have the 3-column unique constraint. `seasons` has `(series_id, season_number)` unique; `episodes` has `(season_id, episode_number)` unique. FK cascades on all relationships. |
| 6 | Schema/migrations and representative domain tests included | **PASS** | Migration `0001_sweet_stingray.sql` covers all new tables. `catalog-constraints.test.ts` has 5 meaningful integration tests against a real database. |
| 7 | No Xtream- or M3U-specific DTO becomes the core catalog model | **PASS** | Grep finds zero Xtream/M3U references in schema files. String `'xtream:server1'` appears only as test data for `providerId` values — not as schema structure. |

### Observations (non-blocking)

**Episodes carry a redundant `seriesId` FK.** `episodes.seriesId` → `series` is redundant since the chain `episodes.seasonId → seasons.seriesId` already establishes the relationship. There is no DB constraint ensuring `episode.seriesId` matches `episode.season.seriesId`, which could allow inconsistent data to be inserted. This is a minor denormalization; it does not block the ticket but is worth addressing before the episode-query layer is built.

**No series- or season-level availability tables.** Only `movieAvailabilities` and `episodeAvailabilities` exist. For IPTV sources that expose series/season items directly (not just episodes), there is no mapping table. This is not required by the ticket spec, but future providers may need it.

### Verdict

**PASS** — all 7 acceptance criteria are satisfied. The one non-blocking observation (redundant `seriesId` on episodes) is worth a follow-up but does not invalidate the implementation.
