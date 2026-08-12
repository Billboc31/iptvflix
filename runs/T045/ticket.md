# T045 — Add one-command local reset and remote-test deployment workflow

**Source**: GitHub Issue #86

## Description

## Objective

Provide a reproducible local reset/deploy workflow so the current IPTVFlix stack can be rebuilt from a clean database and tested remotely from another device over the local network or Tailscale.

## Context / Problem

The project already uses PostgreSQL through `docker-compose.yml`, Drizzle migrations, `pnpm dev` for API + Web, and the web dev server has been updated to listen beyond localhost for remote access. After several schema and catalog batches, manual cleanup/restart steps are error-prone and make end-to-end product testing harder.

We need a documented and preferably one-command workflow that starts from a clean local state, applies the current schema, launches the application, and exposes a clear remote-test URL without embedding machine-specific addresses.

## Included

- Add a safe local-development reset command/script that can:
  - stop the local stack when needed;
  - remove/reset the local PostgreSQL `pgdata` volume only with explicit reset intent;
  - start PostgreSQL;
  - apply all current Drizzle migrations to an empty database;
  - start API and Web using the existing monorepo tooling.
- Keep destructive reset behavior clearly separated from normal start/restart commands.
- Add a non-destructive start/deploy-local command for routine testing after the initial reset.
- Verify the API/Web bind configuration supports access from another device through a local/Tailscale IP while preserving the existing `/api` proxy behavior.
- Document how to determine/use the host machine's reachable IP rather than hard-coding one.
- Include basic readiness checks for PostgreSQL, API health and Web availability.
- Preserve local `.env`/secrets; database reset must not delete source code or user credential files.

## Acceptance Criteria

- [ ] A documented command can reset the local PostgreSQL data volume and recreate the schema from migrations only.
- [ ] Reset is explicitly destructive and cannot be confused with the normal local start command.
- [ ] A separate non-destructive command starts/restarts PostgreSQL + API + Web for testing.
- [ ] After reset, API health succeeds and the Web app loads against the freshly migrated database.
- [ ] The Web app can be reached from another device using the host's LAN/Tailscale IP and the configured dev port.
- [ ] `/api` calls continue to reach the local backend correctly during remote Web access.
- [ ] Scripts do not hard-code a developer-specific absolute path or IP address.
- [ ] Existing `.env` files/secrets are preserved.
- [ ] README/docs contain a concise clean-reset and remote-test procedure.

## Excluded / Out of scope

- Production hosting or cloud deployment.
- Public internet exposure/port forwarding.
- Automatically creating real Xtream/Plex credentials or sources after reset.
- Seeding a large fake media catalog unless needed only for lightweight smoke validation.

## Dependencies

Should run after the migration-chain stabilization already completed in #75. It can otherwise be developed independently of the recommendation batch.
