# T080 — Test Report

**Date**: 2026-08-14  
**Branch**: `ticket/T080-diagnose-production-safari-ios-playback-failure-af`  
**Verdict**: **BLOCKED — production evidence not collected**

---

## Overview

T080 is a diagnostic-only ticket whose explicit deliverable is *evidence-backed diagnosis from a real production iPhone/Safari + Railway session*. The ticket states: "Do not close this ticket with only unit-test evidence or an architectural assumption."

The implementation produced correct and complete instrumentation infrastructure (logging, browser telemetry, diagnostic scripts, env-check route). It also produced a static code analysis hypothesis. However, no real production trace was executed. All evidence fields in `runs/T080/diagnosis.md` remain marked `REQUIRES HUMAN EXECUTION`.

---

## Acceptance Criteria Evaluation

### AC1 — A real production-like failing iPhone/Safari stream has been traced end-to-end
**FAIL**

`diagnosis.md` Section 1 contains the collection template with exact commands (`railway logs -t --service api | grep "playback-gateway"`) but every evidence field is empty. No sessionId, availabilityId, sourceId, containerExtension, or delivery mode was captured from a real session.

---

### AC2 — Actual upstream container/codecs are known
**FAIL**

`diagnosis.md` Section 2 is empty. `diagnose-stream.mjs` exists and correctly replicates the ffprobe pipeline, but was not executed against a real Xtream URL. No containerFormat, videoCodec, audioCodec, or upstream media validity data was collected.

---

### AC3 — Actual compatibility mode selected is known and justified
**FAIL**

`diagnosis.md` Section 3 is empty. The static code analysis documents the `classifyDelivery()` decision tree correctly. A structural hypothesis was identified (see AC9 note below). But for an actual failing stream, no `deliveryMode`, `classifyInputVideoCodec`, or `classifyInputContainer` value was captured.

---

### AC4 — ffmpeg/remux/transcode execution result is known when used
**FAIL**

`diagnosis.md` Section 4 is empty. `playback.ts` now logs `ffmpegPid`, `ffmpegExitCode`, `ffmpegExitSignal`, `ffmpegStderrTail`, and `msToFirstByte` — the instrumentation is correct — but no Railway log output from a real compat session was collected.

---

### AC5 — Actual HTTP/MIME/output delivered by compat gateway is known
**FAIL**

`diagnosis.md` Section 5 is empty. The curl command to inspect response headers from the Railway API with a Safari UA is documented but was never executed.

---

### AC6 — It is known whether generated compat output is itself valid media
**FAIL**

`diagnosis.md` Section 6 is empty. `diagnose-stream.mjs` Section 6 replicates ffprobe validation on ffmpeg output, but was not run against a real stream.

---

### AC7 — Safari media error/event evidence is captured
**FAIL**

`diagnosis.md` Section 7 is empty. `PlayerPage.tsx` emits `console.warn('[iptvflix:player] video error event', { errorCode, readyState, networkState, urlMode, eventSequence })` — the instrumentation is correct — but no Web Inspector capture from an iPhone session exists.

---

### AC8 — Railway ffmpeg/ffprobe deployment is verified, not assumed
**FAIL**

`diagnosis.md` Section 8 evidence fields are empty. Static code review confirms `nixpacks.toml` declares `nixPkgs = ["ffmpeg"]` and `railway.toml` uses `builder = "NIXPACKS"` — these are necessary but not sufficient. The actual runtime binary presence (PATH, version, ffprobe availability) was not verified via `GET /api/diagnostics/env` on a live Railway deployment.

---

### AC9 — Root cause is stated unambiguously with evidence
**FAIL**

`diagnosis.md` Section 9 states a hypothesis labeled `ROOT CAUSE HYPOTHESIS — CONFIRMED FROM CODE, AWAITING PRODUCTION VERIFICATION`. The hypothesis is sound:

> `playback.ts:207` — `isSafariOrIOS()` triggers compat on the first request; the frontend retry with `?compat=1` also triggers compat. Both attempts are behaviorally identical. If the compat path fails once, it fails again the same way.

