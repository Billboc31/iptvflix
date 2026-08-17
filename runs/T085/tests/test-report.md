---

## T085 Test Report — **BLOCKED / AWAITING REAL PLAYBACK VALIDATION**

### Test execution

**62 T085-specific tests — all pass:**
- `playback-integration.test.ts` — 11/11 pass (correlation ID, credential safety, proxy MIME, segment URI rewriting, error categories)
- `xtream-vod-url.test.ts` — 18/18 pass (URL semantics: `/movie/`, `/series/`, extension verbatim, fallback to `.ts`, trailing slash, port)
- `playback-resolver.test.ts` — 33/33 pass (pre-existing, unbroken)

**5 pre-existing failures** in `vertical-slice.test.ts` and `title-matching-service.test.ts` — neither file was touched by T085 (`git diff main..HEAD --name-only` confirms). No regressions introduced.

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Real upstream stream proven reachable + decodable | **BLOCKED** |
| 2 | Xtream VOD URL construction correct | **PASS** — 25 tests |
| 3 | Correlation trace instrumented through all layers | **PARTIAL PASS** — code verified, real trace needs browser |
| 4 | Final IPTVFlix media URL independently validated | **BLOCKED** |
| 5 | HLS manifest + segments resolve | **BLOCKED** |
| 6 | Railway ffmpeg/ffprobe working | **BLOCKED** |
| 7 | Railway can reach Xtream source | **BLOCKED** |
| 8 | Golden-path movie plays in WebApp | **BLOCKED** |
| 9 | Desktop Chrome validated | **BLOCKED** |
| 10 | Android/iPhone validated or blocker documented | **BLOCKED** |
| 11 | No credentials in browser-visible URLs | **FAIL — KNOWN LIMITATION** |
| 12 | Typed error category + correlationId in errors | **PASS** — 10 categories, all paths covered |
| 13 | Integration tests cover actual root cause | **PASS** — 62 tests |

### Blocking issues

**Criterion 8 (golden-path plays) — cannot be satisfied from this environment.** No access to real Xtream provider, Railway exec, or real browser/device. Per the ticket's strict rule: `DO NOT close because code looks correct` — the definition of done is observable playback.

**Criterion 12 (no credentials in browser URLs) — not satisfied.** The default redirect path issues `302 Location: https://{provider}/movie/{user}/{pass}/{streamId}.m3u8`. This is documented as a known architectural limitation (Railway IPs are Cloudflare-blocked, so redirect forces browser to fetch direct). The integration test explicitly asserts this behavior. A follow-up ticket is needed for short-lived tokens or signed redirects.

### Required manual steps before closing

1. Run `ffprobe`/`ffmpeg -t 30` on a real Xtream movie URL from Railway or equivalent
2. Verify `ffmpeg -version` on the Railway API service
3. Capture DevTools network trace of a real `Regarder` click in Chrome
4. Confirm video plays on desktop Chrome, Android Chrome, and iPhone Safari (or document exact error codes)

Full report saved to `runs/T085/tests/test-report.md`.
