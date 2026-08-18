# T105 — Generate personalized shelf concepts with LLM

## Objective

Add a `ShelfConcept` layer that uses an LLM to produce a versioned, validated, cached pool of personalized editorial concepts per Profile, each destined to flow through the existing retrieval/ranking pipeline (T206 → T205/T207) to populate Home shelves.

## Included

### 1. DB schema — `apps/api/src/db/schema/shelf-concepts.ts`

New `shelfConcepts` table:
- `id` uuid PK
- `profileId` uuid nullable (FK → profiles, cascade delete) — null for editorial/global concepts
- `title` text not null — display string
- `rawIntent` text not null — natural-language intent as returned by LLM
- `semanticIntent` text not null — 3–5 sentence embedding seed (mirrors T206 convention)
- `generationType` text not null — enum `PERSONALIZED | EXPLORATION | DISCOVERY | FIXED | EDITORIAL`
- `reasonCodes` jsonb `string[]` — why this concept was chosen
- `sourceModel` text not null — LLM model ID used
- `promptVersion` text not null — e.g. `shelf-concept-v1`
- `desiredMediaTypes` jsonb `('MOVIE' | 'SERIES')[]`
- `freshnessPolicy` text nullable — `AVAILABLE_NOW | NEW_RELEASES | ALL`
- `active` boolean default true
- `createdAt` timestamp defaultNow
- `expiresAt` timestamp nullable
- Aggregated performance counters: `reachCount`, `openCount`, `playCount`, `completionCount`, `dismissCount` integer default 0 — updated in place rather than a separate table to keep reads simple

New Drizzle migration for this table.

### 2. API contracts — `packages/api-contracts/src/shelf-concepts.ts`

Export:
- `ShelfConcept` — mirrors the DB row (serializable, no secrets)
- `ShelfConceptProfileContext` — extends the existing `CompactTasteContext` with:
  - `mediaTypeBalance: { movies: number; series: number; anime: number }`
  - `runtimePreference: 'short' | 'standard' | 'long' | 'mixed'`
  - `languagePreferences: string[]`
  - `recentCompletions: string[]` (titles only, max 5)
  - `recentAbandons: string[]` (titles only, max 5)
  - `bingeTendency: boolean`
  - `recentShelfConcepts: Array<{ title: string; generationType: string; openRate: number }>` (max 10, summarized performance)
  - `newCatalogSignals: string[]` (recently added titles, max 5)
  - `isKids: boolean`
  - `coldStart: boolean`
- `GenerateShelfConceptsBody: { profileId: string; count?: number }`
- `GenerateShelfConceptsResponse: { concepts: ShelfConcept[]; coldStart: boolean; profileContext: ShelfConceptProfileContext }`
- `ShelfConceptFeedbackBody: { signal: 'good' | 'bad' }`

Export barrel from `packages/api-contracts/src/index.ts`.

### 3. Prompt — `apps/api/src/prompts/shelf-concept-generator-v1.ts`

System prompt that instructs the LLM to:
- Return a strict JSON array of concept objects; each must have `title`, `rawIntent`, `semanticIntent`, `generationType`, `reasonCodes`, `desiredMediaTypes`, `freshnessPolicy`
- Distribute concept types according to the generation mix ratios passed in context (see §5)
- Not invent content IDs or specific titles from memory
- Vary styles: themes, directors, moods, franchises, languages — not just genre-only shelves
- Cold-start variant: omit personal taste fields; focus on popular/trending/genre-starter concepts

### 4. Service — `apps/api/src/services/shelf-concept-generator-service.ts`

`ShelfConceptGeneratorService` class:

