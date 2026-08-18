# T098 — Test Report

**Date**: 2026-08-18  
**Branch**: ticket/T098-introduce-account-profile-foundation-and-move-all  
**Tester**: Claude (automated)

---

## Acceptance Criteria Status

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | First-class Account → Profile relationship exists | **PASS** | `accounts` table created; `profiles.accountId` FK; `0035_t098_account_profile_foundation.sql` migration |
| 2 | Existing auth continues working | **PASS** | `POST /auth/login` queries `accounts` table via bcrypt; JWT payload carries `accountId` |
| 3 | Existing users migrate to Account with default Profile without losing state | **PASS** | `runSeed()` is idempotent; links pre-T098 profile `00000000-…-0001` to default account; no data loss via safe `ALTER TABLE IF NOT EXISTS` |
| 4 | Current profile can be selected and securely resolved server-side | **PASS** | `POST /profiles/:id/select` issues JWT with `profileId`; `plugins/auth.ts` verifies ownership on every request |
| 5 | Watch progress is profile-scoped | **PASS** | `viewing-progress.ts` uses `request.profileId!`; `upsertProgress` accepts explicit profileId |
| 6 | Continue Watching is profile-scoped | **PASS** | `viewing-progress.ts` uses `request.profileId!` for `listContinueWatching` |
| 7 | My List is profile-scoped | **PASS** | `watchlist.ts` uses `request.profileId!` for all operations |
| 8 | Watched episode/movie state is profile-scoped | **PASS** | Progress/watchlist both use profileId from session |
| 9 | Playback/audio/subtitle/skip preferences are profile-scoped | **PASS** | All prefs stored on `profiles` row; `updateProfilePreferences` scoped by profileId |
| 10 | Interaction events stored by profile | **PASS** | `POST /interaction-events` inserts under `request.profileId`; schema has FK → profiles ON DELETE CASCADE |
| 11 | Account-shared sources remain shared | **PASS** | Sources not duplicated; `sources` table has no `profileId` column |
| 12 | Profiles from another account are inaccessible | **PASS** | `selectProfile`, `getCurrentProfile`, `updateProfile`, `deleteProfile` all filter by `accountId` |
| 13 | Kids/maturity fields present (future-compatible) | **PASS** | `isKids boolean NOT NULL DEFAULT false` and `maturityLevel text` on profiles schema |
| 14 | No DB reset required | **PASS** | All columns added with `IF NOT EXISTS`; FK nullable until seed links it |

**Implementation verdict: PASS** — all 14 acceptance criteria satisfied at the code level.

---

## Test Suite Results

### T098-specific test file: `src/__tests__/profiles.test.ts`

**18 tests defined; 17 pass, 1 fails when run with `DATABASE_URL` set.**

| Test | Result |
|---|---|
| POST /profiles — returns 409 at maxProfiles | PASS |
| POST /profiles — returns 201 under limit | PASS |
| POST /profiles — returns 400 for missing name | PASS |
| DELETE /profiles — returns 409 for last profile | PASS |
| DELETE /profiles — returns 204 when second profile exists | PASS |
| POST /:id/select — returns 403 for cross-account profile | PASS |
| POST /:id/select — returns 200 with token for own account | **FAIL** |
| Watch progress scoped to profile A id | PASS |
| Watchlist — profile A1 returns only its entries | PASS |
| Watchlist — profile A2 returns empty independently | PASS |
| Preferences — updateProfilePreferences updates only specified profile | PASS |
| POST /interaction-events — stores event and returns 204 | PASS |
| POST /interaction-events — returns 400 for unknown eventType | PASS |
| POST /interaction-events — returns 400 when eventType missing | PASS |
| runSeed — does not duplicate account when one exists | PASS |
| runSeed — links pre-T098 profile to default account | PASS |
| runSeed — creates account and profile on fresh DB | PASS |
| GET /profiles — returns only own account's profiles | PASS |

**Failure detail**: `POST /profiles/:id/select — returns 200 with token when profile belongs to own account`  
→ Got **500** instead of 200.  
**Root cause**: `buildProfilesApp()` in the test does not register `@fastify/cookie`, so `reply.setCookie(...)` inside the select route throws at runtime.

---

## Regressions Introduced by T098

### 1. `src/routes/auth.test.ts` — 3 failures (BLOCKING)

**Tests**: `returns 200 and sets httpOnly cookie`, `returns 401 with wrong password`, `returns 401 for unknown username`  
**Symptom**: All three get **500** instead of 200/401.  
**Root cause**: `POST /auth/login` was rewritten from env-var comparison to a real `db.select().from(accounts)` query. `auth.test.ts` mocks `env.js` and `bcrypt` but does **not** mock `../db/client.js`. The db client attempts to connect to the mock URL `postgres://test`, fails, and throws an unhandled error → 500.  
**Fix needed**: Add `vi.mock('../db/client.js', ...)` with a db select chain stub to `auth.test.ts`.

