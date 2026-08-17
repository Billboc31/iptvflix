# T087 — Residential / Client Network Probe

**Status: BLOCKED — requires manual execution from a residential (non-datacenter) network**

Use the golden stream URL from `golden-stream.md` (real URL with credentials — never commit it).

---

## 1 — curl probe

```bash
# Replace <real-url> with the actual provider URL
curl -v -L --max-time 20 "<real-url>" -o /dev/null 2>&1 | head -80
```

Expected: HTTP 200 or 206, redirect chain (if any), `Content-Type: video/*`.

### Result

```
[PASTE SANITIZED curl -v OUTPUT HERE — redact username/password in any URLs that appear]
```

| Field | Value |
|-------|-------|
| HTTP status | `[FILL IN]` |
| Redirect chain | `[FILL IN — or "none"]` |
| Content-Type | `[FILL IN]` |
| Bytes received | `[FILL IN e.g. yes/no, approximate size]` |
| Outcome | `PASS / FAIL` |

---

## 2 — ffprobe probe

```bash
ffprobe -v quiet -print_format json -show_streams -show_format "<real-url>" 2>&1
```

### Result

```json
[PASTE ffprobe JSON OUTPUT HERE]
```

| Field | Value |
|-------|-------|
| Container format | `[FILL IN e.g. mov,mp4,m4a,3gp,3g2,mj2]` |
| Video codec | `[FILL IN e.g. h264]` |
| Video profile | `[FILL IN e.g. High]` |
| Resolution | `[FILL IN e.g. 1920x1080]` |
| Audio codec | `[FILL IN e.g. aac]` |
| Duration | `[FILL IN e.g. 5400s]` |
| Outcome | `PASS / FAIL` |

---

## 3 — ffmpeg 30-second decode

```bash
ffmpeg -i "<real-url>" -t 30 -f null - 2>&1 | tail -20
```

### Result

```
[PASTE ffmpeg OUTPUT TAIL HERE]
```

| Outcome | `PASS / FAIL` |
|---------|---------------|
| Notes | `[FILL IN any errors]` |

---

## 4 — VLC playback

Open the real URL in VLC (Media → Open Network Stream).

| Field | Value |
|-------|-------|
| Video plays visibly | `YES / NO` |
| Audio plays | `YES / NO` |
| Seeking works | `YES / NO` |
| Outcome | `PASS / FAIL` |

---

## Decision Gate A

> If VLC/ffmpeg fail: STOP browser debugging. Fix provider URL/auth first.

| Gate A | `PASS (continue to Phase 3) / BLOCKED (fix provider first)` |
|--------|--------------------------------------------------------------|

---

## 5 — Provider-native HLS capability (Phase 5)

Replace the container extension with `.m3u8` and test:

```bash
# Primary HLS attempt
HLS_URL="<base>/movie/<user>/<pass>/<streamId>.m3u8"
curl -v -L --max-time 10 "$HLS_URL" -o /dev/null 2>&1 | head -30

# Alternative form if above 404s
ALT_HLS_URL="<base>/movie/<user>/<pass>/<streamId>/index.m3u8"
curl -v -L --max-time 10 "$ALT_HLS_URL" -o /dev/null 2>&1 | head -30
```

If a manifest is returned, validate it:

```bash
ffprobe -v quiet -print_format json -show_streams "$HLS_URL" 2>&1 | head -40
```

### Result

| Test | HTTP status | Content-Type | Outcome |
|------|-------------|--------------|---------|
| `.m3u8` extension | `[FILL IN]` | `[FILL IN]` | `SUPPORTED / NOT SUPPORTED` |
| `/index.m3u8` form | `[FILL IN]` | `[FILL IN]` | `SUPPORTED / NOT SUPPORTED` |
| Manifest valid (ffprobe) | — | — | `PASS / FAIL / N/A` |

Provider-native HLS: `SUPPORTED / NOT SUPPORTED`