**`buildProfileContext(profileId: string): ShelfConceptProfileContext`**
- Calls `getTaste(profileId)` (existing service)
- Queries recent `profileInteractionEvents` for completions, abandons, binge streaks (≥ 3 episodes same series in ≤ 24 h)
- Queries `shelfConcepts` for the 10 most recent active concepts for this profile, summarizes openRate = openCount / max(reachCount, 1)
- Queries `discoveryCandidate` for the 5 most recent additions (for "new catalog" signal)
- Derives `mediaTypeBalance` from viewing events
- Derives `runtimePreference` from median completed runtime vs. abandoned runtime
- Sets `coldStart = true` when `profileTaste.signalCount < 3`
- Caps all string lists to prevent prompt injection (max 100 chars per entry, existing pattern from Lab page)

**`generateConcepts(profileId: string | null, opts?: { count?: number }): Promise<ShelfConcept[]>`**
- Builds `ShelfConceptProfileContext`
- Computes how many concepts of each `generationType` to request based on config ratios
- Calls OpenAI with the prompt template (same provider pattern as `OpenAiLlmPlannerProvider`)
- Parses and zod-validates the JSON array response
- For each candidate concept, calls `validateConcept`; discards failures with a warning log
- Persists validated concepts via `db.insert(shelfConcepts)`
- Returns persisted rows

**`validateConcept(concept: RawConcept, profileId: string | null, existingConcepts: ShelfConcept[]): ValidationResult`**
- Schema check: required fields present, `generationType` in allowed enum, non-empty strings
- Semantic dedup: embed `concept.semanticIntent` via `EmbeddingService.embedText`, compute cosine similarity against `existingConcepts` embeddings already in session; reject if max similarity > `SHELF_CONCEPT_SEMANTIC_DEDUP_THRESHOLD`
- For profile concepts: reject if concept intent is too similar to a recent concept with `dismissCount > openCount * 2` (persistently ignored)
- Dry-run retrieval: call `SemanticRetrievalService.retrieve(concept.semanticIntent, 5)`; reject if fewer than 3 candidates returned

**`getActivePool(profileId: string): Promise<ShelfConcept[]>`**
- Returns active, non-expired concepts ordered by `createdAt desc`

**`needsRefresh(profileId: string): Promise<boolean>`**
- Returns true if: active pool < `SHELF_CONCEPT_MIN_POOL_SIZE`, or oldest concept `createdAt` > `SHELF_CONCEPT_TTL_HOURS` ago, or profile taste `builtAt` is newer than newest concept `createdAt`

**`applyFeedback(conceptId: string, signal: 'good' | 'bad'): Promise<void>`**
- Increments `openCount` for 'good', `dismissCount` for 'bad' on the concept row (Lab-only manual path; production feedback flows through interaction events)

### 5. Configuration — `apps/api/src/config/env.ts`

Add exports:
```
SHELF_CONCEPT_PERSONALIZED_RATIO   default 0.70
SHELF_CONCEPT_EXPLORATION_RATIO    default 0.20
SHELF_CONCEPT_DISCOVERY_RATIO      default 0.10
SHELF_CONCEPT_BATCH_SIZE           default 20
SHELF_CONCEPT_TTL_HOURS            default 48
SHELF_CONCEPT_MIN_POOL_SIZE        default 8
SHELF_CONCEPT_SEMANTIC_DEDUP_THRESHOLD  default 0.85
SHELF_CONCEPT_LLM_MODEL            default gpt-4o-mini (inherits LLM_PLANNER_MODEL if unset)
```

Ratios are read as floats and normalized to sum to 1 at startup, with a warning if they don't.

### 6. Routes — `apps/api/src/routes/shelf-concepts.ts`

```
POST /shelf-concepts/generate     body: GenerateShelfConceptsBody   → GenerateShelfConceptsResponse
GET  /shelf-concepts              query: profileId                  → ShelfConcept[]
POST /shelf-concepts/:id/feedback body: ShelfConceptFeedbackBody    → 204
```

`POST /generate`:
- Calls `needsRefresh(profileId)` — if false, returns current pool without calling LLM
- Otherwise calls `generateConcepts`, returns new pool plus profile context

Register router in `apps/api/src/server.ts` (same pattern as existing routes).

