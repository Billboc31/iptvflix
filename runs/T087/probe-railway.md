# T087 — Railway Runtime Probe

**Status: BLOCKED — requires calling the deployed Railway diag endpoint with a real availability ID**

The diag endpoint (`GET /playback/diag/:availabilityId`) has been extended in this ticket to expose:
- `upstreamContentType` — Content-Type header from the upstream response
- `upstreamIsMediaBody` — `true` if Content-Type indicates media (video/* or octet-stream or HLS)
- `upstreamRedirectFinalUrl` — final URL after redirects, credentials masked as `[REDACTED]`

---

## How to call

Obtain a valid JWT admin token first (sign in at `POST /auth/login`), then:

```bash
RAILWAY_API="https://iptvflixapi-production.up.railway.app"
AVAILABILITY_ID="<availability_id from golden-stream.md>"
TOKEN="<admin JWT>"

curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "$RAILWAY_API/playback/diag/$AVAILABILITY_ID" | jq .
```

---

## Result

```json
[PASTE FULL JSON RESPONSE HERE]
```

---

## Analysis

| Field | Value |
|-------|-------|
| `upstreamHttpStatus` | `[FILL IN]` |
| `upstreamContentType` | `[FILL IN]` |
| `upstreamIsMediaBody` | `[FILL IN]` |
| `upstreamRedirectFinalUrl` | `[FILL IN — already masked by server]` |
| `upstreamReachable` | `[FILL IN]` |
| `ffmpegAvailable` | `[FILL IN]` |
| `ffprobeAvailable` | `[FILL IN]` |

---

## RAILWAY_PROVIDER_BLOCK_CONFIRMED

Based on the actual HTTP status returned by the endpoint:

| Condition | Result |
|-----------|--------|
| `upstreamHttpStatus` = 403 AND residential probe returned 200/206 | `RAILWAY_PROVIDER_BLOCK_CONFIRMED: yes` |
| `upstreamHttpStatus` = 200 or 206 | `RAILWAY_PROVIDER_BLOCK_CONFIRMED: no` |
| Other status | `RAILWAY_PROVIDER_BLOCK_CONFIRMED: inconclusive — see notes` |

**RAILWAY_PROVIDER_BLOCK_CONFIRMED: `[yes / no / inconclusive]`**

Evidence: HTTP status from Railway = `[FILL IN]`, HTTP status from residential = `[FILL IN from probe-residential.md]`

---

## Additional Railway shell probes (optional, if Railway CLI access is available)

```bash
# From Railway shell (railway run bash):
# 1. Verify ffmpeg/ffprobe are present
ffmpeg -version 2>&1 | head -3
ffprobe -version 2>&1 | head -3

# 2. Direct curl from Railway egress IP
#    Use the real URL — do NOT commit output if credentials appear
curl -v -L --max-time 10 "<real-url>" -o /dev/null 2>&1 | grep -E "^[<>*]"
```

If Railway CLI is not available, the diag endpoint result above is sufficient to confirm or deny the block.
