The test report is written. Here is the summary:

---

## T087 Tester Report — Summary

**Verdict: BLOCKED — implementation correct, awaiting manual probe execution**

### What was verified

**Code changes are correct:**
- `apps/api/scripts/find-golden-stream.ts` — correct DB query, credential masking before any output, correct URL pattern validation
- `apps/api/src/services/playback-diag.ts` — three new fields (`upstreamContentType`, `upstreamIsMediaBody`, `upstreamRedirectFinalUrl`) correctly implemented; credentials masked in final URL
- `xtream-vod-url.test.ts` — unit tests correctly pin the Xtream VOD URL construction contract
- All probe artifact templates are accurate and match the ticket's requirements

**No regressions:** The 3 failing test files (`vertical-slice.test.ts`, `title-matching-service.test.ts`) are identical on the main branch baseline — pre-existing, not introduced by T087.

### Why BLOCKED (correctly)

All 16 probe-based acceptance criteria require live access that an AI worker cannot provide: the Railway production database, a residential network with curl/ffprobe/ffmpeg/VLC, the deployed Railway diag endpoint, and physical devices (Android Chrome, iPhone Safari). Every probe artifact is still a template with `[FILL IN]` fields. The ticket's own strict completion rule demands measured evidence across all paths before it can close.

### 5 manual steps required from the owner

1. Run `find-golden-stream.ts` against Railway production DB → populate `golden-stream.md`
2. From residential network: run curl + ffprobe + ffmpeg -t 30 + VLC → populate `probe-residential.md` (if VLC/ffmpeg fail, stop there)
3. Deploy branch, call Railway diag endpoint → populate `probe-railway.md` with `RAILWAY_PROVIDER_BLOCK_CONFIRMED: yes/no`
4. Test raw URL in Desktop Chrome, Android Chrome, iPhone Safari → populate `probe-browsers.md` (granular failure modes)
5. Fill `adr.md` facts table, select one architecture, write follow-up ticket scope anchored to evidence
