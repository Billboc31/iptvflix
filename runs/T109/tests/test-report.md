All 392 tests pass across 50 files. I have enough to write the report.

---

# T109 — Test Report

## Summary

**Automated tests: PASS — 392/392 (0 regressions)**  
**E2E manual validation: BLOCKED — requires human with dev server + real IPTV source**

---

## What changed (production code)

**None.** The investigation confirmed the architecture was structurally correct. The branch adds only regression tests:

| File | Nature | Tests added |
|---|---|---|
| `apps/api/src/__tests__/integration/vertical-slice.test.ts` | Integration tests | 2 episode slices |
| `apps/api/src/services/__tests__/playback-resolver.test.ts` | Unit tests | Episode variant selection + resume |

---

## Automated test results

| Suite | Result | Count |
|---|---|---|
| `playback-resolver.test.ts` | ✅ PASS | 35/35 |
| `vertical-slice.test.ts` | ✅ PASS | 14/14 |
| `variant-label.test.ts` | ✅ PASS | 15/15 |
| All other existing tests | ✅ PASS | 328/328 |
| **Total** | **✅ PASS** | **392/392** |

---

## Acceptance criteria status

### Automated (verifiable without a browser)

| Criterion | Status | How verified |
|---|---|---|
| Episode IDs canonical and stable | ✅ PASS | `vertical-slice`: `episodeRow.seriesId` matches `seriesAvailRow.seriesId`; UUID stable across DB roundtrip |
| Xtream episodes attached to correct Episode entity | ✅ PASS | `vertical-slice` episode slices: `episodeAvailabilities.episodeId === canonicalEpisodeId`, `providerItemId === '7001'/'8001'` |
| `episodeAvailabilities` filtered by `episodeId` not `seriesId` | ✅ PASS | Direct DB assertion: `eq(episodeAvailabilities.episodeId, ep1Id)` returns exactly 1 row |
| Multiple sources remain distinct availabilities | ✅ PASS | `playback-resolver` test: two variants (`ep-av-1` fr/1080p, `ep-av-2` en/720p) resolved independently |
| Source labels never fall back to bare UUID | ✅ PASS | `variant-label` test: "never returns a UUID-shaped string as label" |
| `sourceDisplayName` appended to disambiguate duplicate labels | ✅ PASS | `variant-label` test: "appends sourceDisplayName when two variants share the same base label" |
| Explicit `availabilityId` reaches resolver unchanged | ✅ PASS | `resolvePlayback('episode', episodeId, 'ep-av-2')` → `session.availabilityId === 'ep-av-2'` |
| Episode uses `/series/` URL path (not `/movie/`) | ✅ PASS | `buildXtreamEpisodeUrl` tests + session `mediaType: 'episode'` assertion |
| Credentials not leaked in response | ✅ PASS | `secret redaction` test; `JSON.stringify(session)` does not contain `secret_user`/`secret_pass` |
| Progress stored as `(profileId, 'EPISODE', episodeId)` | ✅ PASS | `vertical-slice`: `upsertProgress` → DB row has `mediaType='EPISODE'`, `mediaId=ep1Id` |
| `startPositionSeconds` returned from stored progress | ✅ PASS | `resolvePlayback` after `upsertProgress(300s)` → `session.startPositionSeconds === 300` |
| Episode-level watch state (`in_progress` / `unwatched`) | ✅ PASS | `vertical-slice`: ep1 → `in_progress`, ep2 → `unwatched` |
| UNAVAILABLE episode rejects playback | ✅ PASS | `resolvePlayback` throws `ValidationError` when all availabilities are `UNAVAILABLE` |
| Disabled source rejects playback | ✅ PASS | `resolvePlayback` throws `ForbiddenError` when source is disabled |
| Gateway URL issued (not raw provider URL) | ✅ PASS | `session.gatewayUrl` matches `/^\/playback\/stream\//` |
| No regressions in existing tests | ✅ PASS | 328 pre-existing tests unchanged, all pass |

### Manual E2E (cannot be validated without browser + real IPTV)

| Criterion | Status |
|---|---|
| Open series detail → select season → episode list loads | ⏳ PENDING — human required |
| Select episode → availability for that exact episode shown | ⏳ PENDING — human required |
| Multiple sources → variant selector with readable labels (not UUIDs) | ⏳ PENDING — human required |
| Press Play → correct episode streams | ⏳ PENDING — human required |
| Seek → exit → reopen → progress on correct episode | ⏳ PENDING — human required |
| Resume episode → resumes from saved position | ⏳ PENDING — human required |
| Play different episode → first episode state unchanged | ⏳ PENDING — human required |
| Unavailable episode → "Indisponible" / no Play action | ⏳ PENDING — human required |

---

## Regressions

None detected. All 392 pre-existing tests pass without modification.

---

## Blocking issues

**No code bugs found.** The sole blocking condition is the 8-point E2E checklist above, which requires a human with:
- Running dev server (`apps/api` + `apps/web`)
- At least one real imported series with multiple episodes and real IPTV availability
- A browser session

The ticket explicitly states: *"This issue is not complete merely because unit tests pass."* — that condition applies here.

---

## Decision

**AUTOMATED VALIDATION: PASS**  
**TICKET CLOSURE: BLOCKED on E2E manual checklist (8 items)**

The implementation is structurally correct and regression-free. Ticket T109 can be closed once Pierre runs the E2E checklist above against a real IPTV source and confirms all 8 items.
