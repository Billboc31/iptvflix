## Objective

Add a `GENERATED` shelf type that accepts 2–10 canonical seed Media, derives a ranked recommendation set from those seeds via the existing ranking engine, materializes any discovery-only candidates into canonical zero-Availability Media, and persists enough intent in the shelf's `rules` field to allow deterministic refresh.

## Included

**Schema — `/apps/api/src/db/schema/shelves.ts`**
- Add `GENERATED` to the `shelfType` enum (existing values: `SYSTEM`, `MANUAL`, `DYNAMIC`).
- No new columns; generation intent is stored in the existing `rules` JSONB field under a typed `GeneratedShelfRules` shape: `{ seedMediaIds: { mediaType, mediaId }[], mediaType?, availableToMe?, limit, inferredGenreIds, generatedAt }`.
- One Drizzle migration for the enum change.

**New service — `/apps/api/src/services/shelf-generation-service.ts`**
- `generateShelfFromSeeds(profileId, opts)`:
  - `opts`: `{ title, seedMediaIds: { mediaType, mediaId }[], mediaType?, availableToMe?, limit? (1–100) }`
  - Validate 2–10 seeds; each must resolve to an existing canonical Movie or Series record; reject unknown IDs.
  - Query genre IDs of seed media to build `inferredGenreIds` for explanation (no LLM call).
  - Call `rankRecommendations(profileId, { positiveMediaIds: seedIds, mediaType, availableToMe, includeSeen: false, limit })` from the existing `recommendation-ranking-service`.
  - Remove seed media from ranked results (filter by mediaId before persisting members).
  - For each ranked candidate whose `canonicalMovieId`/`canonicalSeriesId` is null: call `materializeDiscoveryCandidate(candidateId)` (see below) to create a canonical record with zero Availability rows, then use that canonical ID as the member reference.
  - Create the shelf via existing `createShelf()` with type `GENERATED` and rules payload above.
  - Batch-insert `shelfMembers` in ranked order via existing `addMember()`.
  - Return `{ shelf, members, explanation: { inferredGenreIds, seedTitles } }`.

- `materializeDiscoveryCandidate(candidateId)` (private helper):
  - Read the discovery candidate row.
  - Insert a canonical Movie or Series with the candidate's metadata and no Availability rows (zero-availability sentinel).
  - Write the canonical ID back to `canonicalMovieId`/`canonicalSeriesId` on the candidate row (reusing the existing deduplication FK pattern).
  - Return the new canonical ID.

- `refreshGeneratedShelf(shelfId)`:
  - Load shelf; assert type is `GENERATED`.
  - Re-run `generateShelfFromSeeds` with the stored intent from `rules`.
  - Delete existing `shelfMembers` for the shelf.
  - Re-insert members and update `generatedAt` in `rules`.

**Routes — `/apps/api/src/routes/shelves.ts`**
- `POST /shelves/generate` — body: `{ title, seedMediaIds[], mediaType?, availableToMe?, limit? }`; calls `generateShelfFromSeeds`; returns shelf + explanation.
- `POST /shelves/:id/refresh` — calls `refreshGeneratedShelf`; validates shelf type is `GENERATED` before proceeding; returns updated shelf.
- Server-side validation: seedMediaIds length 2–10, each entry has mediaType + mediaId, optional constraints reuse existing `validateDynamicRules` patterns.

**Tests — `/apps/api/src/services/__tests__/shelf-generation-service.test.ts`**
- Seed count validation: fewer than 2 seeds rejected.
- Unknown seed: non-existent canonical ID rejected.
- Determinism: same seeds + profile + fixed ranking mock produce identical member order.
- Seed exclusion: seed media IDs are absent from generated members.
- Deduplication: discovery candidate with existing `canonicalMovieId` uses that canonical ID, no new record created.
- Materialization: discovery candidate without canonical link produces a new canonical Movie/Series row with zero Availability.
- `availableToMe=true`: unavailable candidates excluded from members.
- Persistence: created shelf has type `GENERATED`, `rules.seedMediaIds` matches input, `rules.generatedAt` is set.
- Refresh: members replaced, `generatedAt` updated, intent unchanged.

## Excluded

- Free-form natural-language prompts for shelf generation.
- Sharing generated shelves between profiles.
- Mandatory LLM call at generation time.
- Editing seed media after initial shelf creation (requires a separate ticket).
- Frontend/UI beyond the two new API routes.
- Periodic automatic refresh scheduling (deferred).

## Acceptance criteria

- `POST /shelves/generate` with 3 valid canonical seed IDs returns a shelf of type `GENERATED` whose members do not include the seed IDs.
- `POST /shelves/generate` with fewer than 2 seeds or an unknown seed ID returns a 400 with a descriptive error.
- All shelf members reference canonical `movieId`/`seriesId` columns, never raw `discoveryCandidate` IDs.
- A discovery candidate with no canonical link present in the ranked results is materialized: a new canonical row exists in movies/series with zero Availability rows after the call.
- A discovery candidate with an existing canonical link is not duplicated: no second canonical row is created.
- The `rules` field of the created shelf contains `seedMediaIds`, `inferredGenreIds`, and `generatedAt`.
- `POST /shelves/:id/refresh` on a `GENERATED` shelf replaces members and updates `generatedAt`; calling it on a `MANUAL` or `DYNAMIC` shelf returns 400.
- All test scenarios listed under Included pass (`vitest` or equivalent).
