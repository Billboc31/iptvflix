## Summary — Coder Attempt 4

Attempts 1–3 confirmed that production evidence (Railway + iPhone Safari) is required for Sections 1, 5, 7, 8 and cannot be collected by an AI agent. Rather than produce another no-op cycle, this attempt adds a **local diagnostic script** that replicates the exact production pipeline, allowing Sections 2, 3, 4, and 6 to be filled **without Railway deployment**.

---

### What changed

**`apps/api/scripts/diagnose-stream.mjs`** (new file)

Local script that exercises the compat pipeline end-to-end:

- **Section 2** — runs `ffprobe` with the same invocation as `probeMedia()` (same args, same URL passing approach), extracting `videoCodec`, `audioCodec`, `containerFormat`, profile, resolution, frameRate, audioChannels, sampleRate, duration
- **Section 3** — applies inline copy of `classifyDelivery(isSafari=true)` on the probed result, reporting which mode is selected and why
- **Section 4** — fetches the URL via `fetch()`, pipes `response.body` via `Readable.fromWeb()` to `ffmpeg.stdin` — **identical to `runFfmpegStream()`** — captures `exitCode`, `exitSignal`, `stderrTail`, `msToFirstByte`, `firstOutputBytesHex`
- **Section 6** — runs `ffprobe` on the ffmpeg output file to confirm whether it is valid fMP4

Output is structured JSON with the URL never printed. Report is safe to share.

**`runs/T080/diagnosis.md`** (updated)

- Status line updated: Sections 2/3/4/6 now collectable locally
- Executive Summary updated: local script bridges 4 of the 9 pending sections
- Sections 2, 3, 4, 6 updated with "How to Collect (LOCAL)" instructions referencing the script
- Sections 1, 5, 7, 8 remain `<PENDING>` — still require Railway + iPhone Safari

---

### Sections still requiring human action

| Section | Requires |
|---|---|
| 1 — Session trace | Running app (any environment) + real playback |
| 5 — HTTP response to Safari | Actual HTTP request from Safari or curl |
| 7 — Safari MediaError | iPhone Safari + Web Inspector |
| 8 — Railway runtime | Railway deployment + `/api/diagnostics/env` |

Sections 2, 3, 4, 6 can now be filled by running:
```bash
node apps/api/scripts/diagnose-stream.mjs --url '<XTREAM_URL>' --ext ts
```

---

### Files modified

| File | Action |
|---|---|
| `apps/api/scripts/diagnose-stream.mjs` | Created |
| `runs/T080/diagnosis.md` | Updated (executive summary + sections 2/3/4/6) |
| `runs/T080/implementation-output.md` | Updated |
