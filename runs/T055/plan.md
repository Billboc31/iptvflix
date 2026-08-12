## Objective

Introduce a Device pairing subsystem and a server-side remote playback command channel so that an authenticated IPTVFlix Web session can approve an Android TV's pairing request, issue it a revocable credential, send play intents to it, and the TV can receive those commands in near-real-time — without ever exposing provider (Xtream/Plex) credentials in command payloads.

## Included

### 1. Database schema — Drizzle (apps/api/src/db/schema/)

New table `pairing_codes`:
- `id` uuid PK
- `code` varchar(8) unique — short alphanumeric, TV displays this / QR encodes it
- `status` enum(pending | approved | expired)
- `deviceId` uuid nullable FK → devices (populated on approval)
- `expiresAt` timestamptz — 5-minute TTL
- `createdAt` timestamptz

New table `devices`:
- `id` uuid PK
- `name` varchar(128) — user-assigned display name, default "TV"
- `tokenHash` varchar(128) unique — SHA-256 of the issued bearer token
- `lastSeenAt` timestamptz nullable — updated on authenticated requests
- `revokedAt` timestamptz nullable — non-null means revoked
- `createdAt` timestamptz

New table `playback_commands`:
- `id` uuid PK
- `deviceId` uuid FK → devices
- `mediaType` enum(movie | episode)
- `mediaId` integer — canonical catalog id (movies.id or episodes.id)
- `availabilityId` integer nullable FK → availabilities — optional pre-resolved variant hint
- `startPositionMs` integer default 0
- `state` enum(pending | delivered | acknowledged | expired)
- `expiresAt` timestamptz — 2-minute command TTL
- `createdAt` timestamptz

New Drizzle migration: `0017_tv_pairing_commands.sql`

### 2. Pairing API routes (apps/api/src/routes/pairing.ts)

**Unauthenticated — TV side:**
- `POST /pairing/codes` — generate a new pairing code, return `{ code, expiresAt }`. No account secret in response.
- `GET /pairing/codes/:code/status` — TV polls this endpoint; returns `{ status: "pending" | "approved", deviceToken? }`. On approval, includes the issued device bearer token. Long-poll variant: holds connection up to 30 s then returns current status.

**Authenticated (Web session) — approval side:**
- `GET /pairing/codes/:code` — inspect a pending code (status, expiresAt).
- `POST /pairing/codes/:code/approve` — approve pairing: create a device row, issue a token, mark code approved, return device info.

### 3. Device management routes (apps/api/src/routes/devices.ts)

All require Web session auth:
- `GET /devices` — list all devices: `[{ id, name, lastSeenAt, revokedAt, createdAt }]`
- `PATCH /devices/:id` — rename device (body: `{ name }`)
- `DELETE /devices/:id` — revoke device (sets `revokedAt`, invalidates token)

### 4. Remote playback command routes (apps/api/src/routes/commands.ts)

- `POST /devices/:id/commands` — Web sends a command to a specific paired device.
  Body: `{ mediaType, mediaId, availabilityId?, startPositionMs? }`.
  Creates a `playback_commands` row in state `pending`, then emits an in-process event to notify any live SSE connection for that device.
- `GET /devices/me/commands/stream` — SSE endpoint, device-token auth. TV connects; server pushes `data: <json>\n\n` for each new pending command. On reconnect, replays unacknowledged `pending` / `delivered` commands (deduplication via `commandId`). Heartbeat ping every 25 s.
- `GET /devices/me/commands` — polling fallback for `stream`; returns all `pending` or `delivered` commands for the authenticated device.
- `POST /devices/me/commands/:commandId/ack` — TV acknowledges delivery; transitions state to `acknowledged`. Idempotent (already-acknowledged returns 200).

Command payloads contain only canonical `mediaId` + optional `availabilityId`; no Xtream/Plex URLs or credentials.

### 5. Device-token auth middleware (apps/api/src/middleware/authenticateDevice.ts)

- Extracts `Authorization: Bearer <token>` header.
- SHA-256 hashes token, looks up `devices.tokenHash`.
- Rejects if not found, `revokedAt` is set, or device's pending token is mismatched.
- On success, updates `lastSeenAt`, attaches `device` to request context.