---

### 2. `src/routes/__tests__/shelves.test.ts` — 11 failures (BLOCKING)

**Tests**: `POST /shelves/:id/members`, `PUT /shelves/:id/members/order`, `PATCH /shelves/:id`, `DELETE /shelves/:id`, and the six `GET /shelves/:id dynamic availability evaluation` tests.  
**Symptom**: All get **403** instead of expected 2xx.  
**Root cause**: The shelves routes were migrated from `DEFAULT_PROFILE_ID` (hardcoded UUID) to `request.profileId!`. The existing test app (`const app = Fastify(...)`) has no `preHandler` that sets `request.profileId`. The shelf service receives `undefined` as profileId, finds no owned shelf → throws `ForbiddenError` → 403.  
**Fix needed**: Add `app.addHook('preHandler', async (req) => { req.profileId = PROFILE_ID })` to the shelves test app setup.

---

### 3. `src/__tests__/playback-integration.test.ts` — collection failure (BLOCKING)

**Symptom**: `ReferenceError: Cannot access 'EMPTY_PREFS' before initialization`  
**Root cause**: T098 extracted `EMPTY_PREFS` as a module-level `const` but referenced it inside a `vi.mock(...)` factory. `vi.mock` calls are hoisted by Vitest to the top of the module before any `const` declarations, so `EMPTY_PREFS` is `undefined` (temporal dead zone) when the mock factory executes.  
**Fix needed**: Change `const EMPTY_PREFS = {...}` to `const EMPTY_PREFS = vi.hoisted(() => ({...}))`, or inline the object directly in the mock factory.

---

### 4. `src/__tests__/profiles.test.ts` + `src/services/__tests__/playback-resolver.test.ts` — collection failures in full suite (BLOCKING)

**Symptom**: Both fail at collection with `Error: DATABASE_URL is not configured` when run as part of the full suite.  
**Root cause**: These test files import `seed.ts` / `playback-resolver.ts` which transitively import `config/env.ts`. `env.ts` throws immediately if `DATABASE_URL` is not set. `vitest.config.ts` was not updated to include a placeholder `DATABASE_URL`.  
**Fix needed**: Add `DATABASE_URL: 'postgresql://test:test@localhost/test'` to the `env` section of `apps/api/vitest.config.ts`. The actual DB is mocked so the URL is never used.

---

### 5. TypeScript compile error in `profiles.test.ts` (BLOCKING)

**Location**: `src/__tests__/profiles.test.ts:164`  
**Error**: `app.decorate('jwt', { sign, verify, decode })` — mock object is not assignable to `JWT` type (missing `options` and `lookupToken`).  
**Fix needed**: Cast the mock to `unknown as JWT` or use `app.decorate('jwt', mockJwt as unknown as JWT)`.

---

## Non-T098 Failures (Pre-existing, Out of Scope)

The following failures exist on `main` and are unchanged by T098:

| File | Nature |
|---|---|
| `src/services/__tests__/title-matching-service.test.ts` | 1 test — unrelated logic regression |
| `src/__tests__/integration/vertical-slice.test.ts` | 1 test — sync run status race |
| `src/services/__tests__/arrival-service.test.ts` | DB connection error (no mock) |
| `src/services/__tests__/follow-release-service.test.ts` | DB connection error |
| `src/services/__tests__/media-reconciliation-service.test.ts` | DB connection error |
| `src/services/__tests__/media-relay-runtime.test.ts` | DB connection error |
| `src/services/__tests__/scheduler-service.test.ts` | DB connection error |

These are all pre-existing and out of scope for this ticket.

---

## Blocking Issues Summary

| # | File | Type | Severity |
|---|---|---|---|
| B1 | `auth.test.ts` | Missing `db/client.js` mock | BLOCKING |
| B2 | `shelves.test.ts` | Missing `request.profileId` in test preHandler | BLOCKING |
| B3 | `playback-integration.test.ts` | `EMPTY_PREFS` hoisting violation | BLOCKING |
| B4 | `vitest.config.ts` | Missing `DATABASE_URL` placeholder | BLOCKING |
| B5 | `profiles.test.ts:310` | Missing `@fastify/cookie` plugin in test app | BLOCKING |
| B6 | `profiles.test.ts:164` | TypeScript type error in JWT mock | BLOCKING |

---

## Verdict

**IMPLEMENTATION: PASS** — All acceptance criteria are satisfied at schema, service, and route level.

**TEST SUITE: FAIL** — 6 blocking test issues must be fixed before the ticket can be closed. None of the regressions affect production behavior; all are test infrastructure gaps introduced alongside the implementation.
