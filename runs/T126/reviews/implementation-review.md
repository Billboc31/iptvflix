I have a clear picture of the implementation. Writing the review now.

---

## Review — T126: Cache personalized Home and add stable quality-gated hero

### Summary

The implementation is structurally sound and well-architected. The snapshot system, hero selector, observability logs, and frontend changes are all in place. One **blocking bug** prevents merge: the hero candidate is not removed from the "Pour toi" shelf, causing the same title to appear simultaneously in the hero section and as the first item of the rail. This is an explicit acceptance criterion and an explicit plan requirement that were both missed.

---

### Correctness against ticket requirements

#### Home snapshot / caching ✅

- DB schema is correct: UNIQUE on `profile_id`, FK cascade on profile and session, `expires_at`, `invalidated_at`, hero fields — all present.
- `isSnapshotValid` correctly rejects both expired and explicitly-invalidated snapshots.
- HIT / STALE / MISS branching in `home-service.ts` is logically correct.
- Stale-while-revalidate works: stale path returns immediately and fires `_regenerateSnapshot` + `fillPool` in fire-and-forget.
- `Continuer à regarder` stays live in both HIT and STALE paths (`getShelf('sys_continue_watching', ...)` called fresh each time). ✅
- Observability log lines are all present: `[HOME_SNAPSHOT] HIT`, `MISS`, `STALE_SERVED regeneration=triggered`, `[HOME_GENERATION] expensive LLM/semantic generation triggered`, `[HOME_GENERATION] pool fill triggered`. ✅
- `invalidateSnapshot()` wired in schema but not yet called from any signal handler — in line with plan scope exclusion. ✅

**Edge case: invalidated + not-yet-expired snapshot.** When `invalidatedAt` is set but `expiresAt` is still in the future: `isSnapshotValid` → false, `isStale` → false → falls to MISS → full regeneration. This is the correct behavior: explicit invalidation should never produce stale serving.

**Edge case: invalidated + expired snapshot.** `isSnapshotValid` → false, `isStale` → true → STALE path serves the old snapshot content (which might contain a hero that was explicitly disliked). This is a latent issue that becomes relevant when feedback invalidation is wired. Since no call sites exist yet for `invalidateSnapshot`, it's not blocking now, but should be addressed at that point.

#### Hero selector ✅ (quality gate correct, dedup broken — see below)

`hero-selector.ts` correctly enforces all required gates:
- `c.available && c.finalScore >= HERO_MIN_SCORE` (pre-DB filter)
- not in disliked set (DB query)
- `backdropUrl` non-null (resolveMediaImageUrl check)
- `title` non-empty
- returns `null` when no candidate passes

`availabilityStatus: 'available'` is hardcoded in the return and in `reconstructHero`, which is consistent with the gate (`available: true` required to be eligible) and consistent with how `HomePage.tsx` consumes it.

#### **BLOCKING — Hero appears in "Pour toi" shelf** ❌

The plan explicitly states: *"the hero's `mediaId` is excluded from Pour toi items and from pool shelves"* and the ticket acceptance criterion says: *"Hero/cross-shelf duplication is reduced when alternatives exist"*.

**What the code actually does:**

```
// home-pool-service.ts, buildDeclaredRails()

// Rail 2: Pour toi — builds candidates including the eventual hero
pourToiCandidates = candidates
pendingRails.push({ title: 'Pour toi', candidates, ... })  // hero is still in here
for (const c of candidates) excludedMediaIds.add(c.mediaId)

// Hero selection happens AFTER Pour toi is queued
hero = await selectHero(profileId, pourToiCandidates)
if (hero) {
  // Only excludes hero from rails 3–6 — too late for rail 2
  excludedMediaIds.add(hero.mediaId)
}
```

Result: the hero (highest-scoring candidate) is the first item of the Pour toi rail **and** is rendered in the hero section above. The user sees the same title twice in the most prominent positions on the page. This is the exact scenario the ticket asks to prevent.

**Required fix:** Select the hero before pushing Pour toi into `pendingRails`, then remove the hero from the Pour toi candidates array:

