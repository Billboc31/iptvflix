# T047 — Make Railway/Vercel staging deployment reproducible and migration-safe

**Source**: GitHub Issue #96

## Description

## Objective

Turn the current manually-configured hosted environment into a reproducible staging deployment where merges to `main` reliably redeploy Web + API against PostgreSQL with safe migrations and health checks.

## Context / Problem

The Web app is being hosted on Vercel and the Fastify API + PostgreSQL on Railway. Initial deployment exposed several repository/runtime gaps: production build vs test compilation, missing production start command, platform-provided `PORT`, database wiring and migrations, and cross-origin frontend/backend configuration.

These rules should live in the repository/documentation instead of depending on one-time dashboard knowledge.

## Included

- Formalize production/staging build and start commands for the API using compiled output rather than a watch-mode dev server.
- Document/configure Railway expectations for `PORT`, `DATABASE_URL`, `CORS_ORIGIN`, `NODE_ENV` and optional TMDB configuration.
- Add a migration-safe deployment step so Drizzle migrations run before a new API version is considered ready.
- Ensure deployment fails rather than serving a partially-migrated application when required migrations fail.
- Add health/readiness behavior appropriate to Railway and PostgreSQL.
- Document the Vercel frontend environment contract, especially `VITE_API_BASE`, and production redeploy behavior after env changes.
- Keep production build compilation separate from test sources while preserving test/typecheck validation as separate quality gates.
- Add concise staging deployment documentation from a fresh Railway/Vercel setup.

## Acceptance Criteria

- [ ] A push/merge to `main` can automatically build and redeploy the Railway API and Vercel Web app after initial provider connection.
- [ ] Railway starts the compiled API with a production command, not `tsx watch`.
- [ ] The API honors Railway's injected `PORT` and binds on `0.0.0.0`.
- [ ] PostgreSQL migrations are applied automatically and deployment fails safely if migration fails.
- [ ] `/health` verifies API reachability and reports database connectivity without exposing credentials.
- [ ] Required staging environment variables are documented without hard-coded secret values or machine-specific URLs.
- [ ] Vercel can target the Railway API through `VITE_API_BASE` and CORS is configured explicitly for the deployed frontend origin.
- [ ] A clean staging setup can be reproduced from repository documentation.

## Excluded / Out of scope

- Production-grade HA/multi-region infrastructure.
- Custom domains.
- Backups/point-in-time recovery beyond what the chosen database service provides.
- Authentication itself (covered separately).

## Dependencies

Can be developed independently, but must remain compatible with the hosted authentication ticket.