### 7. Lab UI — `apps/web/src/pages/RecommendationLabPage.tsx`

Add a new "Shelf Concepts" tab alongside the existing recommendation lab tabs:

- **Profile picker** — dropdown of profiles (reuse any existing profile selector component)
- **Profile context panel** — expandable JSON view of `ShelfConceptProfileContext` returned from `POST /shelf-concepts/generate`
- **Generate button** with count input (default 20) — calls the API, shows loading state
- **Concept list** — for each concept:
  - Title, `generationType` badge (color-coded), reason codes chips
  - `desiredMediaTypes`, `freshnessPolicy`
  - **Preview button** — calls semantic retrieval + ranking with concept's `semanticIntent`, shows top 5 results inline with score breakdown (reuses existing `SemanticRetrievalService` call pattern from the lab)
  - **Good / Bad flag buttons** — call `POST /shelf-concepts/:id/feedback`
- Cold-start profiles are visually flagged

No new page/route — extend the existing `RecommendationLabPage.tsx`.

### 8. Tests

- `apps/api/src/services/__tests__/shelf-concept-generator-service.test.ts`
  - `buildProfileContext`: warm profile → context includes taste signals; cold profile → `coldStart: true`, no personal signals in output
  - `validateConcept`: schema failure → rejected; dry-run returns < 3 candidates → rejected; cosine similarity above threshold → rejected
  - `needsRefresh`: pool below min → true; pool fresh and large → false
  - `generateConcepts`: two profiles with different taste histories → materially different concept sets (mock LLM provider, verify distinct `rawIntent` distributions and `generationType` mixes)

## Excluded

- Modifying the Home screen to actually consume the concept pool (separate ticket)
- Automatic background pool refresh daemon or cron job — refresh is triggered on `POST /shelf-concepts/generate` guard only
- Dedicated `ShelfConceptPerformance` event table — performance is tracked via aggregated counters on the concept row; full event granularity is out of scope
- ShelfInstance history deduplication at the instance level (tracked in the dedicated history ticket per the ticket description)
- Anchor media IDs in concept output — the ticket mentions them only when IDs are supplied in context; no anchor ID injection is implemented here since the context builder does not pass specific media IDs
- Generating concepts for null profileId (editorial) in the API — the DB schema supports it but the route requires a valid profileId

## Acceptance criteria

- `shelfConcepts` table exists with all columns; Drizzle migration runs cleanly on a fresh DB.
- `POST /shelf-concepts/generate` with a warm Profile returns ≥ 8 concepts covering all three `generationType` buckets (PERSONALIZED, EXPLORATION, DISCOVERY); ratios reflect config defaults.
- `POST /shelf-concepts/generate` with the same warm Profile a second time within TTL returns the cached pool without an LLM call (log confirms no provider call).
- `POST /shelf-concepts/generate` for a cold-start Profile (signalCount = 0) returns concepts with `coldStart: true`; no personal taste signals appear in the logged prompt.
- Two profiles with materially different taste histories produce concept sets with distinct `rawIntent` values and at least two different top genres represented across the two sets.
- A concept whose dry-run retrieval returns fewer than 3 candidates is not persisted (observable via test and/or debug log).
- A concept whose `semanticIntent` similarity exceeds threshold against an existing concept in the batch is not persisted.
- `POST /shelf-concepts/:id/feedback` with `signal: bad` increments `dismissCount` on the DB row.
- Lab UI renders a Shelf Concepts tab; for a chosen Profile it shows the profile context JSON, a list of generated concepts with badges, and a working Preview that returns ranked media results.
- `SHELF_CONCEPT_PERSONALIZED_RATIO`, `SHELF_CONCEPT_EXPLORATION_RATIO`, `SHELF_CONCEPT_DISCOVERY_RATIO` are read from env; changing the ratios changes the distribution in the next generation run.
- All new service functions are covered by the unit tests listed in §8; tests pass with `pnpm test`.
