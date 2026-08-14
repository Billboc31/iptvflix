# T077 — Test Report (attempt 2)

## Verdict: PASS

All 9 acceptance criteria are satisfied. 31/31 playback-resolver tests pass. The 5 suite-level failures are pre-existing (unchanged files, not regressions).

---

## Acceptance Criteria

### ✅ Movie playback resolver uses Movie-specific Xtream VOD URL semantics
`buildXtreamMovieUrl` → `{base}/{user}/{pass}/{id}.{ext}` (no `/series/`).
Tests: `buildXtreamMovieUrl > produces the expected movie path format` ✓, `Xtream movie URL construction > uses mp4/mkv extension` ✓

### ✅ Episode playback resolver uses Episode-specific Xtream VOD URL semantics
`buildXtreamEpisodeUrl` → `{base}/series/{user}/{pass}/{id}.{ext}`.
Tests: `buildXtreamEpisodeUrl > includes /series/ prefix in the path` ✓, `Xtream episode URL construction > includes /series/ in the path for episodes` ✓

### ✅ Persisted `container_extension` is read and used
Both `fetchAvailabilities` branches (movie + episode) now select `containerExtension` from their respective tables and pass it to URL builders.
Schema confirmed: `container_extension` present at lines 26, 52, 78 of `availabilities.ts`.
Tests: `uses mp4 extension when containerExtension is mp4` ✓, `uses mkv extension` ✓, `uses containerExtension from explicitly selected availability` ✓

### ✅ Playback no longer forces `.ts` for every Xtream VOD item
`.ts` is fallback only when `containerExtension` is `null` or omitted.
Tests: mp4/mkv extension tests pass; fallback-to-ts tests pass ✓

### ✅ Episode playback uses the actual episode stream/provider item id
`playback-resolver.ts` passes `selected.providerItemId` (from `episodeAvailabilities`) directly to `buildXtreamEpisodeUrl`. No series catalog ID substitution.
Test: episode URL contains the providerItemId `200` → `200.mp4` ✓

### ✅ Existing language/quality variant selection still works
Auto-resolution via `resolveVariant` and explicit `availabilityId` both exercised.
Tests: `picks the highest-quality variant when multiple are available` ✓, `accepts a valid explicit availabilityId` ✓

### ✅ Invalid/unavailable variants produce actionable errors
- Unknown `availabilityId` → `NotFoundError` ✓
- `status: UNAVAILABLE` → `ValidationError` ✓
- Disabled source (explicit) → `ForbiddenError` ✓
- Disabled source (auto) → `ValidationError` ✓
- No available variants → `ValidationError` ✓

### ✅ Logs do not expose Xtream credentials
The `console.error` on unknown-source fallthrough logs only: `mediaType`, `mediaId`, `availabilityId`, `providerId`, `providerItemId`, `containerExtension`. No `username`/`password`.
Tests: `buildXtreamMovieUrl > does not log credentials` ✓, `secret redaction > does not log the streamUrl containing credentials` ✓

### ✅ Automated tests prove generated playback targets for Movies and Episodes
31 tests in `apps/api/src/services/__tests__/playback-resolver.test.ts`:
- Movie URL with mp4/mkv/null-fallback extension ✓
- Episode URL with `/series/` prefix and extension ✓
- Missing extension fallback (null → ts) ✓
- Explicit availability selection with extension ✓
- Disabled source / UNAVAILABLE variant errors ✓
- M3U passthrough ✓
- Resume position ✓

---

## Test Execution Results

```
pnpm exec vitest run src/services/__tests__/playback-resolver.test.ts
 Test Files  1 passed (1)
      Tests  31 passed (31)
   Duration  397ms
```

Full suite (pre-existing failures, not regressions):
```
Test Files  3 failed | 54 passed (57)
      Tests  5 failed | 769 passed (774)
```

Failed files: `vertical-slice.test.ts` (MSW/timing issues), `title-matching-service.test.ts` (mock behavior mismatch).
None of these files are in the T077 diff. Pre-existing on `main`.

---

## Validation Limits

- URL construction validated via pure unit tests and mocked-DB integration tests. No live Xtream server used.
- `provider_item_id` correctness for real Xtream episode stream ids confirmed at schema level; not validated against a live provider catalog (out of ticket scope).
- Base URL normalization: trailing-slash stripping tested ✓; no explicit tests for port variants or http→https coercion (implementation uses a simple `replace(/\/$/, '')` which is correct for all valid URLs).
