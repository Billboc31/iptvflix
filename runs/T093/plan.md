# Plan — T093: Preserve and display useful provider variant labels

## Objective

Expose human-readable source display names and richer provider metadata (codec, HDR, release hint, audio format) in every variant selector, replacing raw UUID `providerId` labels. A single shared formatter in the frontend will build variant labels from stored structured fields.

## Included

### 1. DB schema — `apps/api/src/db/schema/availabilities.ts`
Add four nullable `text` columns to all three availability tables (`movieAvailabilities`, `seriesAvailabilities`, `episodeAvailabilities`):
- `codecName` — e.g. `h264`, `h265`, `HEVC`
- `hdrFormat` — e.g. `HDR10`, `DV`, `HLG`
- `releaseHint` — e.g. `WEB-DL`, `BluRay`, `HDCAM`
- `audioFormat` — e.g. `MULTI`, `STEREO`, `ATMOS`, `DTS`

Write one SQL migration file in `apps/api/src/db/migrations/` for all three tables.

### 2. Variant extractor — `apps/api/src/matching/variant-extractor.ts`
Extend `extractVariantAttributes()` to return four new fields alongside the existing ones:
- `codecName`: detect `H.265`, `HEVC`, `x265`, `H.264`, `x264`, `AVC` tokens
- `hdrFormat`: detect `HDR10`, `HDR`, `DolbyVision`, `DV`, `HLG` tokens
- `releaseHint`: detect `WEB-DL`, `WEBRip`, `BluRay`, `HDCAM`, `HDTV`, `CAM` tokens
- `audioFormat`: detect `MULTI`, `STEREO`, `5.1`, `Atmos`, `DTS`, `TrueHD` tokens

All extractions are case-insensitive, regex-based. No new dependencies.

### 3. Ingestion — `apps/api/src/services/catalog-sync-service.ts`
For Xtream and M3U availability upserts (all six call sites — movie/series/episode × Xtream+M3U), pass the four new fields from `extractVariantAttributes()` into the upsert payload alongside the existing `audioLanguage`, `subtitleLanguage`, `videoQuality`.

Plex: no change — Plex provider data is already clean and provides no raw variant names to parse.

### 4. Backfill script — `apps/api/src/scripts/backfill-variant-metadata.ts`
One-shot script that:
- Reads all availability rows where `rawTitle IS NOT NULL` and at least one new column is `NULL`
- Runs `extractVariantAttributes(rawTitle)` for each row
- Writes back `codecName`, `hdrFormat`, `releaseHint`, `audioFormat` where values were extracted
- Skips rows where `rawTitle` is null or all four fields already have values
- Designed to be re-runnable safely (no-op on already-enriched rows)
- Documented in `README` or package script entry

### 5. API contract — `packages/api-contracts/src/catalog.ts`
Extend `AvailabilityVariantResponse` with:
```ts
sourceDisplayName: string | null   // from Source.name
codecName:         string | null
hdrFormat:         string | null
releaseHint:       string | null
audioFormat:       string | null
```
`providerId` remains in the type for internal use but is no longer the displayed label.

### 6. API routes — `apps/api/src/routes/catalog.ts`
For all detail endpoints that return availability variants (movie detail, series detail, episode list), join the `sources` table and map `Source.name` → `sourceDisplayName` in the response. This applies to the three availability select queries in this file.

### 7. Shared formatter — `apps/web/src/lib/variant-label.ts` (new file)
Export a single `formatVariantLabel(v: AvailabilityVariantResponse): string` function.

Label assembly order (parts separated by ` • `):
1. Audio language — human-readable via `getLanguageName()` (e.g. `Français`, `Multi`)
2. Subtitle hint — only if subtitle language differs from audio (e.g. `sous-titres FR`)
3. Video quality — e.g. `4K`, `1080p`, `720p`
4. HDR format if present — e.g. `HDR10`, `Dolby Vision`
5. Release hint if present and useful — e.g. `Blu-ray`, `WEB-DL`
6. `sourceDisplayName` — only appended when needed to distinguish two otherwise identical labels (detected by comparing the label-without-source against other variants in the set)

Fallback when all fields null: use `rawTitle` if present, otherwise `'Source inconnue'`. Never show `providerId`.

The function accepts an optional second argument `variants: AvailabilityVariantResponse[]` used for the source-disambiguation check.

### 8. UI components
- `apps/web/src/components/detail/AvailabilityPanel.tsx`: replace inline `variantLabel()` with `formatVariantLabel(v, variants)`
- `apps/web/src/components/player/PlayerControls.tsx`: replace inline `variantLabel()` with `formatVariantLabel(v, variants)`

Both files import from `@/lib/variant-label`.

### 9. Tests
- `apps/web/src/lib/variant-label.test.ts`: covers representative dirty Xtream names mapped to expected clean labels; source disambiguation; all-null fallback; `rawTitle` fallback
- `apps/api/src/matching/variant-extractor.test.ts`: extend existing tests with codec, HDR, release, audio extraction cases

## Excluded

- Fetching codec/bitrate from Plex Media API stream-level metadata (separate provider enhancement ticket)
- Bitrate/kbps storage — not reliably extractable from Xtream display names
- Changing the canonical TMDB movie/series title or the normalization/matching pipeline
- Language detection beyond what regex token matching provides (no NLP/ML)
- Removing `providerId` from the API contract (kept for internal resolver use)
- UI redesign of variant selectors beyond updating the label string
- Multi-language label localization beyond the existing `getLanguageName()` utility

## Acceptance criteria

- `movieAvailabilities`, `seriesAvailabilities`, `episodeAvailabilities` tables each have `codecName`, `hdrFormat`, `releaseHint`, `audioFormat` columns after migration.
- `extractVariantAttributes('4K-FR - Dune (2021)')` returns `{ audioLanguage: 'fr', videoQuality: '4K', … }` with no UUID in result.
- `extractVariantAttributes('DUNE.MULTI.1080P.BluRay')` returns `{ audioFormat: 'MULTI', videoQuality: '1080p', releaseHint: 'BluRay' }`.
- `AvailabilityVariantResponse` includes `sourceDisplayName`, `codecName`, `hdrFormat`, `releaseHint`, `audioFormat` and never exposes raw UUID as a user-visible label field.
- Movie detail and episode detail API responses include `sourceDisplayName` populated from `Source.name`.
- `formatVariantLabel` is the only variant label formatter in the frontend codebase; no other component defines its own inline formatter.
- `AvailabilityPanel` and `PlayerControls` both call `formatVariantLabel` with the full variants array.
- No UUID-shaped string (`[0-9a-f-]{36}`) appears as rendered text in a variant selector in the browser.
- Backfill script runs without errors on a database that has existing availability rows; rows with `rawTitle` data gain populated metadata columns.
- New source syncs populate all four new columns from extracted metadata.
- `variant-label.test.ts` passes with at least the three Xtream example cases from the ticket description producing correct clean labels.
