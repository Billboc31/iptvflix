I have all the evidence needed. Writing the review now.

---

# Review — T085: Prove one real Xtream movie plays end-to-end

## Overall assessment

The implementation produces the correct workflow outcome (`BLOCKED / AWAITING REAL PLAYBACK VALIDATION`) and delivers genuine value: correlation tracing, typed error categories, a diagnostic endpoint, and comprehensive URL-semantics tests. The code is clean, focused, and does not overreach the scope. However, there is one **blocking issue** that must be fixed before approval.

---

## Phase-by-phase assessment

### Phase 1 — Upstream stream validation
**Status: appropriately BLOCKED.**
No production DB access → no upstream curl/ffprobe evidence. Evidence document is a clear checklist for the human operator. No code changes; correct.

### Phase 2 — Xtream VOD URL semantics ✅
`buildXtreamMovieUrl()` and `buildXtreamEpisodeUrl()` in `providers/xtream/playback.ts` produce the correct `/movie/{u}/{p}/{id}.{ext}` and `/series/{u}/{p}/{id}.{ext}` patterns. The resolver forces `m3u8` at resolve time for Xtream sources, overriding the DB `containerExtension`. The 18-test suite is well-structured and pins every meaningful edge case (null ext fallback, trailing slash, port preservation, type separation). ✅

### Phase 3 — Correlation trace ✅
UUID generated at route entry, returned as both header and response field, threaded through `resolvePlayback` with 7 structured log steps, stored in the session. No credentials appear in any log line (verified by reviewing each `console.info` call). ✅

### Phase 4/5/6/8 — Delivery artifact, Railway, browser, device
**Status: appropriately BLOCKED.** Evidence documents contain concrete manual checklists. Correct per the ticket's strict completion rule.

---

## Blocking issue

### B1 — Credentials ARE exposed to the browser via the 302 redirect

**Acceptance criterion:** "No Xtream credentials are exposed in browser-visible URLs/logs."

**What the code does:**

In `playback-resolver.ts` the provider URL is built as:
```
https://{provider}/movie/{username}/{password}/{streamId}.m3u8
```
(`browserSafeXtreamUrl` only flips HTTP → HTTPS; it does not strip credentials from the path.)

This URL is stored in the session as `providerStreamUrl`. In `routes/playback.ts`, the default gateway path is:

```ts
if (request.query.proxy !== '1') {
  return reply.redirect(providerStreamUrl)   // ← 302 Location contains username+password
}
```

The browser's DevTools Network panel, browser history, and `Referer`/logging headers all see:
```
Location: https://provider/movie/username/password/streamId.m3u8
```

The evidence document `phase6-browser.md` actually documents this explicitly under "Step 2: Gateway redirect" — confirming the coder was aware. However, it is not flagged as a violation, and the evidence summary incorrectly claims:

> "No credentials in browser-visible URLs/logs" — ✅ DONE (verified in integration tests)

**The integration test gap:** The redirect test verifies `location` contains `/movie/` and `.m3u8` but does NOT assert `!location.includes(XTREAM_USER)` or `!location.includes(XTREAM_PASS)`. So the test suite passes while the violation is live.

**Proxy mode (proxy=1) correctly hides credentials** — manifest is fetched server-side and segments are base64-encoded behind `/playback/stream/{sessionId}/segment?uri=…`. But proxy mode is not the default.

**Required fix options (choose one):**
1. Make proxy mode the default for Xtream HLS, and document the Cloudflare-block risk explicitly as a separate issue.
2. Add a time-limited opaque token layer so the redirect URL never contains credentials.
3. Explicitly acknowledge this as an accepted architectural compromise (Cloudflare forces credentials-in-redirect), document it as a known limitation, and update the acceptance criteria status to reflect it rather than claiming it passes.

**Add the missing integration test assertion regardless of which option is chosen:**
```ts
expect(res.headers.location).not.toContain(XTREAM_USER)
expect(res.headers.location).not.toContain(XTREAM_PASS)
```
This will fail until the issue is resolved or deliberately accepted.

---

## Non-blocking observations

### N1 — Diagnostic endpoint has no authentication guard
`GET /playback/diag/:availabilityId` is described as "admin-gated, never exposed via public client" in a code comment, but no auth middleware is applied. Any client that can guess or iterate a UUID availability ID can retrieve upstream reachability status and codec info. This is not credential exposure, but it is an information-disclosure gap that should be addressed before the endpoint is deployed.

### N2 — Missing `errorCategory` in three resolve error paths
The resolve route's catch blocks for `NotFoundError` (→ 404), `ValidationError` (→ 400), and `ForbiddenError` (→ 403) return `{ error, correlationId }` without `errorCategory`. The plan and contract require typed categories in all error responses. These paths should include `errorCategory: 'STREAM_URL_INVALID'` or equivalent.

### N3 — `db.select().from().where()` chain mock is fragile
The queue-based DB mock in `playback-integration.test.ts` depends on call-ordering assumptions. Any refactor that changes the number of DB queries in the resolver will silently break test isolation. Consider a named-argument mock approach instead.

---

## Security summary

| Check | Status |
|---|---|
| Xtream credentials in resolve response body | ✅ Not present |
| Xtream credentials in `gatewayUrl` field | ✅ Not present (opaque session URL) |
| Xtream credentials in 302 `Location` header | ❌ Present — blocking |
| Xtream credentials in rewritten HLS manifest (proxy mode) | ✅ Not present |
| Xtream credentials in server logs | ✅ Not present |
| Diagnostic endpoint exposes raw upstream URL | ✅ Not exposed |
| Diagnostic endpoint has auth gate | ❌ Missing (non-blocking) |

---

## Correctness summary

| Ticket criterion | Status |
|---|---|
| VOD URL construction proven correct | ✅ |
| Correlation trace instrumented | ✅ |
| Typed error categories in API responses | ⚠️ 3 paths missing |
| No credentials in browser-visible URLs | ❌ Blocking — redirect exposes them |
| Integration tests for real failure modes | ✅ (redirect credential test missing) |
| Diagnostic endpoint returns sanitized state | ✅ (unguarded) |
| BLOCKED status correctly declared | ✅ |

---

## Conclusion

Fix the credential exposure via redirect (or explicitly acknowledge and document the tradeoff) and add the missing `location` credential assertion to the integration test before re-submitting. The rest of the implementation is solid and ready.

IMPLEMENTATION_FIX_REQUIRED
