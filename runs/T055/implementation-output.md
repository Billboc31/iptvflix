Build is clean. Here's a summary of all fixes applied:

---

**BLOQUANT 1 — Token not reaching TV** ✅

- `db/schema/devices.ts`: added `deviceToken: varchar('device_token', { length: 64 })` to `pairingCodes`
- `migrations/0021_tv_pairing_commands.sql`: added `"device_token" varchar(64)` column to `pairing_codes` CREATE TABLE
- `migrations/meta/0021_snapshot.json`: updated snapshot to reflect the new column
- `services/pairing.service.ts`: `approvePairingCode` now stores the plain-text token in `pairingCodes.deviceToken`; `getPairingStatus` now returns `row.deviceToken ?? undefined` instead of `undefined`

**BLOQUANT 2 — No Web auth on approval/management routes** ✅

- `config/env.ts`: added `WEB_SECRET` export
- `middleware/authenticateWeb.ts`: new middleware — checks `Authorization: Bearer <WEB_SECRET>`; returns 401 if missing/wrong, 503 if `WEB_SECRET` env var is not configured
- `routes/pairing.ts`: `GET /pairing/codes/:code` and `POST /pairing/codes/:code/approve` now guarded
- `routes/devices.ts`: all three device management routes now guarded
- `routes/commands.ts`: `POST /devices/:id/commands` now guarded

**Stale state fix** ✅

- `services/command.service.ts`: `getPendingCommands` now returns `state: 'delivered'` in the response for rows that were just transitioned (was returning stale `'pending'`)

**Missing test: revoked device cannot authenticate** ✅

- `middleware/authenticateDevice.test.ts`: new test file with 4 tests covering no-token, unknown-token, revoked-device (returns 401), and valid-token paths

**Test count: 39 files, 545 tests — all green. TypeScript build: clean.**
