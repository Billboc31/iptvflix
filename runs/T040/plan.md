Now I have enough context to write the plan. Let me produce it.

## Objective

Build a deterministic, explainable per-profile taste model derived from explicit feedback (like/dislike/not-interested), viewing-progress completion, and watchlist signals, stored in a new `profile_taste` table and exposed via a read/rebuild API endpoint.

## Included

### 1. New DB schema — `apps/api/src/db/schema/profile-taste.ts`

New Drizzle table `profile_taste`:

| Column | Type | Notes |
|---|---|---|
| `profileId` | uuid PK, FK → profiles.id, cascade delete | one row per profile |
| `genreScores` | jsonb not null default `'{}'` | `{ [genreId: string]: number }` |
| `genreMeta` | jsonb not null default `'{}'` | `{ [genreId: string]: { slug, name } }` for human-readable output |
| `positiveMediaIds` | text[] not null default `'{}'` | mediaIds with net positive score |
| `negativeMediaIds` | text[] not null default `'{}'` | mediaIds with DISLIKE or NOT_INTERESTED |
| `signalCount` | integer not null default 0 | total raw signals consumed |
| `builtAt` | timestamp with TZ not null | set to now() on every rebuild |

Export from `apps/api/src/db/schema/index.ts`.

### 2. Drizzle migration

Generate a new numbered migration file under `apps/api/drizzle/` (follow existing chain) creating the `profile_taste` table.

### 3. API contract type — `packages/api-contracts/src/taste.ts`

```ts
export type GenreScore = {
  genreId: string;
  slug: string;
  name: string;
  score: number;
};

export type ProfileTaste = {
  profileId: string;
  genreScores: GenreScore[];       // sorted descending by score, zeros omitted
  positiveMediaIds: string[];
  negativeMediaIds: string[];
  signalCount: number;
  builtAt: string;                 // ISO timestamp
};
```

Export from `packages/api-contracts/src/index.ts`.

### 4. Service — `apps/api/src/services/profile-taste-service.ts`

**Signal weights (constants, exported for test assertions):**

| Signal | Weight |
|---|---|
| `LIKE` | +3 |
| `DISLIKE` | −3 |
| `NOT_INTERESTED` | −2 |
| Completed view (progress ≥ 90 %) | +1 |
| In-progress view (5 % ≤ progress < 90 %) | +0.5 |
| Watchlist entry | +0.5 |

**Algorithm for `buildTaste(profileId)`:**

1. Fetch all explicit feedback rows for the profile.
2. Fetch all viewing-progress rows for the profile; classify as completed (≥ 90 %) or in-progress (5 %–90 %); skip < 5 %.
3. Fetch all watchlist rows for the profile.
4. For each signal row, resolve the canonical media item:
   - `MOVIE` / SERIES mediaType → fetch from `movies` / `series`.
   - `EPISODE` mediaType (progress only) → join `episodes → seriesId` then use the parent series.
5. For each resolved media item, load its genres via `movie_genres` / `series_genres`.
6. For each genre, accumulate `genreScores[genreId] += weight`.
7. Collect `positiveMediaIds` (LIKE, completed view) and `negativeMediaIds` (DISLIKE, NOT_INTERESTED).
8. Build `ProfileTaste`; omit genres with score 0; sort by score descending.
9. Upsert into `profile_taste` (update on conflict by `profileId`).
10. Return the built taste.

**Cold-start**: if the profile has no signals, steps 1–3 return empty arrays → `signalCount = 0`, all lists empty → valid minimal taste stored and returned, no error thrown.

**Determinism**: no randomness; sorting is by numeric score then by `genreId` as tiebreaker (stable sort).

**Exported functions:**

- `buildTaste(profileId: string): Promise<ProfileTaste>` — always rebuilds from source signals and persists.
- `getTaste(profileId: string): Promise<ProfileTaste>` — returns stored row if present, otherwise calls `buildTaste`.

### 5. Route — `apps/api/src/routes/taste.ts`

| Method | Path | Handler |
|---|---|---|
| `GET` | `/taste` | calls `getTaste(defaultProfileId)`, returns 200 with `ProfileTaste` |
| `POST` | `/taste/rebuild` | calls `buildTaste(defaultProfileId)`, returns 200 with `ProfileTaste` |

Register in the existing app entry point alongside other routes.

### 6. Tests — `apps/api/src/services/__tests__/profile-taste-service.test.ts`

Vitest + `vi.mock('../../db/client.js')`. Cover:

- **Positive-only**: profile has a LIKE → genre score positive, mediaId in positiveMediaIds.
- **Negative-only**: DISLIKE → genre score negative, mediaId in negativeMediaIds.
- **Mixed**: LIKE on one item, DISLIKE on another sharing a genre → net score is +3 − 3 = 0, genre omitted from output.
- **Weak signals do not equal LIKE**: a completed-view (+1) produces a lower genre score than a LIKE (+3).
- **Sparse / cold-start**: no signals → signalCount 0, empty arrays, no throw.
- **Idempotency / repeated rebuild**: calling `buildTaste` twice with identical mocked signal data returns equivalent output.
- **Episode progress** resolves to parent series genres.
- **SIGNAL_WEIGHTS constant** is exported and matches expected values.

### 7. Tests — `apps/api/src/routes/__tests__/taste.test.ts`

Fastify `app.inject()`. Cover:

- `GET /taste` returns 200 with valid `ProfileTaste` shape.
- `POST /taste/rebuild` calls `buildTaste` and returns 200.
- Cold-start response is valid (not 500, not 404).

## Excluded

- Final recommendation ranking or candidate selection.
- LLM-generated taste descriptions (any runtime LLM call).
- UI changes or frontend taste display.
- Multi-profile support beyond the existing default profile (no profileId path param).
- Any change to existing services (feedback, watchlist, viewing-progress, catalog).
- Cast/crew or mood signals (not in current schema).
- Taste-score invalidation triggers on write (automatic rebuild on feedback mutation) — left to a follow-up ticket.
- Netflix scraping or external import.

## Acceptance criteria

1. `GET /taste` returns HTTP 200 with a `ProfileTaste` object matching the contract type (all required fields present, correct types).
2. A profile with a LIKE on a genre-tagged movie has a positive `genreScores` entry for that genre; a DISLIKE produces a negative entry. The absolute value for LIKE (3) is greater than a completed-view score (1).
3. A profile with only watchlist/in-progress entries has lower genre scores than one with explicit LIKEs on the same content.
4. Two sequential calls to `buildTaste` with the same underlying signal data return `ProfileTaste` objects with identical `genreScores`, `positiveMediaIds`, `negativeMediaIds`, and `signalCount`.
5. A profile with no signals returns `{ signalCount: 0, genreScores: [], positiveMediaIds: [], negativeMediaIds: [] }` with a valid `builtAt` — no 4xx/5xx response.
6. `genreScores` entries reference `genreId` and `slug` values from the canonical `genres` table, not provider-specific identifiers.
7. All test scenarios listed in §6 and §7 pass under `vitest run`.