This is a genuine static finding with code references. However, the ticket explicitly requires evidence from a real session: "Do not close this ticket with only unit-test evidence or an architectural assumption." The root cause is not unambiguously confirmed — it remains a candidate pending production validation.

---

### AC10 — A concrete correction plan exists for the follow-up issue
**PARTIAL PASS**

`diagnosis.md` Section 10 provides four concrete conditional correction plans (one per candidate root cause), each specifying file, line area, and change. The plans are specific and actionable. The caveat is that the correct plan to execute cannot be determined until the root cause is confirmed by production evidence.

---

### AC11 — Ticket is NOT marked complete merely because automated compatibility unit tests pass
**PASS**

No unit tests were cited as evidence. The implementation review did not invoke automated tests as justification. The diagnosis.md and workflow state are honest about what is pending. `state.json` shows `IMPLEMENTATION_APPROVED` (not COMPLETE), which is consistent with the workflow reaching tester stage.

---

## What Was Correctly Implemented

The instrumentation work is complete and correct. These changes are worth preserving for the production trace:

| Component | What was added |
|---|---|
| `apps/api/src/routes/playback.ts` | Sanitized ffmpeg logging: pid, exit code/signal, stderr tail (20 lines), msToFirstByte, responseMode |
| `apps/web/src/pages/PlayerPage.tsx` | `console.warn` on every video error with errorCode, readyState, networkState, urlMode, eventSequence |
| `apps/api/src/routes/diagnostics.ts` | `GET /api/diagnostics/env` — ffmpeg/ffprobe which/version, PATH, tmpDir writability, memory; guarded by `RAILWAY_ENVIRONMENT` |
| `apps/api/scripts/check-env.mjs` | Local env prerequisite checker, mirrors diagnostics route |
| `apps/api/scripts/diagnose-stream.mjs` | Full local replication of compat pipeline: ffprobe upstream, classifyDelivery, ffmpeg execution, ffprobe output validation; URL never logged |
| `apps/api/src/index.ts` | diagnosticsRoutes registered at app root |

One security note carried forward from the implementation review: `GET /api/diagnostics/env` is publicly accessible to any client that knows the URL (guarded by `RAILWAY_ENVIRONMENT` env var only, not by auth). Acceptable as a temporary diagnostic route, but **must be removed or protected before merging to a long-lived branch**.

---

## Blocking Issues

**Primary blocker**: All production evidence criteria (AC1–AC9) cannot be verified without human execution of the four handoff steps from `diagnosis.md`:

1. Deploy the T080 branch to Railway.
2. Call `GET https://<railway-api>/api/diagnostics/env` and record the output into Section 8.
3. Run `node apps/api/scripts/diagnose-stream.mjs --url '<xtream-url>' --ext <ext>` against a real failing stream and record output into Sections 2, 3, 4, 6.
4. Connect an iPhone via USB, open Safari Web Inspector, navigate to a failing stream, capture Railway logs and Web Inspector console output, record into Sections 1 and 7.

These steps require a physical iPhone, Xtream provider credentials, and an active Railway deployment. They cannot be performed by an automated agent.

---

## Regressions

None detected. The instrumentation changes are additive (new logging, new console.warn, new scripts, new route). No existing code paths were altered beyond adding structured log statements to the existing ffmpeg pipe path in `playback.ts` and the existing `onError` handler in `PlayerPage.tsx`.

---

## Verdict

**BLOCKED**

The implementation is correct, complete, and honest about its limits. The ticket cannot be closed in its current state because the core deliverable — an evidence-backed diagnosis from a real iPhone/Safari/Railway session — has not been produced.

Required action: a human must execute the four handoff steps documented in `diagnosis.md`, then populate the evidence fields and update Section 9 with a confirmed (not hypothesized) root cause.

Once the production evidence is collected and `diagnosis.md` is updated to `COMPLETE — production evidence collected`, this tester review should be re-run to verify that AC1–AC9 are satisfied.
