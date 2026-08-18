# T106 — Test Report

**Date**: 2026-08-18  
**Branch**: ticket/T106-persist-shelfconcept-shelfinstance-history-and-ite  
**Environment**: local (postgres port 5433, API port 3001)

---

## Bugs Found and Fixed During Testing

Three instances of the same root bug were discovered and fixed before the final acceptance-criteria run. All three involved `Date` objects passed into Drizzle `sql` template literals, which postgres.js v3 cannot serialize in prepared-statement parameter position.

| File | Line | Expression | Fix |
|------|------|-----------|-----|
| `shelf-instance-service.ts` | 66 | `sql\`COALESCE(…, ${at})\`` | `${at.toISOString()}::timestamptz` |
| `shelf-instance-service.ts` | 294 | `sql\`… < ${new Date(before)}\`` | `${new Date(before).toISOString()}::timestamptz` |
| `shelf-fatigue-service.ts` | 80 | `sql\`CASE WHEN … < ${lookbackCutoff} …\`` | `${lookbackCutoff.toISOString()}::timestamptz` |

Without these fixes:
- `SHELF_IMPRESSION` side-effect (`markFirstDisplayed`) silently failed — `firstDisplayedAt` was never set.
- `SHELF_ITEM_VISIBLE` fatigue upsert silently failed on conflict-update path — `visibleImpressionCount` and `zeroInteractionStreakCount` were never incremented.

Errors were swallowed by the non-blocking `dispatchSideEffects().catch()` wrapper, making them invisible to callers.

---

## Acceptance Criteria

### AC1 — ShelfConcept and ShelfInstance are distinguishable and linked
**PASS**

Two `ShelfInstance` rows were created for the same `ShelfConcept` (`690f9419…`), each with different `rankerVersion` (`ranker_v1` vs `ranker_v2`). The API returns `shelfConceptId` on every instance. FK constraint links the two tables. The concept remains a single row while instances accumulate.

```
GET /shelf-instances/:id → shelfConceptId: "690f9419-7622-4c90-8696-f1b6a2147c48"
ShelfInstance #1: ranker_v1, createdAt: 2026-08-18T13:20:39.766Z
ShelfInstance #2: ranker_v2, createdAt: 2026-08-18T13:20:39.826Z
```

---

### AC2 — Every generated shelf can persist ordered item snapshots + scores/reasons
**PASS**

`shelf_instance_items` stores rank position, semantic/profile/final scores, diversity adjustment, availability status, reason codes, and eligibility flag. Retrieved correctly:

```
rank 1: semanticScore=0.92 profileScore=0.88 finalScore=0.9 reasons=["semantic_match","profile_affinity"]
rank 2: semanticScore=0.85 profileScore=0.82 finalScore=0.84 reasons=["semantic_match"]
```

---

### AC3 — Generated vs displayed vs visible are distinguishable
**PASS** (after bug fix)

Three distinct states are tracked:
- `createdAt` — generation time (always set)
- `firstDisplayedAt` — set by `SHELF_IMPRESSION` event (was null before event, `2026-08-18T13:23:54.140Z` after)
- `wasVisible` per item — set by `SHELF_ITEM_VISIBLE` event (rank 1 set, rank 2 remained false)

Before fix, `markFirstDisplayed` crashed silently on every call. After fix, works correctly.

---

### AC4 — Item clicks/plays/outcomes can be attributed to originating shelf within defined rules
**PASS** (after bug fix)

`openedAt` and `playedAt` are set per item via events:

```
SHELF_ITEM_OPENED → rank 1 openedAt=2026-08-18T13:24:09.775Z
PLAY_STARTED      → rank 1 playedAt=2026-08-18T13:24:10.815Z
rank 2            → openedAt=null playedAt=null (unattributed)
```

**Attribution fallback tested**: a `PLAY_STARTED` event without `shelfInstanceId` was correctly attributed to the originating shelf by looking up the most recent `SHELF_ITEM_OPENED` for the same `mediaId` within 30 minutes.

---

### AC5 — Profile-level shelf performance can be recomputed from history
**PASS**

```
GET /profiles/:profileId/shelf-concepts/:conceptId/performance →
{
  "impressionCount": 2,
  "visibleRate": 0.5,
  "openRate": 1,
  "playRate": 1
}
```

Metrics are computed from raw history (not pre-aggregated), so they can be recomputed when definitions change.

---

### AC6 — Recent content exposure is efficiently queryable for reranking/deduplication
**PASS**

`profile_media_exposure` tracks per-media exposure state:

```sql
media_id: 63db77f6…  exposure_count=1 open_count=1 play_count=1 shown_in_concept_ids=["690f9419…"]
media_id: 912e8f6d…  exposure_count=1 open_count=0 play_count=0 shown_in_concept_ids=["690f9419…"]
```

Unique index on `(profile_id, media_type, media_id)` and index on `(profile_id, last_exposed_at)` support efficient dedup queries. `getRecentlyExposedMediaIds(profileId, hoursBack)` is implemented in `ShelfPerformanceService`.

---

### AC7 — Concept fatigue/cooldown can be derived and supplied to #208
**PASS** (after bug fix)

