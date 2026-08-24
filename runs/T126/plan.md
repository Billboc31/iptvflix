I have enough context. Here's the plan:

## Objective

Eliminate redundant recommendation-engine and LLM calls on repeated Home refreshes by persisting a per-profile discovery snapshot (declared rails + hero), and replace arbitrary hero selection with a quality-gated, personalized hero that is stable for the snapshot lifetime (~24 h). If no candidate passes the quality gate, no hero is rendered.

## Included

### 1. New DB schema — `home_discovery_snapshots`

**File to create:** `apps/api/src/db/schema/home-discovery-snapshots.ts`

Table columns:
- `id` UUID PK
- `profile_id` UUID FK → `profiles` (cascade delete)
- `session_id` UUID FK → `recommendation_home_sessions`
- `generated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `expires_at` TIMESTAMPTZ NOT NULL
- `declared_shelf_instance_ids` UUID[] NOT NULL — ordered list of shelf_instance IDs for the declared rails (excl. CW, which stays live)
- `hero_media_id` TEXT nullable
- `hero_media_type` TEXT nullable
- `invalidated_at` TIMESTAMPTZ nullable — explicit signal-driven invalidation
- UNIQUE constraint on `profile_id` (one snapshot per profile; upsert replaces)

**File to update:** `apps/api/src/db/schema/index.ts` — add export.

**Migration:** new Drizzle migration for the table.

### 2. New service — `apps/api/src/services/home-snapshot-service.ts`

Functions:
- `getValidSnapshot(profileId)` — returns snapshot row if `expires_at > now()` AND `invalidated_at IS NULL`; returns the row even if stale (caller decides stale-while-revalidate)
- `saveSnapshot(profileId, sessionId, declaredShelfInstanceIds, expiresAt, heroMediaId?, heroMediaType?)` — upsert on `profile_id`
- `invalidateSnapshot(profileId)` — sets `invalidated_at = now()`
- `isStale(snapshot)` — `snapshot.expiresAt < now()`

### 3. New service — `apps/api/src/services/hero-selector.ts`

Function: `selectHero(candidateItems: ShelfCandidateItem[], enrichmentMap): HeroItem | null`

Quality gate (all conditions must pass):
- `availabilityStatus === 'available'` (or catalog-available equivalent)
- `backdropUrl` is non-null and non-empty in enrichment map
- `finalScore >= HERO_MIN_SCORE` (env var, default 0.55)
- not disliked (check `explicit_feedback` table for DISLIKE signal on this profileId + mediaId)
- has a display title

Returns best-scoring passing candidate as `HeroItem`, or `null` if none pass.

### 4. Type changes — `packages/api-contracts/src/home.ts`

Add:
```ts
export type HeroItem = {
  mediaId: string
  mediaType: 'MOVIE' | 'SERIES'
  title: string
  synopsis: string | null
  backdropUrl: string | null
  availabilityStatus: string
  trailerKey: string | null
}

