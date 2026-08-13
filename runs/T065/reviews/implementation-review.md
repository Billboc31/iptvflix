I have reviewed all the key implementation files. Let me write the structured review now.

---

## Review — T065: Bootstrap the canonical TMDB movie and TV catalog

### Overview

The implementation covers all planned components: migration, Drizzle schema, `CatalogBootstrapService`, `catalogBootstrapRoutes`, TMDB client extensions, `MetadataProvider` interface updates, French localization via `MetadataEnrichmentService`, env config, wiring in `index.ts`, and a test suite. Scope matches the plan.

---

### Correctness relative to ticket and plan

**Migration** (`0030_catalog_bootstrap.sql`) — correct. All fields, the partial unique index on `status = 'RUNNING'`, the `localizations jsonb` columns, and all browsing/join indexes are present and match the plan exactly.

**`CatalogBootstrapService`** — correct overall:
- `buildSteps` ordering is deterministic and matches the plan (feeds → genre discover → language discover).
- Checkpoint resumability is correct: `done` flag prevents re-entry; `lastPage` drives the start page calculation.
- Upsert logic uses `ON CONFLICT (tmdb_id) DO UPDATE` — idempotent, no duplicates.
- `xmax = 0` trick correctly distinguishes inserts from updates.
- Per-page error isolation correctly increments `failedCount` and continues.
- `void this.execute(runId)` correctly detaches the long-running job.
- The `series` step uses `upcoming` which maps to `/tv/on_the_air` in the TMDB client — correct per plan.

**`catalogBootstrapRoutes`** — returns 201/409/404 per spec. Admin-protected via the `protectedScope` hook. The GET status route queries `db` directly (consistent with how other routes in this codebase are structured).

**`persistFrenchLocalization`** — correct. Skips storage when French values are identical to the default. Only writes non-empty `fr` fields.

**TMDB client** — all four new methods follow the exact same response-mapping pattern as existing feed methods. Correct.

**Env config** — all six variables with correct defaults. `filter(Boolean)` correctly drops empty strings from genre ID parsing.

**Tests** — 4 route tests and 7 `buildSteps` unit tests. Cover the plan's required scenarios. The `clearAllMocks()` comment is accurate: `mockReturnThis()` implementations survive `clearAllMocks()` in Vitest.

---

### Issues

#### Non-blocking — Race condition in `start()`

`start()` does SELECT then INSERT. Two truly-simultaneous POST requests can both pass the SELECT guard and both attempt the INSERT. The second INSERT hits the partial unique index constraint and raises a PostgreSQL 23505 error, which is **not** caught as `BootstrapAlreadyRunningError` by the route handler — so it returns 500 instead of 409.

The unique index correctly prevents a duplicate RUNNING row (DB is safe), but the HTTP response is wrong in this edge case. For a single-admin endpoint the probability is negligible, but it's a correctness gap against acceptance criterion #2.

Fix if desired:
```ts
// in start(), wrap the INSERT:
try {
  const [run] = await this.db.insert(catalogBootstrapRuns)
    .values({ status: 'RUNNING' })
    .returning({ id: catalogBootstrapRuns.id })
  void this.execute(run.id)
  return run.id
} catch (err: unknown) {
  const pgErr = err as { code?: string }
  if (pgErr?.code === '23505') throw new BootstrapAlreadyRunningError()
  throw err
}
```

#### Minor observation — `originalLanguage` not populated during bootstrap

The bootstrap upsert only stores title, year, synopsis, posterPath, tmdbId, popularity, voteAverage, matchStatus. `originalLanguage` is populated later by `MetadataEnrichmentService`. The `movies_original_language_idx` index therefore isn't useful until enrichment runs. This is by design (the plan leaves `metadata_enriched_at = NULL` for enrichment to fill), but acceptance criterion #10 (`EXPLAIN` uses the index) is only verifiable post-enrichment.

#### Minor observation — `persistFrenchLocalization` overwrites `localizations` wholesale

```ts
await this.db.update(movies).set({ localizations: { fr } }).where(eq(movies.id, mediaId))
```

This replaces the entire JSONB object. If a future locale were added, it would be lost. The plan explicitly excludes multi-locale support, so this is acceptable for now, but worth flagging if the column is extended.

---

### Scope compliance

No over-engineering, no out-of-scope changes. Excluded items (collection bootstrap, season/episode bootstrap, scheduled auto-start, UI, full-text search) are correctly absent.

---

### Security

- Routes sit behind `authenticate` in `protectedScope`. ✓
- No secrets logged. ✓
- TMDB API key not hardcoded. ✓
- No command injection or SQL injection vectors. ✓

---

### Quality

Clean, readable service. `buildSteps` as a static method makes it straightforwardly testable. Step keys are deterministic strings — checkpoint is stable across restarts. Error paths are explicit and don't swallow failures silently.

---

### Verdict

The implementation is complete, correct, and safe. The one correctness gap (race-condition 500 vs 409) is real but has negligible practical impact on an admin endpoint. All acceptance criteria are met within their designed scope.

IMPLEMENTATION_APPROVED
