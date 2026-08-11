# T002 — Set up PostgreSQL persistence with Drizzle

**Source**: GitHub Issue #3

## Description

## Objective
Add the persistence foundation for IPTVFlix using PostgreSQL and Drizzle so later catalog, source, profile, history, and recommendation features share a typed and maintainable data-access layer.

## Context / Problem
The application will persist large IPTV catalogs and user-specific state. The project needs a lightweight TypeScript-friendly persistence approach without introducing a heavy application framework.

## Included
- Configure PostgreSQL for local development.
- Integrate Drizzle ORM and Drizzle Kit in the API.
- Establish project conventions for schema definitions, migrations, repositories/data access, transactions, and environment configuration.
- Add an initial migration proving the migration workflow works.
- Provide a database health/readiness check suitable for local development.
- Ensure schema changes are migration-driven and reproducible.

## Acceptance Criteria
- [ ] The API can connect to PostgreSQL using environment configuration.
- [ ] Drizzle is configured and usable from the API.
- [ ] Database migrations can be generated/applied through documented commands.
- [ ] A clean database can be brought to the current schema from migrations only.
- [ ] Connection failures are reported without exposing credentials.
- [ ] Automated tests cover the persistence bootstrap where appropriate.
- [ ] Local development instructions describe how to start and migrate PostgreSQL.

## Excluded / Out of scope
- Complete IPTVFlix domain schema.
- Redis or a dedicated job queue.
- Production database hosting.

## Dependencies
Requires the monorepo/API foundation from #2.
