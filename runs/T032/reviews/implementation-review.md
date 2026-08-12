The implementation is a clean, minimal diff. Here is the structured review.

---

## Review — T032: expose Vite dev server on 0.0.0.0

### Summary

**One-line diff** — `+host: '0.0.0.0'` inserted in the `server` block of `apps/web/vite.config.ts`. Nothing else was touched.

---

### Correctness relative to ticket requirements

| Requirement | Status |
|---|---|
| `server.host: '0.0.0.0'` in vite.config.ts | **Done** |
| Port unchanged (no change to `VITE_DEV_PORT` / `5173` logic) | **Done** |
| Proxy `/api` untouched | **Done** — `target` and `rewrite` are identical to main |
| No new dependencies introduced | **Done** |

> **Note on port discrepancy**: the ticket mentions port `5174` but the config uses `VITE_DEV_PORT` with fallback `5173`. The plan explicitly excludes the port from scope, which is the right call — the ticket's `5174` reference is likely a documentation approximation. No action needed.

---

### Scope compliance

The change is perfectly bounded to the ticket. No surrounding code was refactored, no new abstractions added, no other files modified. Scope compliance is **perfect**.

---

### Code quality

- Placement is correct: `host` is the first property in the `server` block, which matches Vite's recommended documentation order (`host`, then `port`, then `strictPort`, then `proxy`).
- No comment added (unnecessary for a self-explanatory config key).
- No magic, no hidden behavior.

---

### Security

Binding on `0.0.0.0` is the explicit goal of the ticket (Tailscale/LAN access). The risk surface is a dev-only server, no production config is touched. Acceptable in context.

---

### Test impact

The unit tests listed under `apps/web/src/` are Vitest component tests — they do not depend on the dev-server binding address and are unaffected. No E2E suite was found, consistent with the plan's note that Playwright tests are absent.

---

### Blocking issues

None.

---

### Minor observations

None.

---

**Verdict**: the implementation is minimal, correct, and fully compliant with the ticket.

IMPLEMENTATION_APPROVED
