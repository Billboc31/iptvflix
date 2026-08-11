## Objective

Extend the title-normalization pipeline and availability schema to extract, store, and expose audio language, subtitle language, and video quality as normalized attributes on each Availability variant, so that multiple provider entries for the same canonical work are surfaced as distinct playback variants under one catalog card rather than as duplicate entries.

## Included

### 1. New module — `apps/api/src/matching/variant-extractor.ts`

Pure function `extractVariantAttributes(raw: string): VariantAttributes` that scans the raw provider title string before any stripping and returns:

```typescript
export interface VariantAttributes {
  audioLanguage: 'fr' | 'en' | null   // null = unknown, multi, or not applicable
  subtitleLanguage: 'fr' | null        // null = unknown or none
  videoQuality: '4K' | '1080p' | '720p' | '480p' | null
}
```

Normalization rules (applied via the existing `RELEASE_TAGS_SOURCE` patterns as reference):

| Tag(s)                         | audioLanguage | subtitleLanguage |
|--------------------------------|---------------|-----------------|
| `FRENCH` / `TRUEFRENCH` / `VFF` / `VF` | `'fr'`   | `null`          |
| `ENG`                          | `'en'`        | `null`          |
| `VOSTFR`                       | `null`        | `'fr'`          |
| `MULTI` / `MULTi` / `VO` / `VOST` / `VOFF` / unknown | `null` | `null` |

Video quality:

| Tag(s)              | videoQuality |
|---------------------|-------------|
| `4K` / `UHD` / `2160p` | `'4K'`  |
| `1080p`             | `'1080p'`   |
| `720p`              | `'720p'`    |
| `480p`              | `'480p'`    |
| `HD` / `SD` / absent | `null`    |

Unknown, ambiguous, or absent tags → all fields `null` (never guess).

### 2. Extend `NormalizeResult` — `apps/api/src/matching/title-normalizer.ts`

- Add `variantAttributes: VariantAttributes` to the `NormalizeResult` interface.
- Call `extractVariantAttributes(raw)` at the top of `normalizeTitle`, before any stripping, and include the result in the return value.
- No change to normalization logic itself.

### 3. Schema additions — `apps/api/src/db/schema/availabilities.ts`

Add four nullable `text` columns to all three tables (`movieAvailabilities`, `seriesAvailabilities`, `episodeAvailabilities`):

| Column (DB)        | Field (Drizzle)   | Purpose                                      |
|--------------------|-------------------|----------------------------------------------|
| `audio_language`   | `audioLanguage`   | Normalized audio language code or null       |
| `subtitle_language`| `subtitleLanguage`| Normalized subtitle language code or null    |
| `video_quality`    | `videoQuality`    | Normalized quality tier or null              |
| `raw_title`        | `rawTitle`        | Original provider title, preserved verbatim  |

No changes to existing unique constraints — the `(providerId, providerItemId)` uniqueness remains correct: each provider item maps to exactly one canonical Media, and variants from the same provider appear as separate items with distinct `providerItemId` values.

### 4. Drizzle migration

Run `pnpm drizzle-kit generate` after the schema change to produce a new migration file under `apps/api/src/db/migrations/`. Commit the generated SQL. Existing rows will have all four new columns as `NULL` — no backfill is required.

### 5. Update `apps/api/src/services/catalog-sync-service.ts`

When upserting availability rows, populate the four new columns:
- `rawTitle` ← the original provider stream `name` string.
- `audioLanguage`, `subtitleLanguage`, `videoQuality` ← from `normalizeTitle(rawTitle).variantAttributes`.

### 6. API contract additions — `packages/api-contracts/src/catalog.ts`

Add:

```typescript
export type AvailabilityVariantResponse = {
  id: string
  audioLanguage: string | null
  subtitleLanguage: string | null
  videoQuality: string | null
  rawTitle: string | null
}
```

Extend detail types:

- `MovieDetailResponse`: add `variants: AvailabilityVariantResponse[]`
- `SeriesDetailResponse`: add `variants: AvailabilityVariantResponse[]`
- `EpisodeResponse`: add `variants: AvailabilityVariantResponse[]`

List types (`MovieResponse`, `SeriesResponse`) are unchanged — catalog/search results remain one card per canonical Media.

The `quality: string | null` field already present on `MovieResponse` will now be populated by deriving the best non-null `videoQuality` across a movie's variants (`'4K'` > `'1080p'` > `'720p'` > `'480p'` > `null`), replacing the current hard-coded `null`.

### 7. Update `apps/api/src/services/catalog-service.ts`

- **Detail queries** (movie, series): LEFT JOIN the corresponding availabilities table on the media ID; aggregate into `variants: AvailabilityVariantResponse[]`.
- **Episode queries**: same JOIN on `episodeAvailabilities`.
- **List queries**: derive `quality` from the ranked best `videoQuality` across that movie's availability rows.

### 8. Update `apps/api/src/routes/catalog.ts`

