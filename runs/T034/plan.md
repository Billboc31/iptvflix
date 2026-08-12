## Objective

Replace the quality-clamping approach in the availability resolver with a hard pre-filter that excludes any variant whose quality is known and exceeds `maxVideoQuality`, so that an above-cap variant can never win the selection — including via ID tie-break.

## Included

### `apps/api/src/services/availability-resolver.ts`

- **Remove `maxVideoQuality` parameter from `qualityRank`** — clamping is no longer needed once above-cap variants are pre-filtered. Simplify signature to `qualityRank(quality: string | null): number`, returning `QUALITY_ORDER[quality] ?? -1` for non-null, `-1` for null.
- **Add `isAboveCap(quality: string | null, maxVideoQuality: string | null): boolean`** — returns `true` only when `maxVideoQuality` is set, the variant quality is a known value in `QUALITY_ORDER`, and its rank strictly exceeds the cap rank. Null/unknown quality always returns `false` (kept as fallback).
- **Add pre-filter step in `resolveVariant`** — after filtering to `AVAILABLE` variants, apply `isAboveCap` to produce the final candidate list. If no candidates remain (all above cap, no null/unknown), return `{ resolvedVariantId: null, reason: 'no_available_variant', alternatives: [] }`.
- **Update `scoreTuple`** — remove the `maxVideoQuality` argument from the `qualityRank` call (signature change above).

### `apps/api/src/services/__tests__/availability-resolver.test.ts`

Rewrite and extend the `maxVideoQuality` section (currently lines 135–161):

| Test | Expected outcome |
|---|---|
| cap=1080p, candidates: 4K + 1080p | 1080p wins; 4K absent from result |
| cap=1080p, candidates: 4K only (known) | null result (no_available_variant) |
| cap=1080p, candidates: 4K + unknown-quality | unknown-quality wins as fallback |
| cap=720p, candidates: 4K + 1080p + 720p | 720p wins |
| cap=null, candidates: 4K + 1080p | 4K wins (no-limit behavior unchanged) |
| cap=1080p, candidates: 1080p + 720p | 1080p wins (best at or below cap) |
| unknown cap string (e.g. "HDR") | treated as unknown → Infinity → no filtering |

Existing language/source/subtitle priority tests must continue to pass without modification.

## Excluded

- Frontend changes — the frontend already delegates resolution to the backend; no duplication exists to remove.
- Changes to `QUALITY_ORDER` definition or its location — it is already consistent across the resolver.
- Changes to profile validation in `apps/api/src/routes/profile.ts` — `VALID_QUALITIES` already rejects unknown strings at the API boundary.
- Database schema or migration changes — `maxVideoQuality` is already stored as nullable text.
- Catalog display helpers (`bestQuality` in `catalog.ts` / `catalog-service.ts`) — unrelated to resolution logic.
- Deduplicating `QUALITY_ORDER` across files — out of scope for this ticket.

## Acceptance criteria

- `resolveVariant` with `maxVideoQuality = '1080p'` and candidates `[4K, 1080p]` returns the 1080p variant's ID regardless of which ID sorts first alphabetically.
- `resolveVariant` with `maxVideoQuality = '1080p'` and candidates `[4K only]` returns `null` (reason `no_available_variant`).
- `resolveVariant` with `maxVideoQuality = '1080p'` and candidates `[4K, unknown-quality]` returns the unknown-quality variant's ID.
- `resolveVariant` with `maxVideoQuality = null` and candidates `[4K, 1080p]` returns the 4K variant (no-limit behavior preserved).
- Caps `720p`, `1080p`, `4K` behave consistently: only variants at or below the cap are eligible.
- All pre-existing test cases (audio language, subtitle, source priority, tie-break, no-availability) continue to pass.
- `isAboveCap` has dedicated unit tests covering: known-above-cap, known-at-cap, known-below-cap, null quality, null cap, unknown quality string.
- `tsc --noEmit` reports no type errors.
