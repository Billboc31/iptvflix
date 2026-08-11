# Test Report — T004: Implement IPTV source management

**Date**: 2026-08-11  
**Branch**: ticket/T004-implement-iptv-source-management  
**Test suite**: 18 tests across 3 files — all pass

---

## Test Execution

```
pnpm --filter api run test

 ✓ src/config/env.test.ts     (1 test)   5ms
 ✓ src/routes/health.test.ts  (2 tests) 10ms
 ✓ src/routes/sources.test.ts (15 tests) 26ms

 Test Files  3 passed (3)
      Tests  18 passed (18)
   Duration  530ms
```

---

## Acceptance Criteria

### ✅ AC1 — An Xtream Codes source can be created with server URL, username, and password

- `POST /sources` accepts `{ name, type: 'XTREAM', baseUrl, username, password }` and returns 201.
- Schema (`sources.ts`) defines `baseUrl`, `username`, `password` fields.
- Route validates `name`, `type`, `baseUrl` as required; returns 400 if missing.
- Covered by test: _"creates a valid XTREAM source and returns 201 without password"_.

### ✅ AC2 — Source list/detail endpoints never return the clear-text password

- `SourceResponse` type in `api-contracts` has no `password` field.
- `toResponse()` in service layer strips password via destructuring before any return path.
- Verified across: `POST`, `GET /sources`, `GET /sources/:id`, `PATCH /sources/:id` responses.
- Tests explicitly assert `expect(body).not.toHaveProperty('password')` in all four scenarios.

### ✅ AC3 — Credentials are not written to application logs

- Test _"does not write the password to log output during source creation"_ captures Fastify's log stream and asserts the password string does not appear.
- Fastify does not log request bodies at `info` level by default, so credentials in POST body are not exposed.

### ✅ AC4 — A source connection can be tested and returns a clear success/failure result

- `POST /sources/:id/test` returns `{ ok: boolean, message: string }` in all cases.
- Success: `{ ok: true, message: 'Connection successful' }` when server responds 200 with valid JSON.
- Failure cases return `ok: false` with a human-readable, non-empty message.

### ✅ AC5 — Invalid or unreachable source configurations are handled without crashing the API

- Unreachable host (`TypeError`) → `{ ok: false, message: 'Could not reach the host' }`, HTTP 200.
- Timeout (`DOMException/TimeoutError`) → `{ ok: false, message: 'Connection timed out after 5 seconds' }`, HTTP 200.
- HTTP error response → `{ ok: false, message: 'Server responded with HTTP <status>' }`.
- Invalid JSON response → `{ ok: false, message: 'Server response is not valid JSON' }`.
- Missing required fields on create → 400, no crash.
- Unknown source ID → 404, no crash.

### ✅ AC6 — Sources can be enabled/disabled without deleting their configuration

- `PATCH /sources/:id` with `{ enabled: false }` updates the source and returns it with `enabled: false`.
- `DELETE /sources/:id` is a separate endpoint; disabling does not delete.
- Test: _"disables a source and returns it with enabled: false"_.

### ✅ AC7 — The domain can represent an M3U source

- `sourceTypeEnum` in schema includes `'M3U'`.
- `SourceType` union in `api-contracts` includes `'M3U'`.
- A source with `type: 'M3U'` can be created via `POST /sources`.
- Connection test returns `{ ok: false, message: 'M3U connection test not yet implemented' }` without crashing.

### ✅ AC8 — Automated tests cover validation, secret redaction, and error cases

| Category | Tests present |
|---|---|
| Validation | missing fields → 400; invalid type → 400 |
| Secret redaction | password absent from POST, GET list, GET detail, PATCH responses |
| Error cases | 404 for unknown ID on GET/PATCH/DELETE; timeout and unreachable host on test |
| Log leak | password not written to log stream |

---

## Issues Found

### ⚠️ Non-blocking — TypeScript type error in test file

**Location**: `apps/api/src/routes/sources.test.ts:297`  
**Command**: `pnpm --filter api run typecheck` → exit 2

```
error TS2322: Type '"M3U"' is not assignable to type '"XTREAM"'.
```

**Cause**: `setupSelect` is typed as `(rows: (typeof mockSource)[])` where `mockSource.type` is `'XTREAM' as const`. Overriding with `{ ...mockSource, type: 'M3U' as const }` produces a type mismatch because the spread type is still narrowed to `XTREAM`.

**Impact**: Tests run and pass at runtime (Vitest does not type-check). The type error is caught only by `tsc --noEmit`. The tested behavior (M3U graceful failure) is correct.

**Fix** (minimal): broaden the `rows` parameter of `setupSelect` to accept a looser type, e.g. `Array<Partial<typeof mockSource> & Record<string, unknown>>`, or cast at the call site.

---

## Regressions

- Health check tests: **pass** (2/2) — no regression.
- Env config tests: **pass** (1/1) — no regression.

---

## Verdict

**VALIDATION: PASS with minor issue**

All 8 acceptance criteria are satisfied. The implementation is functionally correct, secrets are properly redacted, and error handling is solid. One non-blocking TypeScript type error exists in the test file (`sources.test.ts:297`) that should be fixed before merge to keep `typecheck` clean.
