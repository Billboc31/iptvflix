I now have a complete picture. Let me write the review.

---

## PR Review — T126: Cache personalized Home and add stable quality-gated hero

### Résumé

All three blocking and minor issues identified in the first review have been correctly addressed. The blocking bug (hero title appearing simultaneously in the hero section and as the first Pour toi item) is fixed. The two missing tests are now present. The partial mock type gaps in `home-service.test.ts` are resolved. The Drizzle migration (`0050_t126_home_discovery_snapshots.sql`) is present and correct. The implementation is ready to merge.

---

### Vérifications effectuées

**Bug #1 — Hero excluded from Pour toi (blocking in review 1)**
`home-pool-service.ts:552–564`: `selectHero` is now called before queuing Pour toi into `pendingRails`. The hero's `mediaId` is added to `excludedMediaIds` and the hero is filtered from `filteredPourToi` before the rail is persisted. Matches exactly the required fix from review 1.

**Test: hero mediaId excluded from Pour toi (missing in review 1)**
`home-pool-service.test.ts:548–613`: Two new tests — `'hero mediaId is excluded from Pour toi items'` and `'Pour toi is omitted entirely when the only candidate becomes the hero'` — are present and correctly structured.

**Test: invalidated snapshot falls to MISS, not STALE (missing in review 1)**
`home-snapshot.test.ts:344–358`: `INVALIDATED` describe block tests that `buildDeclaredRails` is called and `saveSnapshot` is called, confirming full regeneration rather than stale serving.

**Partial mock types in `home-service.test.ts` (minor in review 1)**
All four `buildDeclaredRails` mock calls now include `shelfInstanceIds` and `hero` in the return value (lines 154, 197, 216, 228). No more partial types.

**Migration file**
`apps/api/migrations/0050_t126_home_discovery_snapshots.sql` is present and correct: UUID PK, UNIQUE(profile_id), FK to profiles (cascade delete), FK to recommendation_home_sessions (cascade delete), `expires_at`, `invalidated_at`, `hero_media_id`, `hero_media_type`.

**Schema export**
`apps/api/src/db/schema/index.ts:42` exports `./home-discovery-snapshots.js`. ✅

---

### Points validés

| Critère | Statut |
|---|---|
| Snapshot HIT — no engine call | ✅ |
| Snapshot MISS — full generation + save | ✅ |
| Snapshot STALE — returns immediately, async regen | ✅ |
| Invalidated (not-yet-expired) → MISS, not STALE | ✅ |
| Per-profile isolation | ✅ |
| Zero repeated generation on HIT (call count = 0 × 3) | ✅ |
| Hero quality gate: score, availability, backdrop, dislike, no candidates | ✅ |
| Hero excluded from Pour toi items | ✅ |
| Pour toi omitted when sole candidate becomes hero | ✅ |
| Hero stable across snapshot lifetime | ✅ (snapshot stores hero, reconstructed on HIT) |
| No hero → no HeroSection, no empty space | ✅ (`{hero && <HeroSection />}`) |
| CW rail always live (not snapshotted) | ✅ (HIT + STALE paths fetch CW fresh) |
| Observability log lines (HIT / MISS / STALE_SERVED / GENERATION / pool fill) | ✅ |
| Drizzle migration present | ✅ |
| Schema export present | ✅ |
| Partial mock types fixed | ✅ |
| Scope compliant (no out-of-scope changes) | ✅ |

---

### Problèmes détectés

Aucun problème bloquant.

---

### Risques éventuels

**Latent — session cascade delete on snapshot table** (noted in review 1, still present): if sessions are cleaned up before their associated snapshots expire, the FK cascade will delete the snapshot row, effectively forcing a MISS on the next load. This is not an issue today since no session cleanup job exists, but should be revisited if one is added. Architecture note only, non-blocking.

**Latent — invalidated + already-expired snapshot falls to STALE path** (noted in review 1): when `invalidatedAt` is set AND `expiresAt < now()`, `isSnapshotValid` → false (correct), `isStale` → true, which means the stale path would serve the old snapshot including potentially a disliked hero. Since `invalidateSnapshot` is not yet called from any code path, this is safe for now. Should be addressed when feedback-driven invalidation lands.

---

### Décision

IMPLEMENTATION_APPROVED