Wire `variants` into all detail response construction. No new routes — existing detail endpoints return the extended response shape.

### 9. Tests

**New — `apps/api/src/matching/__tests__/variant-extractor.test.ts`:**

- `FRENCH` → `{ audioLanguage: 'fr', subtitleLanguage: null, videoQuality: null }`
- `TRUEFRENCH` → `{ audioLanguage: 'fr', subtitleLanguage: null, videoQuality: null }`
- `VFF` → `audioLanguage: 'fr'`
- `VF` → `audioLanguage: 'fr'`
- `ENG` → `{ audioLanguage: 'en', subtitleLanguage: null, videoQuality: null }`
- `VOSTFR` → `{ audioLanguage: null, subtitleLanguage: 'fr', videoQuality: null }`
- `MULTI` / `MULTi` → `{ audioLanguage: null, subtitleLanguage: null, videoQuality: null }`
- `VO` → `audioLanguage: null`
- `VOST` → `subtitleLanguage: null`
- `1080p` → `videoQuality: '1080p'`
- `2160p` / `4K` / `UHD` → `videoQuality: '4K'`
- `720p` → `videoQuality: '720p'`
- `HD` / `SD` → `videoQuality: null`
- Combination `TRUEFRENCH.1080p` → `{ audioLanguage: 'fr', subtitleLanguage: null, videoQuality: '1080p' }`
- Combination `VOSTFR.4K.HDR` → `{ audioLanguage: null, subtitleLanguage: 'fr', videoQuality: '4K' }`
- No recognizable tag → `{ audioLanguage: null, subtitleLanguage: null, videoQuality: null }`

**Update — `apps/api/src/matching/__tests__/title-normalizer.test.ts`:**

Assert that `normalizeTitle` returns `variantAttributes` in all existing test cases. Existing `normalizedTitle` / `extractedYear` assertions remain unchanged.

**Update — `apps/api/src/routes/catalog.test.ts`:**

- Movie detail response includes `variants` array.
- Two `movieAvailabilities` rows for the same movie (e.g. one `FRENCH 1080p`, one `MULTI 4K`) produce two entries in `variants` with correct attributes.
- Movie list response still has one card per canonical movie (deduplication preserved).
- `VOSTFR` row → variant has `subtitleLanguage: 'fr'`, `audioLanguage: null`.
- `MULTI` row → variant has `audioLanguage: null`, `subtitleLanguage: null`.
- `quality` on list response reflects best quality from variants.

## Excluded

- Automatic variant selection for playback (user preference matching).
- Media player implementation.
- Audio/subtitle probing of stream bytes.
- Any modification to the canonical matching confidence logic or scoring thresholds.
- Language-based or subtitle-based filtering parameters on list endpoints.
- HDR/Dolby Vision as a first-class stored attribute (tags stripped by normalizer; no DB column for HDR in this ticket).
- Backfill of existing availability rows that predate this change (old rows keep all new columns as `NULL`).
- Codec or audio-format normalization (DTS, TrueHD, etc.) — out of scope for this ticket.

## Acceptance criteria

- `extractVariantAttributes('Dune.FRENCH.1080p')` returns `{ audioLanguage: 'fr', subtitleLanguage: null, videoQuality: '1080p' }`.
- `extractVariantAttributes('Avatar.VOSTFR.4K')` returns `{ audioLanguage: null, subtitleLanguage: 'fr', videoQuality: '4K' }`.
- `extractVariantAttributes('Movie.MULTI.2160p')` returns `{ audioLanguage: null, subtitleLanguage: null, videoQuality: '4K' }`.
- `extractVariantAttributes('Film.TRUEFRENCH')` returns `audioLanguage: 'fr'`, never `subtitleLanguage: 'fr'`.
- `normalizeTitle` returns `variantAttributes` alongside `normalizedTitle` and `extractedYear`; existing normalization behaviour is unchanged.
- `movieAvailabilities`, `seriesAvailabilities`, and `episodeAvailabilities` tables have columns `audio_language`, `subtitle_language`, `video_quality`, and `raw_title`.
- Drizzle migration generated and committed; `pnpm drizzle-kit push` (or equivalent) applies cleanly.
- Catalog-sync upsert stores `rawTitle` and variant attributes for each provider item.
- `GET /movies/:id` response includes `variants: [...]` with at least one entry per active availability.
- Two provider items matching the same canonical movie appear as two entries in `variants`, not as two separate movies in `GET /movies`.
- `GET /movies` list `quality` field reflects the best quality from that movie's variant rows (non-null when at least one variant has a known quality).
- All new and updated tests pass under `pnpm test`.
- `VOSTFR` variant has `audioLanguage: null` and `subtitleLanguage: 'fr'` — it is never stored with French audio.
- `MULTI` variant has `audioLanguage: null` — no specific language is asserted.
- Unknown or absent language/quality tags produce `null`, never a guessed value.
