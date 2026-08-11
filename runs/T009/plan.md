## Objective

Create two concise reference documents under `docs/` — one for product vision and one for technical architecture — so that AI Dev Factory agents and human contributors share a single, durable, accurate source of truth for IPTVFlix product intent and engineering constraints.

## Included

### `docs/product/vision.md` (new file)

Cover the following in order:

1. **Tagline / value proposition** — IPTVFlix as a personalised discovery layer over the user's own IPTV subscriptions, not a generic catalog browser.
2. **Primary users** — self-hosted / personal-use context; single user or small household; user owns/controls their IPTV provider credentials.
3. **Core product principles** (one short paragraph each):
   - Discovery first: surface relevant content, not just a list.
   - Canonical catalog: content identity is provider-independent; multiple sources map to the same item.
   - Cinema Radar: first-class feature tracking wanted/monitored films and alerting on availability.
   - Transparent recommendations: user understands why something is suggested.
   - Provider independence: the UI and backend domain are decoupled from any specific IPTV provider.
4. **MVP scope** — what is built today (source management, catalog ingestion, browsing, search, Cinema Radar skeleton) vs. what comes later (taste profiling, recommendation engine, Android TV playback, multi-user).
5. **What IPTVFlix is not** — not a streaming provider, not a universal IPTV client, not a Plex/Jellyfin replacement.

Target length: ≤ 350 words.

---

### `docs/architecture/overview.md` (new file)

Cover the following in order:

1. **Monorepo structure** — list each workspace package with its path, language, and role:
   - `apps/api` — Fastify 4 + TypeScript backend; owns business logic, DB access, provider adapters.
   - `apps/web` — React 18 + Vite + Tailwind CSS frontend; consumes `@iptvflix/api-contracts`.
   - `apps/android-tv` — Kotlin/Gradle skeleton; future TV client; consumes the same backend API.
   - `packages/api-contracts` — shared TypeScript types exported to both API and Web; the explicit contract boundary.

2. **Technology stack** (factual list, no opinions):
   - Runtime: Node.js ≥ 20, pnpm ≥ 9
   - Backend: TypeScript 5.5, Fastify 4, Drizzle ORM 0.45, PostgreSQL 16
   - Frontend: React 18, React Router 6, Vite 5, Tailwind CSS 4
   - Testing: Vitest 2, Testing Library, MSW 2
   - Android TV: Kotlin, Jetpack Compose for TV (enabled when needed), Media3

3. **Architecture principles** (enforceable rules):
   - **Modular monolith**: all backend modules live in `apps/api`; no separate micro-services.
   - **Provider adapter isolation**: Xtream Codes DTOs (`apps/api/src/providers/xtream/types.ts`) must never become canonical domain models or be exposed to the Web layer. The canonical schema lives in `apps/api/src/db/schema/`.
   - **Single API contract boundary**: `packages/api-contracts` is the only path for types shared between backend and frontend.
   - **Clients consume, never dictate**: Web and Android TV are consumers of the same backend API; neither client owns business logic or schema.
   - **Secrets stay server-side**: IPTV credentials are stored and used only in the API process; never returned to clients or written to logs.
   - **Background work is idempotent**: catalog sync jobs (`catalog-sync-service.ts`) must be safe to retry without side-effects.
   - **PostgreSQL + Drizzle is the persistence layer**: no alternative stores are introduced without an explicit architecture decision.

4. **Module conventions** — where future functionality belongs:
   - New IPTV provider adapters → `apps/api/src/providers/<name>/`
   - Canonical domain entities (movies, series, episodes, genres) → `apps/api/src/db/schema/`
   - New API routes → `apps/api/src/routes/`
   - Business logic / orchestration → `apps/api/src/services/`
   - Recommendation / profile / radar backend logic → `apps/api/src/services/` (new sub-modules when implemented)
   - Shared API types → `packages/api-contracts/src/`
   - Web pages → `apps/web/src/pages/`
   - Reusable web components → `apps/web/src/components/`

5. **Existing docs pointers** — reference `docs/local-dev.md` for setup and `docs/design/README.md` for UI/UX conventions; this document does not duplicate them.

Target length: ≤ 500 words.

---

### Existing docs — no changes required

- `docs/local-dev.md` — kept as-is.
- `docs/design/README.md` — kept as-is.
- `docs/ai/global-context.md` — kept as-is.

### Verification pass (part of the task)

Before finalising each document, cross-check every claim against the actual repository:
- Package names from `pnpm-workspace.yaml` and `package.json` files.
- Framework versions from root `package.json`.
- Schema tables from `apps/api/src/db/schema/`.
- Provider adapter paths from `apps/api/src/providers/`.
- No claim about a file or module that does not exist.

## Excluded

- Refactoring any implementation code.
- Writing Architectural Decision Records (ADRs).
- Documenting the recommendation, taste-profiling, or radar feature internals (goals are referenced, implementation is not prescribed).
- Creating API reference docs or OpenAPI spec.
- Modifying `docs/local-dev.md`, `docs/design/README.md`, or `docs/ai/global-context.md`.
- Any change to source code, configs, or tests.

## Acceptance criteria

- `docs/product/vision.md` exists and explains, in ≤ 350 words, what differentiates IPTVFlix from a generic IPTV client and names Cinema Radar, canonical catalog, and discovery-first as explicit principles.
- `docs/architecture/overview.md` exists and documents the four workspace packages with their actual paths and languages.
- `docs/architecture/overview.md` explicitly states that Xtream Codes (provider) DTOs must not become canonical domain or UI models.
- `docs/architecture/overview.md` states that Web and Android TV are consumers of the same backend API.
- `docs/architecture/overview.md` documents where future catalog, source, recommendation, profile, and client functionality should be placed.
- Neither document introduces a technology, framework, or architectural pattern not already present in the repository.
- Neither document contradicts anything verifiable in the current codebase (package.json versions, schema files, directory structure).
- Both documents are short enough (combined ≤ 850 words) to be inlined as AI agent context.
