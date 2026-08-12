---

## T047 — Test Report

### Acceptance Criteria

---

**AC1: A push/merge to `main` can automatically build and redeploy the Railway API and Vercel Web app after initial provider connection.**

**PASS**

- `apps/api/railway.toml` declares `buildCommand` and `startCommand` — once the repository is connected in the Railway dashboard, every push to `main` triggers a full redeploy automatically.
- `apps/web/vercel.json` is present; Vercel auto-deploys on push to `main` once the repo is imported.
- CI (`ci.yml`) validates every push/PR against `main`, so broken builds are caught before they reach the platforms.

---

**AC2: Railway starts the compiled API with a production command, not `tsx watch`.**

**PASS**

- `railway.toml`: `startCommand = "pnpm --filter api start:railway"`
- `package.json`: `"start:railway": "pnpm db:migrate && node dist/index.js"`
- `tsx watch` is confined to the `dev` script and never referenced in the production path.

---

**AC3: The API honors Railway's injected `PORT` and binds on `0.0.0.0`.**

**PASS**

- `config/env.ts:7`: `export const PORT = Number(process.env.PORT ?? 3000)`
- `index.ts:74`: `await app.listen({ port: PORT, host: '0.0.0.0' })`

Both conditions are met.

---

**AC4: PostgreSQL migrations are applied automatically and deployment fails safely if migration fails.**

**PASS**

- `start:railway` uses `&&`, so `node dist/index.js` only runs if `drizzle-kit migrate` exits 0.
- `railway.toml` sets `restartPolicyType = "ON_FAILURE"` and the healthcheck — a non-zero exit from the start command causes Railway to abort the deploy without serving traffic.

---

**AC5: `/health` verifies API reachability and reports database connectivity without exposing credentials.**

**PASS**

- `health.ts` issues `SELECT 1` against the database.
- Returns `{ status: "ok", db: "ok" }` with HTTP 200 on success.
- Returns `{ status: "ok", db: "unavailable" }` with HTTP 503 on failure — no credentials, no error details.
- `railway.toml`: `healthcheckPath = "/health"`, `healthcheckTimeout = 30` — Railway uses the 503 to trigger rollback.

---

**AC6: Required staging environment variables are documented without hard-coded secret values or machine-specific URLs.**

**PASS**

- `docs/staging-deployment.md` provides a complete table for Railway (`DATABASE_URL`, `CORS_ORIGIN`, `NODE_ENV`, `PORT`, optionals) and Vercel (`VITE_API_BASE`).
- `apps/api/.env.example` uses local defaults only; `TMDB_API_KEY` is left empty.
- `apps/web/.env.example` uses the dev proxy default (`/api`) with a comment directing users to set the Railway origin for staging/production.
- No secrets or machine-specific URLs appear in any committed file.

---

**AC7: Vercel can target the Railway API through `VITE_API_BASE` and CORS is configured explicitly for the deployed frontend origin.**

**PASS**

- `VITE_API_BASE` is documented and injected at Vite build time; the web app consumes it to form API request URLs.
- `index.ts:39`: `await app.register(cors, { origin: CORS_ORIGIN })` — explicit allowlist, not a wildcard.
- `CORS_ORIGIN` is documented as a required Railway environment variable set to the full Vercel origin.

---

**AC8: A clean staging setup can be reproduced from repository documentation.**

**PASS**

- `docs/staging-deployment.md` covers prerequisites, env var tables, step-by-step Railway setup (project, PostgreSQL plugin, root directory, env vars, first deploy), step-by-step Vercel setup (import, config detection, `VITE_API_BASE`), redeploy-after-env-change instructions, and health check response examples.
- No undocumented dashboard-only knowledge is required.

---

### Additional Checks

| Check | Result |
|---|---|
| Production build excludes test files | PASS — `tsconfig.build.json` excludes `*.test.ts` and `__tests__/` |
| `testHelpersRoutes` excluded in production | PASS — `index.ts:69`: guarded by `NODE_ENV !== 'production'` |
| CI runs migrations + typecheck + tests on every push/PR | PASS — `ci.yml` has both `test` and `e2e` jobs against ephemeral PostgreSQL |
| `DATABASE_URL` missing causes a hard startup failure | PASS — `config/env.ts:3`: throws `Error('DATABASE_URL is not configured')` |

---

### Observations (non-blocking)

- `apps/api/.env.example` has `NODE_ENV=production`. A developer who copies it verbatim for local use will silently lose the test-helper routes. Consider defaulting to `development` in the example file and noting the production value in a comment. This does not affect staging correctness.
- The health response body carries `status: "ok"` even when the DB is unavailable (HTTP 503). This is intentional — Railway evaluates HTTP status, not body content — but it may surprise consumers parsing the JSON body. Acceptable as designed.

---

### Verdict

**All 8 acceptance criteria: PASS.** No regressions detected. No blocking issues. The implementation is ready for staging validation.
