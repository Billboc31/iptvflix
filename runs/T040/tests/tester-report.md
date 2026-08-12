# Tester Report — T040: Build a durable profile taste model

**Date**: 2026-08-12  
**Branch**: ticket/T040-build-a-durable-profile-taste-model-from-viewing-a

---

## Test execution summary

```
Test Files  1 failed | 30 passed (31)
     Tests  1 failed | 436 passed (437)
  Duration  2.14s
```

The single failing test (`title-matching-service.test.ts > UNMATCHED row is upgraded to MATCHED on retry`) is a pre-existing database constraint race condition on "The Matrix" (tmdb_id=603) — **unrelated to T040**.

All 18 taste-specific tests pass (6 route tests + 12 service tests).

---

## Acceptance criteria

### AC1 — A taste profile can be generated from existing profile interaction data
**PASS**

`buildTaste(profileId)` loads `explicitFeedback`, `viewingProgress`, and `watchlist` rows in parallel and produces a `ProfileTaste` object with `genreScores`, `positiveMediaIds`, `negativeMediaIds`, `signalCount`, and `builtAt`.

Verified by:
- `positive-only (LIKE) > produces positive genre score and populates positiveMediaIds` ✓
- `GET /taste > returns 200 with a valid ProfileTaste shape` ✓
- `POST /taste/rebuild > calls buildTaste and returns 200 with ProfileTaste` ✓

---

### AC2 — Explicit likes/dislikes materially affect derived taste in the expected direction
**PASS**

Weights are:
| Signal | Weight |
|---|---|
| LIKE | +3 |
| DISLIKE | −3 |
| NOT_INTERESTED | −2 |

Verified by:
- `positive-only (LIKE) > score = 3, mediaId in positiveMediaIds` ✓
- `negative-only (DISLIKE) > score = −3, mediaId in negativeMediaIds` ✓
- `negative-only (NOT_INTERESTED) > score = −2, mediaId in negativeMediaIds` ✓

---

### AC3 — Weak signals do not automatically imply the same strength as a Like
**PASS**

| Signal | Weight |
|---|---|
| COMPLETED_VIEW (≥90%) | +1 |
| IN_PROGRESS_VIEW (5–90%) | +0.5 |
| WATCHLIST | +0.5 |
| View <5% progress | ignored |

Verified by:
- `completed view (+1) produces lower score than a LIKE (+3)` ✓
- `in-progress view (50%) produces a lower score than completed view (90%)` ✓
- `view at <5% progress is ignored entirely` ✓
- `watchlist signal > accumulates watchlist weight (0.5) on genre` ✓

---

### AC4 — Rebuilding from unchanged inputs produces equivalent taste output
**PASS**

`buildTaste` is deterministic: the same signals produce identical `genreScores`, `positiveMediaIds`, `negativeMediaIds`, and `signalCount`. Genre sort order is stable (descending score, then ascending `genreId` as tiebreaker).

Verified by:
- `idempotency > repeated buildTaste calls with same inputs produce equivalent output` ✓
- `genre sort order > sorts genreScores descending by score, then ascending by genreId as tiebreaker` ✓

---

### AC5 — Cold-start profiles return a valid empty/minimal taste state rather than failing
**PASS**

When no signals exist, `buildTaste` returns a `ProfileTaste` with empty arrays and `signalCount = 0`. HTTP responses return 200, not 404 or 500.

Verified by:
- `cold-start (no signals) > returns valid empty taste without throwing` ✓
- `GET /taste > returns 200 for cold-start (empty taste, not 404 or 500)` ✓
- `POST /taste/rebuild > returns 200 for cold-start rebuild (no signals)` ✓

---

### AC6 — Taste state references canonical/external metadata concepts rather than source-specific items
**PASS**

Genre scores reference canonical `genres.id`, `genres.slug`, and `genres.name` from the canonical schema — not provider-specific genre strings. Episodes resolve to their parent series before genre lookup. The `GenreScore` type in `@iptvflix/api-contracts` exposes only `genreId`, `slug`, `name`, `score` — no internal provider DTOs.

Verified by:
- `episode progress → parent series > loads genres from parent series when episode is completed` ✓
- `episode progress → parent series > skips episode if episode row is not found` ✓
- Schema: `genre_scores` and `genre_meta` stored as JSONB with canonical genre IDs ✓

---

### AC7 — Tests cover positive, negative, mixed, sparse and repeated rebuild scenarios
**PASS**

| Scenario | Test |
|---|---|
| Positive (LIKE) | `positive-only (LIKE)` ✓ |
| Negative (DISLIKE) | `negative-only (DISLIKE)` ✓ |
| Negative (NOT_INTERESTED) | `negative-only (NOT_INTERESTED)` ✓ |
| Mixed (same genre, cancel to 0) | `mixed signals (same genre)` ✓ |
| Sparse (cold-start) | `cold-start (no signals)` ✓ |
| Sparse (episode not found) | `skips episode if episode row is not found` ✓ |
| Repeated rebuild | `idempotency > repeated buildTaste calls with same inputs` ✓ |
| Watchlist | `watchlist signal` ✓ |
| Weak signal gradation | `weak signals vs explicit LIKE` (3 cases) ✓ |
| Episode → series resolution | `episode progress → parent series` ✓ |
| Genre sort stability | `genre sort order` ✓ |

---

## Regressions

None detected. All 436 previously passing tests continue to pass. The one pre-existing failure in `title-matching-service.test.ts` is a database constraint race unrelated to T040 and is present on the main branch.

---

## Blocking issues

None.

---

## Verdict

**PASS** — All 7 acceptance criteria are satisfied. The implementation is correct, well-tested, and introduces no regressions.
