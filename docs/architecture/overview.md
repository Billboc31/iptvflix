# IPTVFlix — Architecture Overview

## Monorepo Structure

| Path | Language | Role |
|------|----------|------|
| `apps/api` | TypeScript | Fastify 4 backend; owns business logic, DB access, and provider adapters |
| `apps/web` | TypeScript / React | Vite + React 18 frontend; consumes `@iptvflix/api-contracts` |
| `apps/android-tv` | Kotlin | Gradle skeleton; future TV client; will consume the same backend API |
| `packages/api-contracts` | TypeScript | Shared type definitions; the only path for types crossing the API/client boundary |

Workspace manager: **pnpm** (`pnpm-workspace.yaml`).

## Technology Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js ≥ 20, pnpm ≥ 9 |
| Backend | TypeScript 5.5, Fastify 4, Drizzle ORM 0.45, PostgreSQL 16 |
| Frontend | React 18, React Router 6, Vite 5, Tailwind CSS 4 |
| Testing | Vitest 2, Testing Library, MSW 2 |
| Android TV | Kotlin 2.0, AGP 8.5 (Compose for TV and Media3 introduced when the client is built) |

## Architecture Principles

**Modular monolith.** All backend modules live in `apps/api`. No separate micro-services are introduced without an explicit architecture decision.

**Source adapter isolation.** Provider-specific DTOs (e.g. `apps/api/src/providers/xtream/types.ts`) must never become canonical domain models or be exposed to the Web layer. The canonical schema lives exclusively in `apps/api/src/db/schema/`. Source-specific shapes are translated at the adapter boundary before touching any service or route. See the [domain model](./domain-model.md) for the Source invariant.

**Single API contract boundary.** `packages/api-contracts` is the only place for types shared between the API and any client. Direct imports from `apps/api/src/` into client code are not allowed.

**Clients consume, never dictate.** `apps/web` and `apps/android-tv` are consumers of the same backend API. Neither client owns business logic or canonical schema definitions.

**Secrets stay server-side.** IPTV provider credentials are stored and used only inside the API process. They must never be returned to clients or written to logs.

**Background work is idempotent.** Catalog sync jobs (`apps/api/src/services/catalog-sync-service.ts`) must be safe to retry without producing duplicates or inconsistent state.

**PostgreSQL + Drizzle is the persistence layer.** No alternative data stores are introduced without an explicit architecture decision.

## Module Conventions

| Concern | Location |
|---------|----------|
| New source adapters (IPTV, Plex, future) | `apps/api/src/providers/<name>/` |
| Canonical domain entities (movies, series, episodes, genres) | `apps/api/src/db/schema/` |
| New API routes | `apps/api/src/routes/` |
| Business logic / orchestration | `apps/api/src/services/` |
| Recommendation, profile, and radar backend logic | `apps/api/src/services/` (new sub-modules when implemented) |
| Shared API types | `packages/api-contracts/src/` |
| Web pages | `apps/web/src/pages/` |
| Reusable web components | `apps/web/src/components/` |

## Related Docs

- **Domain model (canonical reference)** → `docs/architecture/domain-model.md`
- **Local development setup** → `docs/local-dev.md`
- **UI/UX conventions and design reference** → `docs/design/README.md`
