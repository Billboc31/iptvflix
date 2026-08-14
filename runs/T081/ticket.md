# T081 — Fix production Safari/iOS playback based on diagnostic findings

**Source**: GitHub Issue #171

## Description

## Dependency
This ticket MUST be implemented after #170 `Diagnose production Safari/iOS playback failure after compatibility fallback` has produced an evidence-backed root cause.

Do not guess a new playback architecture before reading #170's diagnostic report and real production evidence.

## Goal
Apply the concrete fix identified by #170 so real imported Xtream Movies and Episodes play successfully on Safari/iOS in the production-like Railway deployment.

The existing layered playback architecture should be preserved where sound:
- canonical Movie/Episode identity;
- availability/variant resolver;
- IPTVFlix playback session/gateway;
- cheap direct/pass-through path for compatible media;
- compatibility fallback for incompatible media.

Change only the layers required by the diagnosed root cause, while making the solution robust enough for equivalent streams.

## Required implementation process

### 1. Consume #170 diagnosis
The implementation plan must quote/summarize the confirmed root cause from #170 and identify the exact affected code path(s).

Possible areas include, but are not limited to:
- wrong compatibility classification;
- invalid ffmpeg arguments;
- incompatible fragmented MP4 output;
- missing/misleading MIME headers;
- output buffering/fragmentation incompatible with Safari;
- Range/seek behavior;
- upstream redirects/authentication;
- ffmpeg/ffprobe missing in actual Railway runtime;
- premature process termination;
- frontend source-switch/retry bug;
- unsupported codecs requiring a different transcode path.

Only implement what evidence supports.

### 2. Fix the real delivery path
Correct the gateway/player behavior so the real failing stream diagnosed in #170 becomes playable from a single `Regarder` action on iPhone Safari.

If remux/transcode is required, output must be in a delivery format Safari can consume progressively and reliably. Prefer the least expensive correct path.

### 3. Preserve fast path
Do not route every stream through heavy transcoding merely to fix one compatibility case.

Native-compatible streams should continue using direct/proxy delivery when proven safe.

### 4. Production deployment correctness
Any required runtime dependency/configuration must be explicit and actually active on Railway. If the fix needs ffmpeg flags, binaries, temp storage, environment/config, or a different build/deployment definition, include and test it.

### 5. HTTP/media correctness
Ensure the corrected playback endpoint returns headers/body semantics matching the media produced:
- correct Content-Type;
- appropriate status codes;
- valid streaming/chunking behavior;
- Range/Content-Range where applicable;
- no contradictory Content-Length;
- no premature termination;
- no raw provider credentials.

### 6. Frontend behavior
The web player should automatically consume the corrected delivery path. The user must not choose a `compatibility mode` manually.

`Réessayer` should create/retry a valid playback attempt rather than repeating a known-broken URL/session.

### 7. Regression coverage
Add a regression fixture/test that represents the concrete failing media characteristics found in #170. Tests should fail against the pre-fix implementation and pass after correction.

Retain coverage for existing compatible MP4/HLS/direct paths and ensure they are not regressed.

### 8. Real-device verification is BLOCKING
Unlike T079, this ticket must NOT be considered fully complete solely because automated tests pass.

The implementation/review/test artifacts must explicitly require validation of the deployed fix against the real iPhone/Safari case identified in #170.

If the autonomous worker cannot physically validate the user's device, mark that acceptance criterion as pending/manual rather than claiming full success. Do not state the bug is fixed until production evidence confirms playback starts.

## Acceptance criteria
- [ ] #170 root cause is explicitly referenced in the implementation plan.
- [ ] The diagnosed root cause is corrected rather than bypassed with an unrelated speculative rewrite.
- [ ] The real failing media characteristics have a regression test/fixture.
- [ ] Compatible streams still use the cheap path where appropriate.
- [ ] Safari receives valid compatible media and correct HTTP headers/stream semantics.
- [ ] Any ffmpeg/ffprobe/runtime requirement is genuinely present in Railway production runtime.
- [ ] One `Regarder` action automatically chooses the working path.
- [ ] Retry does not simply repeat a known broken playback target.
- [ ] Movie playback remains functional.
- [ ] Episode playback remains functional.
- [ ] No Xtream credentials/full secret URLs leak to browser logs/server logs.
- [ ] Automated tests pass for the diagnosed regression and existing playback paths.
- [ ] Production iPhone/Safari playback of the real case is treated as a BLOCKING manual acceptance check, not silently marked PASS when unverifiable.

## Completion rule
Code/tests may reach `TEST_COMPLETE`, but product-level closure should only happen after the real production Safari/iOS playback case is confirmed working. If manual confirmation is unavailable, report `awaiting real-device verification` rather than `fixed`.
