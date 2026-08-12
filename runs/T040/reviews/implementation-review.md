I have everything I need. Let me write the structured review.

---

# PR Review — T040: Profile Taste Model

## Résumé

Implementation of a deterministic, explainable per-profile taste model derived from explicit feedback, viewing progress, and watchlist signals. Stored in a new `profile_taste` table and exposed via `GET /taste` / `POST /taste/rebuild`. 12 files touched, all scoped to the ticket. 437 tests reported passing.

---

## Vérifications effectuées

- Schema: `profile-taste.ts`, `migrations/0017_profile_taste.sql`, `_journal.json`
- Service: `profile-taste-service.ts` — signal weights, accumulation logic, episode resolution, upsert
- Contracts: `packages/api-contracts/src/taste.ts`
- Routes: `routes/taste.ts`, registration in `index.ts`
- Tests: `__tests__/profile-taste-service.test.ts` (16 tests), `__tests__/taste.test.ts` (6 tests)
- Dependencies: `explicit-feedback.ts`, `viewing-progress.ts`, `watchlist.ts`, `episodes.ts`, `genres.ts`, `movies.ts`, `series.ts`

---

## Points validés

**Schema**
- `profile_taste` table is correctly structured: `profileId` as UUID PK with `ON DELETE CASCADE` referencing `profiles.id`, JSONB for genre scores and meta, `text[]` for media ID lists, `integer` for signal count, `timestamptz` for `builtAt`.
- Migration 0017 is syntactically correct and follows the established chain (idx 17, valid format). Manual writing noted (broken pnpm symlinks in worktree) — the SQL is equivalent to what `drizzle-kit generate` would produce.
- Journal entry correctly inserted at idx 17.
- Schema exported from `apps/api/src/db/schema/index.ts`. Contract exported from `packages/api-contracts/src/index.ts`.

**Signal weights**
- All six weights exactly match the plan: `LIKE +3`, `DISLIKE -3`, `NOT_INTERESTED -2`, `COMPLETED_VIEW +1`, `IN_PROGRESS_VIEW +0.5`, `WATCHLIST +0.5`.
- `SIGNAL_WEIGHTS` exported as `const` — correctly immutable and testable.

**Accumulation logic**
- Explicit feedback loop: weight from `SIGNAL_WEIGHTS[fb.feedback]`, genres loaded per media item, `LIKE → positiveSet`, `DISLIKE/NOT_INTERESTED → negativeSet`.
- Progress loop: `durationSeconds ≤ 0` guard, `< 5%` skip, `≥ 90%` → completed, `5%–90%` → in-progress. Correct ratio arithmetic.
- Episode progress: `episodes.seriesId` join to resolve parent, fallback `continue` if episode row missing.
- Watchlist loop: `+0.5` per entry, no positive/negative tagging (correct — watchlist signals intent, not completion).
- All loops: `signalCount++` placed **after** `continue` guards — skipped rows don't inflate the count.

**Cold-start**
- Empty signal arrays → `signalCount: 0`, `genreScores: []`, `positiveMediaIds: []`, `negativeMediaIds: []` — valid upsert with empty state, no throw.

**Determinism**
- `genreScores` sorted descending by score then ascending by `genreId` as tiebreaker (stable, reproducible).
- `positiveMediaIds` / `negativeMediaIds` both `[...set].sort()` — alphabetical order, reproducible.
- No random elements.

**`getTaste` / `buildTaste` contract**
- `getTaste` returns cached row when present, calls `buildTaste` otherwise.
- `buildTaste` always rebuilds from source and upserts — idempotent for same inputs.

**Route registration**
- `tasteRoutes` registered in `index.ts` at the correct position (after `feedbackRoutes`, consistent ordering).
- Routes use `DEFAULT_PROFILE_ID` from `profile-service.ts`, consistent with other routes.
- No extra middleware, no auth divergence from existing pattern.

