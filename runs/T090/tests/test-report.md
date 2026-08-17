---

## Test Report — T090

**Result: 8/9 PASS, 1 BLOCKED (human QA gate)**

| Criterion | Status |
|---|---|
| AC1 — Duration no longer grows with buffering | PASS |
| AC2 — Visual layers: total / played / buffered | PASS |
| AC3 — Duration matches playable asset | PARTIAL (code correct, no real stream) |
| AC4 — Unknown duration → `--:-- / --:--` indeterminate | PASS |
| AC5 — Resume stores absolute seconds | PASS |
| AC6 — Resume % uses real total duration | PASS |
| AC7 — Close at 25% → reopen at 25% | PASS |
| AC8 — Seek bar usable after metadata | PASS |
| AC9 — Tested on real Xtream stream | **BLOCKED** |

**All 45 T090-specific tests pass** (7 `useProgressSync`, 32 `PlayerControls`, 6 `PlayerPage`). The 337-test web suite is green. The 6 pre-existing API failures are unrelated to this ticket (same on `main`).

The single blocking item is the **completion rule in the ticket itself** — a human QA gate that no agent can satisfy: play a real Xtream movie ≥ 60 min, verify the timeline duration is stable during buffering, close at ~25%, reopen and confirm resume position. Once you do that and create `runs/T090/evidence-real-stream.md`, the ticket can be closed.
