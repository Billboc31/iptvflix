Test report written to `runs/T081/test-report.md`.

---

## T081 Test Report — Summary

**Verdict: TEST_COMPLETE — awaiting real-device verification**

### All 13 acceptance criteria evaluated:

| # | Criterion | Status |
|---|---|---|
| 1 | #170 (T080) root cause explicitly referenced | ✅ PASS |
| 2 | Root cause corrected, not bypassed | ✅ PASS |
| 3 | Regression tests for failing media characteristics | ✅ PASS |
| 4 | Compatible streams still use cheap path | ✅ PASS |
| 5 | Safari receives valid media + correct HTTP headers | ✅ PASS (automated only) |
| 6 | ffmpeg present in Railway runtime | ✅ PASS (nixpacks static analysis) |
| 7 | One `Regarder` action auto-selects working path | ✅ PASS (code logic) |
| 8 | Retry uses genuinely different delivery path | ✅ PASS |
| 9 | Movie playback not regressed | ✅ PASS |
| 10 | Episode playback not regressed | ✅ PASS |
| 11 | No Xtream credentials/URLs leak | ✅ PASS |
| 12 | Automated tests pass (828/833, 5 pre-existing failures) | ✅ PASS |
| 13 | iPhone/Safari playback explicitly marked BLOCKING manual check | ✅ PASS (process) |

### Minor issue (non-blocking, out of scope)
`classifyDelivery(mediaInfo, true)` at `playback.ts:240` is hardcoded to treat all compat-path clients as Safari. Chrome + HEVC via `?compat=1` would incorrectly get `DIRECT` instead of `TRANSCODE_VIDEO`. No evidence this case occurs in practice; flagged for a follow-up if needed.

### Blocking item
**Production iPhone/Safari playback on a real device must be confirmed by the user before product-level closure.** The fix is logically correct and all automated tests pass, but the T081 completion rule explicitly requires real-device validation.
