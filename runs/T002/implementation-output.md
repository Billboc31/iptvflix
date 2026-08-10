Implementation complete. Here's the summary:

---

## Changes made

**New files:**
- `docker-compose.yml` — PostgreSQL 16-alpine service with `pg_isready` healthcheck and named volume
- `apps/api/src/config/env.ts` — validates `DATABASE_URL`, `PORT`, `CORS_ORIGIN` on load; throws a sanitized error if `DATABASE_URL` is absent
- `apps/api/src/db/schema/app_config.ts` — `app_config` table (`key text PK`, `value text NOT NULL`)
- `apps/api/src/db/schema/index.ts` — schema barrel export
- `apps/api/src/db/client.ts` — postgres.js pool + drizzle instance
- `apps/api/drizzle.config.ts` — drizzle-kit config (dialect: postgresql, schema glob, migrations output)
- `apps/api/migrations/0000_talented_shiva.sql` — committed initial migration
- `apps/api/src/config/env.test.ts` — unit test: missing `DATABASE_URL` throws sanitized error
- `docs/local-dev.md` — Docker startup, env file setup, migration commands, health check verification

**Modified files:**
- `apps/api/package.json` — added `drizzle-orm`, `postgres`, `dotenv` deps; `drizzle-kit` dev dep; `db:generate`, `db:migrate`, `db:studio` scripts
- `apps/api/src/index.ts` — loads `dotenv/config`, uses `PORT`/`CORS_ORIGIN` from `env.ts`
- `apps/api/src/routes/health.ts` — `SELECT 1` probe; returns `{ status, db: 'ok'|'unavailable' }`
- `apps/api/src/routes/health.test.ts` — mocks db client, asserts `db` field for both probe outcomes
- `packages/api-contracts/src/index.ts` — added optional `db` field to `HealthResponse`
- `.env.example` / `apps/api/.env.example` — added `DATABASE_URL`

**Tests:** 3/3 passing. TypeCheck: clean.