```ts
// Hero selection BEFORE queueing Pour toi
hero = await selectHero(profileId, pourToiCandidates)
if (hero) {
  excludedMediaIds.add(hero.mediaId)
}

// Filter hero out of Pour toi before persisting
const filteredPourToi = pourToiCandidates.filter((c) => c.mediaId !== hero?.mediaId)
if (filteredPourToi.length > 0) {
  pendingRails.push({ title: 'Pour toi', candidates: filteredPourToi, ... })
  for (const c of filteredPourToi) excludedMediaIds.add(c.mediaId)
}
```

The plan also requested a test for this: *"hero mediaId excluded from Pour toi shelf in full integration path"* — that test is absent.

---

### Scope compliance ✅

No out-of-scope changes. The `HOME_FRESH_DAYS` env var is a minor addition that supports the "Nouveautés" rail freshness filter — justified by the existing pool-service logic it parameterizes. The `freshnessBoostDays` field added to the engine client is minimal and correctly plumbed.

---

### Code quality

- `home-service.ts` and `home-pool-service.ts` are clear and readable. Each concern is well separated.
- `reconstructShelvesFromSnapshot` correctly preserves snapshot ordering by building an `idOrder` map before sorting.
- `reconstructHero` duplicates the movie/series branch pattern from `hero-selector.ts` — acceptable given the different context (reading from snapshot), not a quality concern.
- `ShelfErrorBoundary` in `HomePage.tsx` is a good defensive addition; `componentDidCatch` body is empty which is fine for a silent catch.
- The `batchRowsToShelfResponses` function in `home-service.ts` is a duplicate of similar enrichment logic in `home-pool-service.ts`. This is a pre-existing pattern and out of scope for this ticket, but worth noting for future consolidation.

**Minor:** `home-service.test.ts` lines 197 and 216 mock `buildDeclaredRails` without `shelfInstanceIds` and `hero` fields:
```ts
vi.mocked(buildDeclaredRails).mockResolvedValue({ shelves: [], nextPoolPosition: 0 })
```
TypeScript should warn about this (partial return type). At runtime the missing fields are `undefined`, and `declared.shelfInstanceIds` being `undefined` is passed to the mocked `saveSnapshot` (harmless in tests since saveSnapshot is mocked), but this is a typing gap.

---

### Test coverage

| Scenario | Covered? |
|---|---|
| Snapshot HIT — no engine call | ✅ |
| Snapshot MISS — full generation | ✅ |
| Snapshot STALE — returns immediately, async regen | ✅ |
| Per-profile isolation | ✅ |
| Zero repeated generation on HIT (call count assertion) | ✅ |
| Hero quality gate: score threshold | ✅ |
| Hero quality gate: available flag | ✅ |
| Hero quality gate: backdropUrl null | ✅ |
| Hero quality gate: dislike feedback | ✅ |
| Hero quality gate: no candidates | ✅ |
| Hero stability across refreshes (snapshot stores hero) | ✅ (implicit via HIT test) |
| No hero → no HeroSection rendered | (frontend mock-level only) |
| **Hero excluded from Pour toi items** | ❌ MISSING |
| Explicitly invalidated snapshot → MISS (not STALE) | ❌ MISSING |

---

### Architecture

- One snapshot per profile via UNIQUE(profile_id) and upsert-on-conflict. Clean.
- `declared_shelf_instance_ids` is `text[]` in schema vs `uuid[]` in plan. PostgreSQL accepts UUIDs as text; functionally correct, but a schema type inconsistency.
- The session FK on `home_discovery_snapshots` (cascade delete) means deleting a session invalidates the snapshot implicitly. This could be undesired if sessions expire and are cleaned up but the snapshot should still serve. Worth reviewing when session cleanup is implemented.

---

### Blocking issues

1. **Hero appears in Pour toi shelf** — hero candidate not removed from Rail 2 candidates before persisting. Violates acceptance criterion and plan spec. Required fix is ~5 lines in `buildDeclaredRails`. Associated test must be added.

### Minor observations (non-blocking)

2. Partial mock return type in `home-service.test.ts` (missing `shelfInstanceIds`/`hero`) — fix for type safety.
3. Missing test: explicitly invalidated snapshot falls to MISS path.
4. Session cascade delete on snapshot table warrants a future comment when session cleanup is implemented.

---

IMPLEMENTATION_FIX_REQUIRED
