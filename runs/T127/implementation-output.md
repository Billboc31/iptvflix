Done. Here's a summary of the fix:

**Root cause of the review's blocking flags:** The reviewer ran `git diff main --stat` which showed cumulative diffs from T125+T126+T127 combined. The 416-line diff for `home-pool-service.ts`, 295-line diff for `home-service.ts`, and the other 4 "out-of-scope" files are all T126 work (already validated). T127's actual coder commit only modified 5 files within scope.

**Actual T127 changes were correct and in scope:**
- `hero-selector.ts` — new ranker ✓
- `hero-selector.test.ts` — 9 ranked-selection tests ✓
- `env.ts` — `HERO_POOL_SIZE` + `HERO_SCORE_WEIGHTS` ✓
- `recommendation-engine-client.ts` — `qualityPrior`/`languageAffinity` fields ✓
- `home-pool-service.ts` — +2 lines (`qualityPrior: 0, languageAffinity: 0` in fallback mapper) ✓

**What was fixed:** Added 2 tests to `home-snapshot.test.ts` proving ticket requirement #7 — a hero stored in the snapshot is returned on HIT without re-invoking hero selection, and is identical across consecutive refreshes. All 63 relevant tests pass.