**Test coverage — service (16 tests)**
- SIGNAL_WEIGHTS values ✓
- Cold-start ✓
- LIKE → positive genre score + positiveMediaIds ✓
- DISLIKE → negative genre score + negativeMediaIds ✓
- NOT_INTERESTED → negative score + negativeMediaIds ✓
- Mixed LIKE+DISLIKE on same genre → net 0 → genre omitted ✓
- Completed view (+1) < LIKE (+3) ✓
- In-progress (50%) < completed (90%) ✓
- View < 5% → completely ignored, signalCount stays 0 ✓
- Episode progress → parent series genres ✓
- Episode not found → skip gracefully ✓
- Watchlist weight accumulated ✓
- Idempotency: two builds on identical inputs → equivalent output ✓
- Genre sort order (multi-genre) ✓
- `getTaste` returns stored row without calling insert ✓
- `getTaste` falls back to `buildTaste` when no row ✓

**Test coverage — routes (6 tests)**
- `GET /taste` → 200 + valid `ProfileTaste` shape ✓
- `GET /taste` → `genreScores` fields present ✓
- `GET /taste` cold-start → 200, not 4xx/5xx ✓
- `POST /taste/rebuild` → 200 + `buildTaste` called once ✓
- `POST /taste/rebuild` cold-start → 200 ✓
- `POST /taste/rebuild` does not call `getTaste` ✓

**Scope compliance**
- No LLM dependency, no recommendation ranking, no UI changes, no multi-profile path params, no write-trigger invalidation — all correctly excluded as per plan.

---

## Problèmes détectés

**Aucun problème bloquant.**

**Observation 1 — N+1 query pattern in genre loading (non-bloquant)**
The `for` loops in `buildTaste` call `loadGenres` sequentially per signal row. With many signals, this issues O(N) individual SQL queries. For a personal IPTV server the scale is negligible, and the plan explicitly says "deterministic and explainable first". Acceptable for this ticket; worth noting for a future optimization pass.

**Observation 2 — `builtAt` captures build-start time (non-bloquant)**
`const now = new Date()` is set at the top of `buildTaste`, before the potentially multi-query loop. The stored `builtAt` reflects when the build was _initiated_, not when the upsert completed. This is a minor inaccuracy — no functional impact for this use case.

**Observation 3 — JSONB type assertions (non-bloquant)**
`row.genreScores as Record<string, number>` and `row.genreMeta as Record<string, { slug: string; name: string }>` are unsafe casts from Drizzle's `unknown` JSONB type. Since the only writer is `buildTaste` itself, the cast is safe in practice. No runtime risk.

**Observation 4 — `setupBuildTaste` helper wraps genres one-per-row (non-bloquant)**
`feedbackGenres.map((g) => [g])` produces single-element arrays, meaning the helper doesn't support configuring multi-genre responses. Tests that need multi-genre items (genre sort order test) correctly bypass the helper and set up mocks directly. No test correctness issue.

---

## Risques éventuels

- The `media_id` FK stored in `positiveMediaIds` / `negativeMediaIds` (`text[]`) could contain a mix of movie UUIDs and series UUIDs without type discrimination. This is documented implicitly by the accumulation logic and is acceptable for the current use case. Consumers must be aware if they need to resolve the ID.
- The `profile_taste` table has no index beyond the PK (`profile_id`). Since all reads are by PK, this is fine.
- Manual migration: if the worktree pnpm symlinks issue persists across tickets, a CI step that regenerates and validates the snapshot chain could be useful.

---

## Décision

Implementation is complete, correct, and well-tested. All acceptance criteria are met:

1. ✅ Taste profile generated from existing interaction data
2. ✅ LIKE/DISLIKE materially affect derived taste in expected direction
3. ✅ Watchlist/incomplete views produce lower scores than LIKE
4. ✅ Rebuilding from unchanged inputs produces equivalent output
5. ✅ Cold-start returns valid empty taste, no error
6. ✅ Taste references canonical genre concepts, not provider-specific items
7. ✅ Tests cover all required scenarios

IMPLEMENTATION_APPROVED
