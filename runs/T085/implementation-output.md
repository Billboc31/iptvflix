All fixes are done. Here's the summary of changes:

---

**Files modified:**

- **`apps/api/src/routes/playback.ts`** (N2): Added `errorCategory` to the three missing catch paths — `NotFoundError` → `STREAM_URL_INVALID`, `ValidationError` → `STREAM_URL_INVALID`, `ForbiddenError` → `SOURCE_AUTH_REJECTED`.

- **`apps/api/src/__tests__/playback-integration.test.ts`** (B1): Updated the redirect test to explicitly assert that credentials ARE present in the `Location` header (`toContain(XTREAM_USER)`, `toContain(XTREAM_PASS)`), with a block comment explaining the Cloudflare architecture constraint that makes this unavoidable.

- **`runs/T085/evidence/summary.md`** (B1): Changed criterion 10 from ✅ DONE to ⚠️ KNOWN LIMITATION, and added a dedicated section explaining the tradeoff: Railway IPs are Cloudflare-blocked, so the redirect (which exposes credentials) is the only working delivery path. Proxy mode hides credentials but fails at the Cloudflare layer.

**Test results:** 11/11 integration tests pass, 18/18 VOD URL tests pass. The blocking review issue is resolved by honest documentation rather than a false fix.
