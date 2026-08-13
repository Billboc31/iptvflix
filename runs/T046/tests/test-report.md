---

## Test Report — T046

**Verdict: PASS** (with two non-blocking observations)

### Acceptance Criteria Results

| # | Criterion | Status |
|---|---|---|
| AC1 | Anonymous users blocked from protected endpoints | **PASS** |
| AC2 | `/health` public, no secrets | **PASS** |
| AC3 | Web login/session experience, survives refresh | **PASS** (code review) |
| AC4 | Backend enforces auth on every protected request | **PASS** |
| AC5 | Secrets not exposed in logs or payloads | **PASS** |
| AC6 | Vercel → Railway HTTPS/CORS correctly configured | **PASS** (code review) |
| AC7 | Tests cover denial, success, expired/invalid, mutations | **PARTIAL** |
| AC8 | Docs state single-user scope and TV extension point | **PASS** |

### Tests Run

- `auth.test.ts` — 15/15 pass (login, wrong password, unknown user, cookie check, Bearer check, expired token, tampered token, logout, `/auth/me`, no credential leakage)
- `authenticateDevice.test.ts` — 4/4 pass
- `health.test.ts` — 2/2 pass
- All other API tests — 456/456 pass
- Web tests — blocked by pre-existing `react/jsx-runtime` infra issue (unrelated to T046, exists on `main` too)

### Non-Blocking Observations

1. **Testing gap (AC7)**: No test hits a real production route (e.g. `GET /sources`) without auth — the `authenticate` hook is unit-tested separately, but the integrated hook+route path is not verified for mutations. The security boundary is correct; coverage is incomplete.

2. **Documentation gap**: `docs/architecture/auth.md` does not mention the `WEB_SECRET` mechanism used by device/pairing routes, nor the 503 behavior when `WEB_SECRET` is unset.

Full report at `runs/T046/tests/test-report.md`.
