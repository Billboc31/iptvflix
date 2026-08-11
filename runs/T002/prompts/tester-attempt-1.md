# T002 — Test Report

**Date:** 2026-08-10  
**Branch:** ticket/T002-set-up-postgresql-persistence-with-drizzle

---

## Acceptance Criteria

### AC1 — The API can connect to PostgreSQL using environment configuration
**Status: PASS**

- `apps/api/src/config/env.ts` reads `DATABASE_URL` from the environment and throws a sanitized error if absent.
- `apps/api/src/db/client.ts` constructs the connection pool from `DATABASE_URL` and exports a Drizzle instance.
- `.env.example` provides a ready-to-use default connection string (`postgres://iptvflix:iptvflix@localhost:5432/iptvflix`).

### AC2 — Drizzle is configured and usable from the API
**Status: PASS**

- `apps/api/drizzle.config.ts` configures the `postgres` dialect, schema glob, and migrations output directory.
- `apps/api/src/db/client.ts` wraps the connection with `drizzle()` and attaches the schema, exposing a typed `db` singleton.
- `apps/api/src/db/schema/index.ts` exports the `app_config` table definition.

### AC3 — Database migrations can be generated/applied through documented commands
**Status: PASS**

- `apps/api/package.json` exposes `db:generate` (`drizzle-kit generate`) and `db:migrate` (`drizzle-kit migrate`).
- `docs/local-dev.md` documents both commands and the schema-change workflow step-by-step.

### AC4 — A clean database can be brought to the current schema from migrations only
**Status: PASS**

- `apps/api/migrations/0000_talented_shiva.sql` contains the initial `CREATE TABLE app_config` DDL.
- `apps/api/migrations/meta/_journal.json` tracks the migration version (v7 format).
- `drizzle-kit migrate` applied to an empty database produces the full current schema without any seed data dependency.

### AC5 — Connection failures are reported without exposing credentials
**Status: PASS**

- Missing `DATABASE_URL` throws `"DATABASE_URL is not configured"` — no credentials in the message.
- `GET /health` wraps the DB probe in a bare `catch {}` block and returns `{ status: "ok", db: "unavailable" }` — the underlying error (which could contain the connection URL) is never forwarded to the HTTP response.

### AC6 — Automated tests cover the persistence bootstrap where appropriate
**Status: PASS**

Test run result: **3 tests, 2 files — all passed** (duration 397ms)

| File | Tests | Coverage |
|---|---|---|
| `src/config/env.test.ts` | 1 | throws sanitized error when `DATABASE_URL` absent |
| `src/routes/health.test.ts` | 2 | `db: ok` when probe succeeds; `db: unavailable` when probe throws |

The `db` client is mocked in health tests so no real database is required to run the suite.

### AC7 — Local development instructions describe how to start and migrate PostgreSQL
**Status: PASS**

- `docker-compose.yml` provides a `postgres:16-alpine` service with healthcheck, persistent volume, and default credentials matching `.env.example`.
- `docs/local-dev.md` covers: prerequisites, first-time setup (env copy → Docker start → migrate → dev), schema change workflow, all available `db:*` commands, and health-check verification via `curl`.

---

## Regressions

None observed. No existing behaviour was altered by this ticket (T001 monorepo foundation merged cleanly).

---

## Blocking Issues

None.

---

## Verdict

**VALIDATED** — All 7 acceptance criteria pass. The test suite is green. No blocking issues found.
