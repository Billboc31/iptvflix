---

## Test Report — T080

**Verdict: BLOCKED — production evidence not collected**

### Acceptance Criteria Results

| # | Criterion | Status |
|---|---|---|
| AC1 | Real iPhone/Safari stream traced end-to-end | **FAIL** |
| AC2 | Actual upstream container/codecs known | **FAIL** |
| AC3 | Actual compat mode known and justified | **FAIL** |
| AC4 | ffmpeg/remux/transcode execution result known | **FAIL** |
| AC5 | Actual HTTP/MIME/output delivered to Safari known | **FAIL** |
| AC6 | Compat output independently validated as valid media | **FAIL** |
| AC7 | Safari media error/event evidence captured | **FAIL** |
| AC8 | Railway ffmpeg/ffprobe verified at runtime (not assumed) | **FAIL** |
| AC9 | Root cause stated unambiguously with evidence | **FAIL** |
| AC10 | Concrete correction plan for follow-up ticket | **PARTIAL PASS** |
| AC11 | Not closed based on unit tests alone | **PASS** |

### What the implementation DID correctly produce

The instrumentation is complete and technically correct:
- `playback.ts` — sanitized ffmpeg logging (pid, exit code, signal, 20-line stderr tail, msToFirstByte)
- `PlayerPage.tsx` — `console.warn` on every video error with errorCode, readyState, networkState, urlMode, eventSequence
- `GET /api/diagnostics/env` — Railway runtime binary/path/tmpdir checker, guarded by `RAILWAY_ENVIRONMENT`
- `diagnose-stream.mjs` — full local pipeline replicator (ffprobe upstream → classifyDelivery → ffmpeg → ffprobe output); URL never logged
- Section 10 of `diagnosis.md` — four conditional correction plans, one per root cause candidate

The static analysis also produced a genuine finding: on Safari UA, both the initial `gatewayUrl` and the `?compat=1` retry trigger the identical compat code path (`playback.ts:207`), making the frontend "fallback" structurally inert. This is a sound hypothesis referencing exact code, not speculation.

### Why it is blocked

The ticket explicitly states: *"Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis."* All 8 production evidence sections in `diagnosis.md` are empty — they cannot be filled without a physical iPhone, Xtream provider credentials, and a live Railway deployment.

### Required human action

Execute the 4 handoff steps in `diagnosis.md` (deploy → call `/api/diagnostics/env` → run `diagnose-stream.mjs` against a real URL → test on iPhone Safari with Web Inspector), populate the evidence fields, confirm or disprove the Candidate 1 hypothesis, then update the document status to `COMPLETE`. Re-run this tester review once done.

The full report is at `runs/T080/test-report.md`.
