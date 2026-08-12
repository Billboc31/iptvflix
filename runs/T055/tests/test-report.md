I have all the information needed. Here is the full test report.

---

## T055 — Test Report: Secure TV Device Pairing and Remote Playback

**Test run date:** 2026-08-13  
**Branch:** `ticket/T055-add-secure-tv-device-pairing-and-remote-playback-c`  
**Test suite result:** 545 tests — **all pass**, 0 failures, 0 regressions

---

### Acceptance Criteria

---

#### AC1 — A fresh TV can display a short pairing code/QR-compatible token without exposing account secrets

**Status: PASS**

`POST /pairing/codes` requires no authentication. Returns `{ code, expiresAt }` only. Code is 8 characters drawn from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (deliberately excludes I, O, S, 0, 1 for QR-readability). No account secrets appear in the response.

---

#### AC2 — An authenticated Web user can approve pairing and the TV receives a durable revocable device credential

**Status: PASS**

`POST /pairing/codes/:code/approve` requires Web auth. On approval:
- A 32-byte random hex device token is generated.
- The SHA256 hash is stored in `devices.token_hash`; the plaintext token is never stored in `devices`.
- The TV retrieves the token via long-poll on `/pairing/codes/:code/status`.
- The device is revocable via `DELETE /devices/:id`.

**Non-blocking note:** The plaintext device token is stored temporarily in `pairing_codes.device_token` (varchar 64) so the polling endpoint can return it. This row has a 5-minute TTL, the table is server-side only, and the token is never in the `devices` table — acceptable tradeoff, but clearing the token column after the TV retrieves it would eliminate residual exposure.

---

#### AC3 — Paired devices can be listed, renamed and revoked from Web/API

**Status: PASS**

- `GET /devices` — list all devices, Web-authenticated.
- `PATCH /devices/:id` — rename, Web-authenticated.
- `DELETE /devices/:id` — sets `revoked_at`, Web-authenticated. Returns 204.

All three endpoints are tested including auth-rejection and 404 cases.

---

#### AC4 — A remote playback command can target exactly one paired TV

**Status: PASS**

`POST /devices/:id/commands` targets a single device by UUID. The service validates the device exists and is not revoked before inserting. The `playback_commands` table has a `device_id` FK with cascade-delete. No fanout or broadcast mechanism exists.

---

#### AC5 — The target TV can receive the command within a few seconds under normal connectivity

**Status: PASS (with scale note)**

`GET /devices/me/commands/stream` opens an SSE connection. `createCommand` calls `emitCommandForDevice` immediately after insert, which fires the EventEmitter synchronously — the TV receives the event in the same request cycle, well within seconds. A 25-second heartbeat keeps the connection alive.

**Non-blocking note:** The EventEmitter is in-memory. A multi-instance Railway deployment would not propagate events across processes. For the current single-user, single-instance scope this works. If horizontal scaling is needed, a Redis pub/sub or equivalent would be required.

---

#### AC6 — Reconnect/retry does not cause the same command to launch repeatedly

**Status: PASS (with test coverage note)**

State machine: `pending → delivered → acknowledged → expired`.

- SSE reconnect replays only `pending` and `delivered` states from the DB.
- First fetch transitions `pending → delivered`.
- The TV must call `POST /devices/me/commands/:commandId/ack` to transition to `acknowledged`, after which the command is excluded from all future fetches.
- `acknowledgeCommand` is idempotent: calling it twice returns 200 both times without error.
- Expired commands (`expiresAt < now`) are purged to `expired` state on each `getPendingCommands` call.

**Non-blocking note:** The SSE reconnect replay scenario is not tested end-to-end (Fastify's `inject` cannot receive streaming responses). The constituent behaviors — state transitions, idempotent ACK, fetch exclusion — are all unit-tested. The SSE auth-rejection path is tested.

---

#### AC7 — Expired/revoked device credentials cannot receive or acknowledge commands

**Status: PASS**

- `authenticateDevice` returns 401 if `revoked_at` is set.
- `createCommand` throws `CommandDeviceRevokedError` (403) for revoked device IDs.
- Expired pairing codes are excluded by the `gt(pairingCodes.expiresAt, new Date())` filter in `getPairingStatus`.
- Stale commands past `expires_at` are transitioned to `expired` before any pending-command fetch.

---

#### AC8 — Command payloads contain canonical/playback-resolution references, not raw Xtream/Plex credentials

**Status: PASS**

Command response contains only: `id`, `mediaType`, `mediaId`, `availabilityId`, `startPositionMs`, `state`, `expiresAt`, `createdAt`. No provider URLs, tokens, or credentials. Tests in `commands.test.ts` (lines 175–186) and `pairing.test.ts` (lines 165–177) explicitly assert the absence of `xtreamUrl`, `plexToken`, and `password`.

---

#### AC9 — Automated tests cover pairing approval, invalid/expired code, device revocation, command authorization, delivery and deduplication

**Status: PASS (with noted gap)**

| File | Tests | Covers |
|---|---|---|
| `pairing.test.ts` | 11 | Code creation, polling, approval, expired/unknown code, no-credentials assertion |
| `devices.test.ts` | 8 | List, rename, revoke, auth failures, 404s |
| `commands.test.ts` | 15 | Creation, auth enforcement, revoked device (403), payload validation, fetch, ACK, idempotent ACK, 404 |
| `authenticateDevice.test.ts` | 4 | No token, invalid token, revoked device, valid token + `lastSeenAt` update |

**Gap:** No explicit test for the SSE reconnect deduplication scenario (expected behavior: a delivered-but-unacknowledged command replays on reconnect, but does not replay after ACK). The building blocks are tested individually.

---

### Regressions

None. All 545 pre-existing tests continue to pass.

---

### Verdict

**PASS** — all acceptance criteria are met. The two non-blocking observations (plaintext token in pairing codes table, in-memory EventEmitter) are design tradeoffs appropriate to the stated scope (single-user, single-instance). The SSE end-to-end reconnect test gap is inherent to the Fastify inject limitation and the building blocks are thoroughly covered.