Fatigue progresses correctly:
1. `SHELF_IMPRESSION` (wasVisible=false): `impression_count=1`, streak not incremented
2. `SHELF_ITEM_VISIBLE` (wasVisible=true): `visible_impression_count++`, `zero_interaction_streak_count++`
3. After 5 consecutive visible impressions with no interaction: **cooldown triggered**

```
After 5 visible impressions, 0 interactions:
impression_count=6  visible_impression_count=5  zero_interaction_streak_count=5
cooldown_until=2026-08-25T13:26:28.452Z  suppression_reason=zero_interaction_streak
```

`recordInteraction()` resets streak to 0 on open/play. Suppression persists with reason/version.

Without the bug fix, the upsert-on-conflict path in `recordImpression` crashed silently on every call where the fatigue record already existed.

---

### AC8 — Recommendation Home/session identity supports cross-shelf deduplication
**PASS**

`recommendation_home_sessions` table created with `id`, `profile_id`, `started_at`, `expires_at`, `model_version`, `cursor_reference`. Session can be linked to `shelf_instances.home_session_id`. Session created and queryable:

```
id: 4fe20252…  model_version=recommendation_v1  expires_at=2026-08-18T13:56:47Z
```

Note: no automatic session-creation API exists — callers must create sessions explicitly.

---

### AC9 — Model/query/embedding versions stored for reproducibility
**PASS**

Every `ShelfInstance` stores:
- `ranker_version` (e.g., `ranker_v1`, `ranker_v2`)
- `query_planner_version` (e.g., `queryPlanner_v1`)
- `embedding_model_version` (e.g., `embeddingModel_text-embedding-3-small`)

Allows answering "did ranker_v2 outperform ranker_v1 for this concept?".

---

### AC10 — Lab can inspect real shelf history and score/outcome traces
**PARTIAL PASS — API only, no UI**

**API routes work correctly:**

```
GET /recommendation-lab/profiles/:profileId/shelf-history →
[
  { instanceId, renderedTitle, itemCount, visibleRate, openRate, playRate, fatigueState: { impressionCount, cooldownUntil, … } }
]

GET /recommendation-lab/shelf-instances/:id/trace →
{
  instance: { id, title, rankerVersion, items: [ { rank, scores, wasVisible, openedAt, playedAt } ] },
  fatigueAtDisplay: { impressionCount, zeroInteractionStreakCount, cooldownUntil }
}
```

**Frontend UI**: `RecommendationLabPage.tsx` has no Shelf History tab. Only "Shelf Concepts" and "Semantic Search" tabs exist. There is no UI for:
- Browsing profile shelf history
- Viewing per-item scores
- Visibility/outcome trace inspection
- Concept fatigue/cooldown dashboard

The completion rule requires Lab to display this — it does not.

---

### AC11 — Data growth/retention strategy exists
**PARTIAL PASS**

| Element | Status |
|---------|--------|
| `expires_at` on `shelf_instances` and `recommendation_home_sessions` | ✓ Schema ready |
| Indexes for profile/time/concept/media | ✓ All present |
| `retention-service.ts` compacts interaction events (90d / 730d) | ✓ Existing |
| Deletion/archival of `shelf_instances` past expiry | ✗ Not implemented |
| Cleanup of `profile_media_exposure` stale entries | ✗ Not implemented |
| Cleanup of `shelf_concept_fatigue` old records | ✗ Not implemented |

The schema and indexes are correct. There is no scheduled job or retention logic that enforces TTL on shelf history tables. Data grows unbounded unless manually pruned.

---

## Summary

| # | Criterion | Result |
|---|-----------|--------|
| 1 | ShelfConcept and ShelfInstance distinguishable and linked | ✅ PASS |
| 2 | Ordered item snapshots + scores/reasons persist | ✅ PASS |
| 3 | Generated vs displayed vs visible distinguishable | ✅ PASS (after fix) |
| 4 | Item outcomes attributed within defined rules | ✅ PASS (after fix) |
| 5 | Profile-level performance recomputable from history | ✅ PASS |
| 6 | Content exposure efficiently queryable | ✅ PASS |
| 7 | Concept fatigue/cooldown derivable for #208 | ✅ PASS (after fix) |
| 8 | Home session identity for cross-shelf deduplication | ✅ PASS |
| 9 | Model/query/embedding versions stored | ✅ PASS |
| 10 | Lab inspection of shelf history + traces | ⚠️ API ONLY — no UI |
| 11 | Data retention strategy | ⚠️ Schema only — no enforcement job |

## Blocking Issues

1. **Lab UI missing** (AC10, Completion Rule): The completion rule requires generating real shelves, interacting with items, and proving that the Lab can reconstruct the full trace. The API endpoints work, but there is no Lab UI tab to visualize it. This is a blocker per the completion rule.

2. **Retention enforcement absent** (AC11): `expires_at` columns exist but nothing deletes or archives expired rows. A scheduler task or cron job is needed.

## Non-Blocking (Fixed)

Three `Date`-in-sql-template bugs were fixed during testing. These were critical runtime failures masked by silent error swallowing, but all three have been corrected in this test pass.
