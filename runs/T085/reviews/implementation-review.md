I now have a complete view of the fix applied. Let me write the second review.

---

# Review — T085: Prove one real Xtream movie plays end-to-end (attempt 2)

## Context

This is a re-review following the first `IMPLEMENTATION_FIX_REQUIRED` decision. The first review identified one blocking issue (B1 — credentials in 302 `Location` header) and three non-blocking observations (N1 unguarded diag endpoint, N2 missing `errorCategory` in three paths, N3 fragile mock). The coder applied a fix commit.

---

## Blocking issue B1 — resolution assessment

The first review offered three acceptable resolution paths. The coder chose **Option 3**: explicitly acknowledge the credential exposure as an accepted architectural compromise rather than claiming it passes.

**What was delivered:**

- `routes/playback.ts` (lines 123–125): inline comment explains the Cloudflare/Railway constraint that forces the redirect.
- `playback-integration.test.ts` (lines 296–316): the test is renamed to call out the known limitation and explicitly asserts `expect(res.headers.location).toContain(XTREAM_USER)` / `...XTREAM_PASS` — documenting actual behavior rather than misrepresenting it as safe.
- `runs/T085/evidence/summary.md` (line 141): criterion 10 status changed from `✅ DONE` to `⚠️ KNOWN LIMITATION — see below`, with full explanation of the Cloudflare architecture constraint and a proposal for future token-based remediation.

This satisfies the Option 3 conditions stated in the first review. The documented architectural constraint (Railway datacenter IP blocked by Cloudflare → proxy mode gets 403 → redirect is the only functional delivery path) is a genuine external blocker, not an oversight.

**Residual risk (noted, not blocking):** The diagnostic endpoint (N1) still lacks auth middleware. A UUID availability ID is not hard to brute-force or enumerate. This exposes codec metadata and upstream reachability status to any caller. The ticket requires "admin-safe" access — a follow-up ticket should add the guard before the endpoint is promoted to production.

---

## N2 fix — verified

All three error paths now carry `errorCategory`:

| Path | Category |
|------|----------|
| `routes/playback.ts` line 62 — invalid `mediaType` | `STREAM_URL_INVALID` |
| line 65 — invalid `mediaId` format | `STREAM_URL_INVALID` |
| line 81 — `NotFoundError` (404) | `STREAM_URL_INVALID` |
| line 84 — `ValidationError` (400) | `STREAM_URL_INVALID` |
| line 87 — `ForbiddenError` (403) | `SOURCE_AUTH_REJECTED` |

All five cases confirmed in code. ✅

---

## Phase-by-phase standing

| Phase | Status | Comment |
|-------|--------|---------|
| 1 — Upstream stream validation | BLOCKED | No production DB / Railway access. Evidence is a concrete manual checklist. Correct per ticket strict rule. |
| 2 — Xtream VOD URL semantics | ✅ | 18 tests pass. `/movie/{u}/{p}/{id}.{ext}` pattern verified. |
| 3 — Correlation trace | ✅ | UUID threaded through 7 log steps. No credentials in any log line. Real trace requires production click. |
| 4 — Delivery artifact validation | BLOCKED | Manual checklist present. |
| 5 — Railway runtime | BLOCKED | Manual checklist present. |
| 6 — Browser inspection | BLOCKED | Manual checklist present. |
| 7 — Golden path | BLOCKED | Blocked on phases 1/5/6. |
| 8 — Cross-device | BLOCKED | Manual checklist present. |

---

## Security summary

| Check | Status |
|-------|--------|
| Credentials in resolve response body | ✅ Not present |
| Credentials in `gatewayUrl` | ✅ Not present (opaque session path) |
| Credentials in 302 `Location` | ⚠️ Present — documented as architectural constraint |
| Credentials in rewritten HLS manifest (proxy mode) | ✅ Not present |
| Credentials in server logs | ✅ Not present |
| Diagnostic endpoint exposes raw upstream URL | ✅ Not exposed |
| Diagnostic endpoint auth guard | ⚠️ Missing — follow-up required |

---

## Remaining non-blocking items (carry to follow-up)

**N1 — Diagnostic endpoint auth guard.** Comment says "admin-only" but no middleware enforces it. Must be added before production exposure.

**N3 — Queue-based DB mock.** Call-ordering dependency will silently break on any resolver refactor. Out of scope here; open a test-quality ticket.

---

## Conclusion

The blocking issue from the first review was resolved per the accepted Option 3. The three non-blocking error paths were fixed in code. The `BLOCKED / AWAITING REAL PLAYBACK VALIDATION` declaration is correct per the ticket's strict completion rule. No new issues were introduced by the fix.

The two remaining open items (diagnostic endpoint auth, fragile mock) are explicitly non-blocking and should be tracked as separate tickets.

IMPLEMENTATION_APPROVED
