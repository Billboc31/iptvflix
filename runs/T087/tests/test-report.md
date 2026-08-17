I now have a complete picture of everything delivered. Let me produce the test report.

---

## T087 — Tester Report

### Overall verdict: BLOCKED — not testable without manual execution

T087 is a **measurement ticket**, not a feature ticket. Every acceptance criterion requires either:
- access to the Railway production database (Phase 1),
- a residential/client network with curl/ffprobe/ffmpeg/VLC (Phase 2 & 5),
- the deployed Railway runtime (Phase 3),
- physical devices with browsers (Phase 4), or
- all of the above to complete the ADR (Phase 8).

The implementation correctly built the scaffolding and correctly marked itself BLOCKED. What follows is a criterion-by-criterion assessment of what was delivered vs. what is still required.

---

### Acceptance criteria — status

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | One REAL Xtream movie availability is selected and traced | **BLOCKED** | `golden-stream.md` is all `[FILL IN]` — script exists but not yet run against prod DB |
| 2 | Provider URL semantics proven against actual source/provider response | **BLOCKED** | Requires Phase 1 script + residential curl result |
| 3 | Original stream tested from residential/client network | **BLOCKED** | `probe-residential.md` all `[FILL IN]` |
| 4 | Original stream tested with ffprobe/ffmpeg | **BLOCKED** | Same file, not executed |
| 5 | Original stream visibly tested in VLC or equivalent | **BLOCKED** | Manual step, not executed |
| 6 | SAME stream tested from deployed Railway runtime | **BLOCKED** | `probe-railway.md` all `[FILL IN]` — diag endpoint extended but not called |
| 7 | Railway provider blocking conclusively confirmed/disproven with actual HTTP evidence | **BLOCKED** | `RAILWAY_PROVIDER_BLOCK_CONFIRMED` field = `[yes / no / inconclusive]` |
| 8 | Desktop browser direct-stream behavior captured | **BLOCKED** | `probe-browsers.md` all `[FILL IN]` |
| 9 | Android Chrome direct-stream behavior captured | **BLOCKED** | Same file |
| 10 | iPhone Safari direct-stream behavior captured | **BLOCKED** | Same file |
| 11 | Provider-native HLS capability tested (not assumed) | **BLOCKED** | HLS section in `probe-residential.md` not executed |
| 12 | Actual container/video/audio codecs documented | **BLOCKED** | ffprobe results not collected |
| 13 | CORS/mixed-content/codec/provider restrictions distinguished | **BLOCKED** | Browser probes not run |
| 14 | Current credential exposure via redirect assessed | **PASS (partial)** | `adr.md` correctly identifies `playback.ts:126` as the 302 exposure point; masking in extended diag service is implemented and reviewed |
| 15 | All four architectures compared | **SCAFFOLDED / BLOCKED** | ADR template covers all four with correct dimensions; all data fields are `[FILL IN]` |
| 16 | Exactly one recommended production direction selected, with evidence | **BLOCKED** | `Selected architecture: [A / B / C / D — fill in after probes]` |
| 17 | Follow-up implementation scope explicitly described | **SCAFFOLDED / BLOCKED** | Example scope for T088 exists but is hypothetical, not anchored to measured evidence |
| 18 | No real Xtream credential committed or printed in persistent logs/artifacts | **PASS** | `find-golden-stream.ts` masks both username and password before printing; probe templates warn against committing real URLs; diag extension masks `res.url` before returning |

---

### What was correctly delivered

| Artifact | Assessment |
|----------|------------|
| `apps/api/scripts/find-golden-stream.ts` | Correct DB query, correct credential masking, correct URL pattern validation |
| `apps/api/src/services/playback-diag.ts` extended | `upstreamContentType`, `upstreamIsMediaBody`, `upstreamRedirectFinalUrl` (with masking) added correctly |
| `runs/T087/golden-stream.md` | Template correct; all required Phase 1 fields present |
| `runs/T087/probe-residential.md` | Commands correct (curl -v -L, ffprobe JSON, ffmpeg -t 30, VLC section, HLS test, Decision Gate A) |
| `runs/T087/probe-railway.md` | Diag endpoint call documented, RAILWAY_PROVIDER_BLOCK_CONFIRMED decision logic correct |
| `runs/T087/probe-browsers.md` | Granular failure-mode checkboxes per browser; not collapsed into "unsupported" |
| `runs/T087/adr.md` | All four architectures, credential table, follow-up scope example |
| `runs/T087/implementation-output.md` | 5 exact ordered manual steps for the owner |

The scaffolding is accurate, safe, and well-matched to the ticket's requirements. No speculative playback rewrite was introduced. The implementation review correctly passed it.

---

### Regressions observed

None. The only code change (`playback-diag.ts`) extends the diag response with three new nullable fields. It cannot break any caller that was already consuming the existing fields.

---

### Blocking issues

**The ticket cannot be closed as DONE.** The STRICT completion rule in the ticket states:

> It is complete only when we have measured evidence showing REAL XTREAM STREAM → Residential/client: PASS or exact failure → Railway: PASS or exact failure → VLC/ffmpeg: PASS or exact failure → Desktop browser: PASS or exact failure → Android browser: PASS or exact failure → iPhone Safari: PASS or exact failure → ONE ARCHITECTURE DECISION.

None of these measurements exist yet. Every result field is `[FILL IN]`.

---

### Required manual steps (in order)

The owner must perform these steps to unblock the ticket:

1. **Phase 1** — Run `apps/api/scripts/find-golden-stream.ts` with the Railway production `DATABASE_URL`. Fill in `runs/T087/golden-stream.md` (sanitized only — never commit the real URL).

2. **Phase 2** — From a residential network, execute `curl -v -L`, `ffprobe`, `ffmpeg -t 30 -f null -`, and VLC against the real URL. Fill in `runs/T087/probe-residential.md`. If VLC/ffmpeg FAIL → stop; fix the provider URL first before running any browser test.

3. **Phase 3** — Call `GET /playback/diag/<availability_id>` on the deployed Railway API with an admin token. Fill in `runs/T087/probe-railway.md`. Set `RAILWAY_PROVIDER_BLOCK_CONFIRMED: yes/no` from the actual HTTP status.

4. **Phase 4** — Open the raw provider URL in Desktop Chrome, Android Chrome, and iPhone Safari. Fill in `runs/T087/probe-browsers.md` using the distinct failure-mode checkboxes.

5. **Phase 8** — Fill in `runs/T087/adr.md` facts table from all probes, select exactly one architecture, and write the next implementation ticket scope. This must be evidence-anchored, not hypothetical.

---

**Tester verdict: BLOCKED — implementation scaffolding is correct and approved; ticket cannot be marked DONE until the 5 manual probe steps above are executed and all `[FILL IN]` fields in the probe artifacts and ADR are populated with real measurements.**
