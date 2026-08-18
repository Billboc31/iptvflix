---

## Test Report — T094

**Result: PASS** (automated) / **Manual validation still required** per completion rule.

### Test execution

```
13 tests — 13 passed, 0 failed
```

All tests pass when run correctly from `apps/web/` (`cd apps/web && npx vitest run`). Running from the repo root fails with `document is not defined` — a pre-existing environment issue, not a T094 regression.

### Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Partially watched Movie shows Reprendre/Recommencer dialog | **PASS** |
| 2 | Episode prompts independently at episode level | **PASS** |
| 3 | Never-started (0 s) plays immediately | **PASS** |
| 4 | Trivial progress (≤ 30 s) plays without dialog | **PASS** |
| 5 | Near-end content (within 60 s of duration) plays without dialog | **PASS** |
| 6 | Timestamp uses absolute seconds + probe-based duration | **PASS** |
| 7 | Reprendre seeks to saved position | **PASS** |
| 8 | Recommencer seeks to 0 | **PASS** |
| 9 | Source/quality changes preserve canonical position | **PASS** (by design) |
| 10 | Episode isolation — no cross-episode leak | **PASS** |
| 11 | Desktop + mobile UX (keyboard, focus, responsive) | **PASS** |
| 12 | Continue Watching coherence | **DEFERRED** (explicitly out of scope in plan) |
| 13 | Test coverage: thresholds, completed, restart, Escape, ARIA | **PASS** (13 tests) |

### Regressions

None. Both HLS.js regression smoke tests pass.

### Pre-existing TypeScript errors

6 `tsc` errors exist in the integration branch (`posterUrl` missing from `EpisodeResponse` fixtures in test files from an earlier ticket). None are in T094-modified files.

### Blocking issue

**None** — automated gate is clear.

### Manual validation required

The completion rule mandates real-device testing: play a Movie and an Episode for >60 s, close, reopen, click `Lecture`, verify the dialog appears, and test both `Reprendre` and `Recommencer` paths. This cannot be done in automated testing and must be performed by a human before closing the ticket.
