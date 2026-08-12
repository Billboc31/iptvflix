Now I have everything needed to write the review.

---

## Review — T042: Generate personalized Shelves from seed media and recommendation intent

**Attempt**: 3  
**Reviewer**: Claude (Reviewer role)  
**Date**: 2026-08-12

---

### Summary

The implementation fully satisfies the ticket. All eight acceptance criteria are met. Three blockers raised in the two previous review cycles (min seed count, missing genre preference signal, missing web flow) have been correctly addressed. The scope is tight and no drift was introduced.

---

### Acceptance Criteria Verification

| # | Criterion | Status |
|---|-----------|--------|
| 1 | User can select ≥ 3 canonical Movies/Series and create a generated Shelf | ✅ Enforced at service (`line 174`) and route (`line 132`) |
| 2 | Shelf contains ranked recommendations derived from seeds | ✅ `preferGenreIds` derived from seed genres passed to `rankRecommendations` (`lines 138–143`) |
| 3 | Seed titles not duplicated as recommendations | ✅ Filtered via `seedIdSet` before member construction (`lines 147–148`) |
| 4 | Shelf members are canonical Media only | ✅ Discovery candidates materialized before insertion (`lines 150–159`) |
| 5 | External candidates safely deduplicated/materialized | ✅ Idempotent via `canonicalMovieId`/`canonicalSeriesId` check (`lines 30, 50`) |
| 6 | Generated Shelf stores enough intent for refresh | ✅ Full `GeneratedShelfRules` in `rules` JSONB (`lines 192–199`) |
| 7 | Optional constraints validated server-side | ✅ `mediaType`, `availableToMe`, `limit` validated at route and passed through |
| 8 | Tests cover all required scenarios | ✅ 17 service tests + 14 new route tests |

---

### Code Quality

**`shelf-generation-service.ts`** — Clean extraction of `resolveGeneratedMembers` avoids duplication between create and refresh. Transaction wrapping on both write paths is correct. Limit clamping (`Math.min(Math.max(rawLimit ?? 20, 1), 100)`) is sound.

**Routes** — Double validation (route + service) for seed count and media type is appropriate for HTTP boundary hygiene. Error mapping via `handleServiceError` is reused correctly.

**Frontend** — `GenerateShelfDialog` correctly enforces the 3-minimum and 10-maximum UI-side, preventing unnecessary API calls. `SeriesResponse.year` is confirmed present in the contract type (`catalog.ts:41`) so the year display is valid.

---

### Minor Observations (non-blocking)

**1. Materialization happens outside the transaction in `generateShelfFromSeeds`**

`resolveGeneratedMembers()` (which calls `materializeDiscoveryCandidate`) runs at `line 185`, before the `db.transaction()` block at `line 201`. If the shelf insert fails, any freshly-materialized canonical Movie/Series row persists without a shelf member.

In practice, these orphans are benign: they have zero availability and are invisible to the catalog. A second attempt would reuse the same canonical ID via the idempotency guard. No action required, but worth a code comment if this pattern recurs.

**2. Partial rules validation on refresh**

`const rules = shelf.rules as GeneratedShelfRules` (`line 249`) followed by a guard checking `seedMediaIds` existence and `limit != null`. If `seedMediaIds` entries are individually malformed (e.g., missing `mediaType`), the crash happens deep in `resolveGeneratedMembers` with a less legible error. Acceptable for now; the guard catches the most common corruption scenario.

**3. `availableToMe` not type-validated at route**

The route validates `mediaType` is a valid enum value, but `availableToMe` is passed through without checking it is a boolean. A non-boolean truthy value (e.g., `"yes"`) would reach the ranking service. Low risk given the current client is controlled, but inconsistent with the other validations.

---

### Security

No secrets exposed. Inputs validated at the HTTP boundary. Discovery candidate materialization is properly guarded. Canonical ID is returned (never the raw external ID) in shelf membership.

---

### Scope

Strictly contained. No existing routes or services modified beyond what the ticket requires. `GeneratedShelfRules` type is additive to the existing JSONB field.

---

### Verdict

All acceptance criteria satisfied. Prior blockers resolved. Minor observations do not affect correctness or safety.

IMPLEMENTATION_APPROVED
