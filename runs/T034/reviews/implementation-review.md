I have all I need to write the review.

---

## PR Review — T034: Enforce maxVideoQuality as a real playback cap

### Summary

The implementation correctly replaces the broken quality-clamping approach with a hard pre-filter. Scope is tight — exactly 2 files changed. All ticket acceptance criteria are met.

---

### Correctness

**`isAboveCap` logic (`availability-resolver.ts:24–29`)**

All six edge cases are correctly handled:
- `null` cap → `false` (no filtering) ✓
- `null` quality → `false` (passthrough as fallback) ✓
- Unknown quality string (e.g. `'HDR'`) → not in `QUALITY_ORDER` → `false` ✓
- Unknown cap string → `QUALITY_ORDER[maxVideoQuality] ?? Infinity` → no known quality can exceed `Infinity` → `false` ✓
- Known quality at-cap → `> capRank` is strict → `false` ✓
- Known quality above-cap → `true` ✓

**`resolveVariant` pre-filter (`availability-resolver.ts:93–94`)**

Filters run in the right order: AVAILABLE first, then cap. The `candidates` variable passed to `resolveReason` is the post-cap set, so `sole_candidate` fires correctly when only one eligible variant remains after filtering. ✓

**The original bug is fully resolved**: a 4K variant can no longer win via ID tie-break over a 1080p variant when the cap is 1080p, because it is excluded before scoring.

---

### Test coverage

All 7 planned integration tests and all 6 `isAboveCap` unit tests are present and correct:

| Scenario | Test present |
|---|---|
| cap=1080p, 4K+1080p → 1080p wins; 4K absent from alternatives | ✓ |
| cap=1080p, 4K only → null / `no_available_variant` | ✓ |
| cap=1080p, 4K+null-quality → null-quality wins | ✓ |
| cap=720p, 4K+1080p+720p → 720p wins | ✓ |
| cap=null, 4K+1080p → 4K wins | ✓ |
| cap=1080p, 1080p+720p → 1080p wins (best at/below cap) | ✓ |
| Unknown cap string → treated as no-limit | ✓ |
| `isAboveCap`: above/at/below cap, null quality, null cap, unknown quality | ✓ (6 tests) |

Pre-existing test groups (audio language, subtitle, source priority, tie-break, quality ranking, unknown-metadata) are all preserved unmodified. ✓

---

### Scope compliance

- No schema changes ✓
- No profile validation changes ✓
- No frontend changes ✓
- No deduplication of `QUALITY_ORDER` across files ✓
- No catalog display helpers touched ✓

---

### Minor observations (non-blocking)

**`isAboveCap` exported for testability.** Exporting an internal helper is a pragmatic choice here since the plan explicitly calls for isolated unit tests. No concern.

**Unknown cap string handled defensively.** The `?? Infinity` fallback in `isAboveCap` is purely defensive — `VALID_QUALITIES` at the API boundary already rejects unknown values. The behavior is correct (treat as no-limit), and the test documents it. Acceptable.

**`ProfilePreferences.maxVideoQuality` typed as `string | null`.** The type is broader than the valid value set, which makes the defensive `Infinity` fallback load-bearing from a type-safety perspective. This is a pre-existing design choice, not introduced by this ticket.

---

### Verdict

All acceptance criteria met. Logic is correct. Tests are complete. No scope drift. Code is clean and minimal.

IMPLEMENTATION_APPROVED
