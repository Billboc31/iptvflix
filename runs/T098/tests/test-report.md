---

## Test Report — T098

### Implementation: PASS

All 14 acceptance criteria are satisfied at the code level:

- `accounts` table, extended `profiles` schema, and `profile_interaction_events` table all exist with the correct columns and migration (`0035_t098_account_profile_foundation.sql`)
- `POST /auth/login` validates against the `accounts` table using bcrypt; JWT carries `accountId`
- `plugins/auth.ts` verifies profile ownership on every request (prevents stale-token cross-account access)
- All personalization routes (`watchlist`, `viewing-progress`, `feedback`, `taste`, `shelves`, `profile`) use `request.profileId!` — no hardcoded `DEFAULT_PROFILE_ID` in routes
- `POST /profiles/:id/select` issues a new JWT with `profileId`; cross-account access returns 403
- `POST /interaction-events` validates `eventType` against the allowlist and stores under `request.profileId`
- `runSeed()` is idempotent: links pre-T098 default profile to the default account without data loss
- `isKids` + `maturityLevel` present on schema, no catalog filtering enforcement added

---

### Test Suite: FAIL — 6 Blocking Issues

All regressions are test-infrastructure gaps, not production bugs:

| # | File | Problem | Fix |
|---|---|---|---|
| B1 | `auth.test.ts` (3 fails) | Route now queries DB but test doesn't mock `db/client.js` → 500 | Add `vi.mock('../db/client.js', ...)` with account select stub |
| B2 | `shelves.test.ts` (11 fails) | Routes use `request.profileId!` but test app has no preHandler setting it → 403 | Add `app.addHook('preHandler', req => { req.profileId = PROFILE_ID })` |
| B3 | `playback-integration.test.ts` (collection) | `EMPTY_PREFS` const used inside hoisted `vi.mock` factory → ReferenceError | Wrap with `vi.hoisted(() => ({...}))` |
| B4 | `vitest.config.ts` (profiles + playback-resolver collection) | `DATABASE_URL` not set; `env.ts` throws at import | Add `DATABASE_URL: 'postgresql://placeholder'` to vitest config env |
| B5 | `profiles.test.ts:310` (1 fail → 500) | `reply.setCookie` requires `@fastify/cookie` plugin not registered in test app | Register `cookie` plugin in `buildProfilesApp()` |
| B6 | `profiles.test.ts:164` (TS error) | JWT mock missing `options`/`lookupToken` → compile error | Cast: `app.decorate('jwt', mock as unknown as JWT)` |

Pre-existing failures on `main` (title-matching-service, vertical-slice, arrival-service, etc.) are out of scope.

The full report is at `runs/T098/tests/report.md`.