### 6. SSE delivery (apps/api/src/lib/device-events.ts)

- Node.js `EventEmitter` singleton keyed by `deviceId`.
- `POST /devices/:id/commands` emits `command:<deviceId>` event after persisting.
- `GET /devices/me/commands/stream` subscribes; on event, flushes command as SSE frame.
- Sets `Connection: keep-alive`, `Cache-Control: no-cache`, `Content-Type: text/event-stream`.
- Cleans up listener on client disconnect.

Assumption: single-process Railway deployment; no cross-process fan-out (Redis pub/sub) needed unless horizontal scaling is introduced later.

### 7. Services (apps/api/src/services/)

- `pairing.service.ts`: `createPairingCode()`, `getPairingCode(code)`, `approvePairingCode(code)`, `generateDeviceToken()` (crypto.randomBytes + SHA-256 storage)
- `device.service.ts`: `listDevices()`, `renameDevice(id, name)`, `revokeDevice(id)`, `touchLastSeen(deviceId)`
- `command.service.ts`: `createCommand(deviceId, payload)`, `getPendingCommands(deviceId)`, `acknowledgeCommand(deviceId, commandId)`, `expireStaleCommands()` (cron-style, called at startup and/or on each command fetch)

### 8. api-contracts types (packages/api-contracts/src/)

New file `device.ts`:
- `PairingCodeResponse` — `{ code: string; expiresAt: string }`
- `PairingStatusResponse` — `{ status: 'pending' | 'approved'; deviceToken?: string }`
- `DeviceResponse` — `{ id, name, lastSeenAt, revokedAt, createdAt }`
- `PlaybackCommandRequest` — `{ mediaType, mediaId, availabilityId?, startPositionMs? }`
- `PlaybackCommandResponse` — `{ id, mediaType, mediaId, availabilityId, startPositionMs, state, expiresAt, createdAt }`

### 9. Tests (apps/api/src/routes/*.test.ts and services/)

- `pairing.test.ts`: valid code creation, approval flow issues device token, expired code rejected, already-approved code rejected.
- `devices.test.ts`: list/rename/revoke flows; revoked device cannot authenticate.
- `commands.test.ts`: command created with correct shape; acknowledged command not re-delivered in `getPendingCommands`; command to revoked device rejected; expired command not returned; SSE stream emits event when command created.

## Excluded

- Android TV UI and media player implementation.
- Chromecast / Google Cast protocol support.
- Multi-household or multi-user account isolation (single-profile model unchanged).
- Remote volume, power, or transport control (play/pause/seek from Web).
- Full presence subsystem (beyond `lastSeenAt` on authenticated requests).
- Push notifications (FCM/APNS) as an alternative to SSE.
- Redis pub/sub or cross-process SSE fan-out (horizontal scaling deferred).
- Hosted auth (#95) integration — device token middleware is self-contained and does not depend on that ticket landing first.
- QR code image generation — the pairing code is QR-encodable by clients; server returns the raw string only.

## Acceptance criteria

- `POST /pairing/codes` returns `{ code, expiresAt }` with no account secrets.
- A fresh TV can poll `GET /pairing/codes/:code/status` and receive a `deviceToken` after Web approval.
- `POST /pairing/codes/:code/approve` with an expired or unknown code returns 4xx.
- `GET /devices` lists all paired devices; `PATCH /devices/:id` renames; `DELETE /devices/:id` sets `revokedAt`.
- A revoked device token is rejected (401) on all device-auth endpoints.
- `POST /devices/:id/commands` body contains no Xtream/Plex credentials; payload matches `PlaybackCommandRequest` schema.
- Connected TV receives the command via SSE within a few seconds of Web sending it.
- TV polling `GET /devices/me/commands` also returns unacknowledged commands after reconnect.
- After `POST /devices/me/commands/:commandId/ack`, that command no longer appears in pending results (deduplication).
- Expired commands (past `expiresAt`) are not delivered.
- All new Vitest tests pass; existing test suite remains green.
- TypeScript build (`pnpm build`) produces no errors across api and api-contracts packages.
