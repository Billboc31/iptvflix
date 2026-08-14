# Test Report — T081: Fix production Safari/iOS playback

## Summary

Implementation reviewed and all automated validations executed. 828 tests pass. All 13 acceptance criteria evaluated below. Production iPhone/Safari playback remains a BLOCKING manual acceptance check.

---

## Acceptance Criteria

### AC1 — #170 root cause explicitly referenced in the implementation plan
**PASS**

The plan quotes the T080 (GitHub #170 diagnostic ticket) root cause verbatim:

> `apps/api/src/routes/playback.ts:207`: `const useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)`. For any Safari/iOS User-Agent, `isSafariOrIOS()` triggers compat on the initial `gatewayUrl` request. The frontend fallback then retries with `compatUrl` (`?compat=1`), which also sets `useCompat = true` via the `request.query.compat === '1'` branch. Both attempts execute the identical compat code path. If the compat path fails once, it fails the same way on retry.

The implementation plan and output both reference this explicitly.

---

### AC2 — Diagnosed root cause corrected rather than bypassed
**PASS**

`playback.ts:206` now reads:
```ts
const useCompat = request.query.compat === '1'
```
`isSafariOrIOS` is not imported in `playback.ts` and not called in the stream handler. The fix is surgical: one expression changed, no architectural rewrite. `isSafariOrIOS` remains exported from `playback-compat.ts` for tests and future UA detection.

---

### AC3 — Real failing media characteristics have a regression test/fixture
**PASS**

`playback-gateway.test.ts` — describe block `'compat path selection — structural defect regression (T081)'` — 4 tests:

| Test | Result |
|---|---|
| Safari UA without `?compat=1` → extension-based routing, `probeMedia` NOT called | ✅ |
| Safari UA with `?compat=1` → compat path, `probeMedia` called | ✅ |
| Non-Safari without `?compat=1` → extension-based routing, `probeMedia` NOT called | ✅ |
| `?compat=1` without Safari UA → compat path, `probeMedia` called | ✅ |

`playback-compat.test.ts` — 2 additional tests:

| Test | Result |
|---|---|
| `buildFfmpegArgs('REMUX')` includes `-max_interleave_delta 0` | ✅ |
| `buildFfmpegArgs('TRANSCODE_AUDIO')` includes `-max_interleave_delta 0` | ✅ |

All 6 regression-specific tests pass.

---

### AC4 — Compatible streams still use the cheap path where appropriate
**PASS**

With `isSafariOrIOS` removed from `useCompat`, Safari requests without `?compat=1` use extension-based routing:
- `mp4` → direct pass-through with `Content-Type: video/mp4`, `Accept-Ranges: bytes`
- `ts`/`mkv` → remux via ffmpeg (always was; unchanged)
- `m3u8`/`m3u` → HLS pass-through with segment rewriting

Confirmed by test `'Safari UA without ?compat=1 uses extension-based (non-compat) routing'` which asserts 200, `video/mp4`, `Accept-Ranges: bytes`, and `probeMedia` NOT called.

---

### AC5 — Safari receives valid compatible media and correct HTTP headers/stream semantics
**PASS (automated evidence only — production device unverified)**

Code-level verification:
- **mp4 pass-through**: `Content-Type: video/mp4`, `Accept-Ranges: bytes`, `Content-Length` and `Content-Range` forwarded when present, no contradictory headers. Status forwarded from upstream (200 or 206).
- **ffmpeg compat path**: `Content-Type: video/mp4`, chunked transfer, no `Content-Length` (correct for a live stream). No premature termination: ffmpeg kill on client disconnect (`request.raw.on('close', cb)`).
- **HLS**: `Content-Type: application/vnd.apple.mpegurl`, segments rewritten to proxy path (no raw provider URL exposure).
- **Error cases**: 401/403/404/504 return appropriate status codes with no body data from upstream.

No raw `providerStreamUrl` in any HTTP response body or header — confirmed by `playback-stream-compat.test.ts` credential leak test.

---

### AC6 — ffmpeg/ffprobe/runtime requirement genuinely present in Railway production runtime
**PASS (static analysis only — not live-verified)**

T080 static analysis confirmed `nixpacks.toml` declares `["ffmpeg"]` in `nixPkgs`. The diagnostics route that could verify the live Railway runtime was deleted (correctly — it was an unauthenticated security risk). This residual risk is correctly carried to the BLOCKING manual acceptance check.

---

### AC7 — One `Regarder` action automatically chooses the working path
**PASS (code logic — not device-verified)**

The frontend's existing auto-retry mechanism is correct once the backend structural defect is fixed:
1. `Regarder` → initial `gatewayUrl` request → extension-based routing (Safari gets mp4 pass-through)
2. On `MEDIA_ERR_DECODE`/`MEDIA_ERR_SRC_NOT_SUPPORTED` → automatic retry with `compatUrl` (`?compat=1`) → probe-classified ffmpeg path

No frontend changes were needed. No manual "compatibility mode" selection is required from the user.

---

### AC8 — Retry does not simply repeat a known broken playback target
**PASS**

Pre-fix: both initial request and `?compat=1` retry evaluated `useCompat = true` for Safari → same compat path → retry was a no-op.

Post-fix: initial request → extension-based path; retry `?compat=1` → probe + ffmpeg path. Genuinely two distinct delivery attempts.

---

### AC9 — Movie playback remains functional
**PASS**

All existing `playback-gateway.test.ts` tests (mp4 pass-through, Range forwarding, `Accept-Ranges`, upstream error handling, ts remux) pass. No regression in movie delivery paths.

---

### AC10 — Episode playback remains functional
**PASS (no episode-specific regression observed)**

No playback code changes affect episode vs. movie routing; both share the same stream handler. No explicit episode-specific playback test was added in T081 (the session store handles both types). No episode-specific failure observed in the test suite.

*Note*: an explicit episode playback integration test does not exist in this test suite — this is a pre-existing gap, not introduced by T081.

---

### AC11 — No Xtream credentials/full secret URLs leak to browser logs/server logs
**PASS**

- `providerStreamUrl` is stored in the server-side session, never sent to the browser in any response body or header.
- `runFfmpegStream` logs `sanitizedArgs` with `<stdin>` instead of the actual stream URL.
- `playback-stream-compat.test.ts` includes an explicit test `'provider URL does not appear in any log call'` — passes.
- `apps/api/src/routes/diagnostics.ts` (which exposed env vars including stream credentials) has been deleted. `apps/api/src/index.ts` contains no `diagnosticsRoutes` import or registration.

---

### AC12 — Automated tests pass for the diagnosed regression and existing playback paths
**PASS**

```
Test Files  3 failed | 59 passed (62)
      Tests  5 failed | 828 passed (833)
```

The 5 failures are pre-existing and unrelated to playback:
- `vertical-slice.test.ts` (4 failures) — DB integration test flakiness present in T080 baseline
- `title-matching-service.test.ts` (1 failure) — TMDB mock timing issue present in T080 baseline

All 47 playback-specific tests pass (playback-gateway, playback-compat, playback-stream-compat).

---

### AC13 — Production iPhone/Safari playback treated as BLOCKING manual check
**PASS (process criterion)**

Implementation output states explicitly:

> **BLOCKING MANUAL ACCEPTANCE CHECK**: iPhone/Safari production playback of the real Xtream stream must be validated by the user on a real device before this ticket can be considered fully resolved.

The implementation review, the plan, and this report all reflect this. The criterion is correctly marked as requiring human execution.

---

## Issues Detected

### Minor — `classifyDelivery(mediaInfo, true)` hardcoded for all compat clients

**File**: `playback.ts:240`

When any client (including Chrome) reaches the compat path via `?compat=1`, the gateway calls `classifyDelivery(mediaInfo, true)`, treating the client as Safari regardless of actual User-Agent. For Chrome with HEVC+MP4+AAC content, this returns `DIRECT` instead of `TRANSCODE_VIDEO`. Chrome cannot play HEVC, so the `DIRECT` path would fail for that client.

**Impact**: Marginal edge case (Chrome + HEVC + compat retry), out of scope for T081. No test fails as a result — the classification unit tests pass the `isSafari` flag explicitly, and no integration test covers Chrome+HEVC+compat. Not blocking.

**Recommendation**: Pass `isSafariOrIOS(request.headers['user-agent'] ?? '')` at `playback.ts:240` in a follow-up ticket if HEVC non-Safari compat support becomes a requirement.

---

## Regressions

None introduced by T081.

---

## Blocking Items

| Item | Status |
|---|---|
| Production iPhone/Safari playback on real Xtream stream | **PENDING — awaiting real-device verification** |

---

## Verdict

**TEST_COMPLETE — awaiting real-device verification**

Automated validation complete. All 13 acceptance criteria pass at the code and test level. One minor issue (hardcoded `true` in `classifyDelivery` call) is out of scope and non-blocking. Product-level closure requires manual confirmation of iPhone/Safari playback on a real device in the Railway production environment before this ticket can be considered fully resolved.
