Here is the complete test report for T106.

---

## T106 — Test Report

### Bugs Found and Fixed

Three instances of the same bug were discovered and fixed before acceptance testing:

| File | Fix |
|------|-----|
| `shelf-instance-service.ts:66` | `${at}` → `${at.toISOString()}::timestamptz` in COALESCE sql template |
| `shelf-instance-service.ts:294` | `${new Date(before)}` → `${new Date(before).toISOString()}::timestamptz` in cursor comparison |
| `shelf-fatigue-service.ts:80` | `${lookbackCutoff}` → `${lookbackCutoff.toISOString()}::timestamptz` in CASE WHEN |

All three involved `Date` objects passed as parameters inside Drizzle `sql` template literals — postgres.js v3 cannot serialize raw Date objects in that position. Errors were silently swallowed by `dispatchSideEffects().catch()`, making `firstDisplayedAt` always null and fatigue tracking completely broken.

---

### Acceptance Criteria Results

| # | Criterion | Result |
|---|-----------|--------|
| 1 | ShelfConcept and ShelfInstance distinguishable and linked | ✅ PASS |
| 2 | Ordered item snapshots + scores/reasons persist | ✅ PASS |
| 3 | Generated vs displayed vs visible distinguishable | ✅ PASS (after fix) |
| 4 | Item outcomes attributed within defined rules + fallback | ✅ PASS (after fix) |
| 5 | Profile-level performance recomputable from history | ✅ PASS |
| 6 | Content exposure efficiently queryable | ✅ PASS |
| 7 | Concept fatigue/cooldown derivable, cooldown triggers at 5 zero-interaction visible impressions | ✅ PASS (after fix) |
| 8 | Home session identity for cross-shelf deduplication | ✅ PASS |
| 9 | Model/query/embedding versions stored | ✅ PASS |
| 10 | Lab can inspect shelf history and score/outcome traces | ⚠️ API endpoints work — **no UI** |
| 11 | Data retention strategy | ⚠️ Schema ready (expires_at, indexes) — **no enforcement job** |

---

### Blocking Issues

1. **Lab UI absent** — The completion rule requires proving that Lab can reconstruct which concept was shown, item ordering/scores, visibility, what was opened/played, and the resulting performance state. The API routes (`/recommendation-lab/profiles/:id/shelf-history`, `/recommendation-lab/shelf-instances/:id/trace`) work correctly and return all required data. However, `RecommendationLabPage.tsx` has no Shelf History tab — zero shelf-history UI exists. **This is a blocker per the ticket's completion rule.**

2. **Retention enforcement absent** — `expires_at` columns exist but no scheduled job deletes or archives expired `shelf_instances`, `profile_media_exposure`, or `shelf_concept_fatigue` rows. Data grows unbounded.
