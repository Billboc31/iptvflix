# T046 — Protect hosted IPTVFlix with single-user authentication and API access control

**Source**: GitHub Issue #95

## Description

## Objective

Protect the hosted IPTVFlix web/API deployment before real Xtream, Plex or other private source credentials are used on an Internet-accessible environment.

## Context / Problem

IPTVFlix was initially designed for local/self-hosted usage. The API is now being deployed publicly on Railway and the Web app on Vercel. Source-management, synchronization, profile and catalog mutation endpoints must not remain anonymously accessible on a public URL.

The current product does not need complex household/multi-tenant identity yet, but it does need a clean authentication boundary that future Web and Android TV clients can reuse.

## Included

- Add a simple single-user hosted authentication model appropriate to the current product stage.
- Protect sensitive API endpoints server-side; frontend state alone must never be trusted for authorization.
- Keep `/health` usable for platform health checks without exposing sensitive state.
- Provide a login/session flow usable by the Web app.
- Use secure password/token/session storage and transport practices; never commit credentials or log secrets/session tokens.
- Configure cookies/tokens correctly for the Vercel frontend + Railway API topology, including HTTPS and cross-origin implications where relevant.
- Ensure source credentials, source mutations, synchronization triggers, profile mutations and playback-related operations require authentication.
- Keep the design extensible enough for a later Android TV client without implementing full multi-user accounts now.

## Acceptance Criteria

- [ ] Anonymous users cannot read or mutate protected source/profile/catalog-management endpoints.
- [ ] `/health` remains callable by Railway/platform health checks and contains no secrets.
- [ ] The Web app has a usable login/session experience and survives refresh appropriately.
- [ ] Authentication is enforced by the backend on every protected request.
- [ ] Secrets/passwords/session tokens are not exposed in logs or API payloads.
- [ ] Hosted Vercel → Railway requests work securely over HTTPS.
- [ ] Automated tests cover unauthenticated denial, successful authentication, invalid/expired session and protected mutations.
- [ ] Architecture/docs clearly state the current single-user scope and the extension point for future TV clients.

## Excluded / Out of scope

- Multi-household accounts.
- Social/OAuth login unless the Planner finds it strictly simpler and compatible with the single-user requirement.
- Role/permission matrices.
- Android TV login UI.

## Dependencies

None functionally, but this should be completed before entering real IPTV/Plex credentials into the public hosted environment.