// Add to HomePageResponse:
hero: HeroItem | null
```

### 5. Modified service — `apps/api/src/services/home-pool-service.ts`

- `buildDeclaredRails()` return type extended: add `shelfInstanceIds: string[]` (IDs of the created `shelf_instances` rows, in order, excluding CW rail which is live)
- Add structured observability log lines at key points:
  - `[HOME_GENERATION] expensive LLM/semantic generation triggered profileId=<id>`
  - `[HOME_GENERATION] pool fill triggered sessionId=<id>`

### 6. Modified service — `apps/api/src/services/home-service.ts`

Cold-start path (no cursor):
1. `getOrCreateSession(profileId)`
2. `getValidSnapshot(profileId)` → snapshot exists and not stale → **HIT**: reconstruct shelves from existing `shelf_instance_items` rows (same `batchRowsToShelfResponses` path, no LLM); log `[HOME_SNAPSHOT] HIT`; return with `hero` from snapshot
3. Snapshot exists but stale → **STALE**: return last snapshot shelves immediately; trigger `buildDeclaredRails()` + `saveSnapshot()` async (fire-and-forget); log `[HOME_SNAPSHOT] STALE_SERVED regeneration=triggered`
4. No snapshot → **MISS**: call `buildDeclaredRails()` (logs GENERATION), call `selectHero()` on Pour toi candidates (before adding hero back to the excludedMediaIds set so hero doesn't also appear in Pour toi), call `saveSnapshot()`, return with `hero`; log `[HOME_SNAPSHOT] MISS`

Hero cross-shelf dedup: after `selectHero()` picks a candidate, add its `mediaId` to the `excludedMediaIds` set before building remaining declared rails. Since `buildDeclaredRails` builds Pour toi first and the hero is drawn from Pour toi candidates, the hero's `mediaId` is excluded from Pour toi items and from pool shelves.

### 7. Modified frontend — `apps/web/src/hooks/useHome.ts`

- Extract `hero: HeroItem | null` from the first page response and expose it from the hook.

### 8. Modified frontend — `apps/web/src/pages/HomePage.tsx`

- Render `<HeroSection>` only when `hero` is non-null (no reserved empty space otherwise).
- Pass `hero.backdropUrl`, `hero.title`, `hero.synopsis`, `hero.trailerKey`, `hero.availabilityStatus`, `hero.mediaId` to `HeroSection`.
- Remove the existing workaround that picks hero from `movies` or `allShelves[0].items[0]`.

### 9. Config / env

Add to `apps/api/src/config/env.ts`:
- `HERO_MIN_SCORE` (float, default 0.55)
- `HOME_SNAPSHOT_TTL_HOURS` (int, default 24)

### 10. Tests

**New file:** `apps/api/src/services/__tests__/home-snapshot.test.ts`
- snapshot HIT: second call returns same shelf_instance rows, no call to recommendation engine
- snapshot MISS: first call triggers generation
- snapshot STALE: stale snapshot is served immediately; regeneration is triggered async
- per-profile isolation: snapshot for profile A does not affect profile B
- no repeated expensive generation: mock engine and assert call count is 0 on HIT path

**New file:** `apps/api/src/services/__tests__/hero-selector.test.ts`
- candidate with all gates passing → hero selected
- candidate missing backdropUrl → excluded
- candidate with low finalScore → excluded
- candidate with DISLIKE feedback → excluded
- no passing candidate → `null` returned (no hero)
- hero mediaId excluded from Pour toi shelf in full integration path

## Excluded

- Any cache invalidation triggered by catalog ingestion events (future ticket)
- Like/dislike/seen feedback invalidation of snapshots (architecture is in place via `invalidateSnapshot()` but no call sites wired)
- Hero trailer auto-play behavior changes (existing `HeroSection` behavior unchanged)
- Changes to pagination/pool filling logic beyond adding `shelfInstanceIds` to return type
- Changes to the recommendation engine service itself
- Admin/diagnostic UI changes
- Changing the `Continuer à regarder` shelf (remains live, never snapshotted)

## Acceptance criteria

- Repeated Home loads within the snapshot TTL (24 h) do not call the recommendation engine or perform LLM/semantic generation; verified by test asserting engine mock call count = 0 on HIT path.
- Snapshot is per-profile: two profiles with different IDs each have their own independent snapshot.
- A stale snapshot is served immediately on the next request while async regeneration is triggered; no request blocks on generation.
- `Continuer à regarder` items reflect current playback state regardless of snapshot age.
- Hero is selected via `selectHero()` applying the documented quality gate; no arbitrary catalog ordering.
- Hero is stored in the snapshot and is identical across all refreshes within the snapshot window.
- When no candidate passes the quality gate, `hero` is `null` in the response; `HomePage.tsx` renders no `<HeroSection>` and no empty/black hero placeholder.
- Hero `mediaId` does not appear as the first item of `Pour toi` when the hero is set.
- Logs distinguish HIT / MISS / STALE_SERVED / GENERATION triggered — verifiable in local dev by refreshing the Home page multiple times.
- All existing Home pagination, pool filling, and diagnostic preview tooling continue to work without modification.
- `pnpm test` passes for the two new test files.
