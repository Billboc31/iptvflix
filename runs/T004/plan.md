## Objective

Add an IPTV source registry to IPTVFlix: a `sources` table, CRUD + enable/disable API endpoints, and a connection-test endpoint for Xtream Codes sources. Secrets are stored but never returned in any API response or log line.

## Included

### Database schema — `apps/api/src/db/schema/sources.ts`

New Drizzle table `sources`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `defaultRandom()` |
| `name` | text not null | human label |
| `type` | pgEnum `source_type` (`XTREAM`, `M3U`) not null | |
| `baseUrl` | text not null | server/base URL |
| `username` | text nullable | Xtream only |
| `password` | text nullable | Xtream only — stored, never returned via API |
| `enabled` | boolean default true | |
| `createdAt` | timestamp default now | |
| `updatedAt` | timestamp default now | |

- Add `source_type` pgEnum to `apps/api/src/db/schema/sources.ts`.
- Re-export from `apps/api/src/db/schema/index.ts`.
- Run `pnpm --filter api db:generate` to produce `apps/api/migrations/0002_*.sql`, then `db:migrate`.

### Service — `apps/api/src/services/source-service.ts`

- `createSource(input)` — insert row; return sanitized (no `password`).
- `listSources()` — select all; omit `password` from each item.
- `getSource(id)` — select one; omit `password`; throw 404 if not found.
- `updateSource(id, patch)` — update subset of fields; omit `password` in response.
- `deleteSource(id)` — delete; throw 404 if not found.
- `testSourceConnection(id)` — load credentials from DB; for XTREAM: `fetch({baseUrl}/player_api.php?username=X&password=Y&action=get_server_info)` with a 5 s timeout; return `{ ok: boolean, message: string }` with sanitized error text (no URLs, usernames, or passwords in message string). For M3U: return `{ ok: false, message: 'M3U connection test not yet implemented' }`.

Password must never be passed to `app.log.*`.

### API routes — `apps/api/src/routes/sources.ts`

| Method | Path | Description |
|---|---|---|
| `POST` | `/sources` | create; validate required fields by type; 400 on missing field |
| `GET` | `/sources` | list all; password absent |
| `GET` | `/sources/:id` | get one; 404 if missing; password absent |
| `PATCH` | `/sources/:id` | partial update (name, baseUrl, username, password, enabled); password absent in response |
| `DELETE` | `/sources/:id` | remove; 204 on success; 404 if missing |
| `POST` | `/sources/:id/test` | test connection; always returns 200 with `{ ok, message }` body |

Register routes plugin in `apps/api/src/index.ts`.

### Shared contracts — `packages/api-contracts/src/sources.ts`

- `SourceType` — `'XTREAM' | 'M3U'`
- `SourceResponse` — all fields except `password`
- `CreateSourceBody`, `UpdateSourceBody`, `TestSourceResult` — request/response shapes

### Tests — `apps/api/src/routes/sources.test.ts`

| Scenario | Expected |
|---|---|
| Create valid XTREAM source | 201, no `password` field |
| Create with missing required field | 400 |
| List sources | password absent from all items |
| Get unknown id | 404 |
| Update `enabled: false` | 200, source still retrievable with `enabled: false` |
| Delete unknown id | 404 |
| Test connection — mock returns 200 + valid JSON | `{ ok: true }` |
| Test connection — unreachable host | `{ ok: false, message }` with no credential data, no 5xx crash |
| Log assertion | no password value in Fastify log output during test run |

## Excluded

- Catalog import or synchronization (separate ticket).
- M3U URL parsing or any M3U-specific logic beyond accepting the type in the schema.
- FK constraint linking `availabilities.provider_id` to `sources.id` — deferred until catalog sync is in scope.
- Encryption at rest beyond withholding the password from all API responses (local/self-hosted deployment model).
- Web UI components.
- Authentication or rate-limiting middleware.

## Acceptance criteria

- `POST /sources` with a valid Xtream Codes payload returns 201 and the response body contains no `password` field.
- `GET /sources` and `GET /sources/:id` responses contain no `password` field.
- `POST /sources/:id/test` returns `{ ok: true }` when the mocked Xtream endpoint responds 200 with valid JSON.
- `POST /sources/:id/test` returns `{ ok: false, message: "<sanitized>" }` on unreachable host — no URL or credential in `message`, no 5xx error.
- `PATCH /sources/:id` with `{ enabled: false }` persists the change; the source remains retrievable.
- `DELETE /sources/:id` on an unknown id returns 404.
- `SourceType.M3U` is accepted by the schema without error (no M3U behavior required).
- All Vitest cases pass (`pnpm --filter api test`).
- No password value appears in any Fastify log line during the test run.
- Migration `0002_*.sql` applies cleanly on a fresh database (`db:migrate` exits 0).
