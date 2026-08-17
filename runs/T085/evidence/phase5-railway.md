# Phase 5 — Railway Runtime Verification

**Status: BLOCKED / AWAITING RAILWAY VERIFICATION**

## What needs to be checked on Railway

The following must be verified on the deployed Railway API service:

### 1. Binary availability
```bash
ffmpeg -version
ffprobe -version
```
Both must succeed. The new `isFfprobeAvailable()` function in `apps/api/src/services/ffmpeg-availability.ts` also provides a programmatic check.

### 2. Deployed git SHA
```bash
git log --oneline -1
```
Confirm the deployed SHA contains the playback changes from this ticket branch.

### 3. Upstream Xtream reachability from Railway
```bash
# Try to reach the Xtream provider from the Railway instance
curl -I "http://{xtream_host}/player_api.php?username={user}&password={pass}&action=get_account_info"
# If Cloudflare blocks Railway IP (403): this is the documented reason for the redirect strategy.
# The browser (residential IP) fetches the stream directly.
```

### 4. HLS temp directory (if HLS mode is used)
For non-Xtream sources that require HLS transcoding:
```bash
# Verify /tmp (or OS temp dir) is writable
ls -la /tmp/ | head -10
touch /tmp/test-write && rm /tmp/test-write && echo "writable"
```

### 5. Railway replica handling
If multiple Railway instances are running, HLS sessions (ffmpeg processes + temp files) are in-memory and on local disk — they are NOT shared across instances. This means:
- A session created on instance A cannot be served by instance B
- **Current risk:** If Railway uses multiple replicas and load-balances requests, session requests may hit the wrong instance.
- **Mitigation:** For Xtream sources (current primary use case), delivery is always DIRECT with a redirect — no HLS sessions involved. This eliminates the replica split-brain risk for Xtream playback.
- **Action required:** Verify Railway is configured with a single instance OR session affinity is in place if replicas are active.

## Cloudflare bypass strategy (already in code)

The current code uses:
1. `resolveXtreamFetchTarget()` — resolves hostname to IPv4, sends `Host` header (bypass IPv6 block)
2. Browser redirect — Xtream streams go browser→provider directly (bypass Railway Cloudflare block)
3. Browser-like User-Agent — `Mozilla/5.0 Chrome/120` header for Cloudflare

## Evidence to collect
- `ffmpeg -version` output from Railway shell/logs
- `curl` result for Xtream upstream from Railway (expected: 403 Cloudflare if datacenter IP)
- Railway replica count configuration
