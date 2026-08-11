# T005 — Implementation Output

## State: IMPLEMENTATION_DONE

## Summary

Implemented the Xtream Codes provider adapter inside `apps/api/src/providers/xtream/`.

Branch was first rebased onto `origin/main` (which includes T001–T004) to obtain the API foundation.

## Files created

- `apps/api/src/providers/xtream/types.ts` — Provider-layer DTOs: XtreamUserInfo, XtreamCategory, XtreamVodStream, XtreamSeries, XtreamSeriesDetail, XtreamEpisode, XtreamSeriesInfo, XtreamCatalogSnapshot
- `apps/api/src/providers/xtream/errors.ts` — XtreamAuthError, XtreamNetworkError, XtreamParseError (all extend Error, distinct via instanceof)
- `apps/api/src/providers/xtream/client.ts` — XtreamCodesClient class with authenticate(), getVodCategories(), getVodStreams(), getSeriesCategories(), getSeries(), getSeriesInfo(); sanitizeUrl() redacts credentials from error messages
- `apps/api/src/providers/xtream/index.ts` — Barrel re-export
- `apps/api/src/providers/xtream/__tests__/client.test.ts` — 22 Vitest fixture-based tests
- `apps/api/src/providers/xtream/__tests__/fixtures/account-info.json`
- `apps/api/src/providers/xtream/__tests__/fixtures/vod-categories.json`
- `apps/api/src/providers/xtream/__tests__/fixtures/vod-streams.json`
- `apps/api/src/providers/xtream/__tests__/fixtures/series-categories.json`
- `apps/api/src/providers/xtream/__tests__/fixtures/series-list.json`
- `apps/api/src/providers/xtream/__tests__/fixtures/series-info.json`
- `apps/api/src/providers/xtream/__tests__/fixtures/large-vod-streams.json` (5 000 entries, ~800 KB)

## Files modified

None — only the new `providers/xtream/` subtree was added, plus the merge commit bringing in origin/main.

## Verifications

- `pnpm --filter api test` → 22/22 provider tests pass (plus 18 existing tests pass; pre-existing `catalog-constraints.test.ts` fails due to missing DATABASE_URL — unrelated)
- `pnpm --filter api typecheck` → no errors in the new providers/xtream subtree (one pre-existing error in sources.test.ts from T004 unrelated to this ticket)
- Credentials never appear in error messages (XtreamNetworkError uses sanitizeUrl, XtreamParseError uses endpoint name only)
- XtreamAuthError, XtreamNetworkError, XtreamParseError are distinct classes
- XtreamCatalogSnapshot is the only boundary type; no Xtream DTO touches db/schema/, routes/, or services/
- Large catalog test (5000 items) completes in < 1s

## Known limits

- Type guards for arrays are structural (Array.isArray only) — individual field types are not validated at runtime. Sufficient for provider isolation boundary; a future hardening pass could add zod schemas.
- `sources.test.ts:297` has a pre-existing TypeScript error (`'M3U' not assignable to 'XTREAM'`) inherited from T004 — not introduced by this ticket.
