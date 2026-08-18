Now I have a thorough picture of the codebase. The key finding: recommendation logic already exists inside `apps/api` and the lab UI inside `apps/web`, but T101 requires extracting this into a **standalone** `apps/recommendation-engine` service and a separate `apps/recommendation-lab` UI. Let me write the plan.

## Objective

Create `apps/recommendation-engine` — a standalone Fastify service outside `apps/api` — and `apps/recommendation-lab` — a minimal Vite/React developer UI — as the architectural shell for the recommendation system. The engine exposes `GET /health` and `POST /v1/query` with a switchable pipeline; the lab UI lets a developer type a natural-language query and see real catalog titles with diagnostic data, end-to-end.

## Included

### `apps/recommendation-engine` (new Fastify service)

- `package.json` — declares the package, scripts (`dev`, `build`, `start`, `start:railway`), dependencies: `fastify`, `drizzle-orm`, `postgres`, `pino`, `zod`
- `tsconfig.json` — TypeScript project config (Node 20, ESM)
- `src/index.ts` — Fastify bootstrap: binds `PORT`, registers routes, structured logger, graceful shutdown on `SIGTERM`
- `src/config.ts` — Typed env config: `DATABASE_URL`, `PORT` (default 3001), `OPENAI_API_KEY` (optional), `LOG_LEVEL`
- `src/db/client.ts` — Drizzle + `postgres` connection; read-only intent against shared IPTVFlix DB
- `src/db/schema.ts` — Minimal schema declarations for tables the engine reads: `movies`, `series`, `genres`, `movie_genres`, `series_genres`, `media_embeddings`, `profiles`, `profile_taste`
- `src/routes/health.ts` — `GET /health` → `{ status: "ok", version, timestamp }`
- `src/routes/query.ts` — `POST /v1/query`: Zod-validates body, resolves `profileId` authorization (read-only DB lookup, no account secrets returned), runs pipeline, returns structured response
- `src/pipeline/types.ts` — Shared TypeScript types: `QueryRequest`, `QueryResponse`, `StageResult`, `StageAvailability`, `PipelineContext`, `CandidateItem`
- `src/pipeline/pipeline.ts` — Stage orchestrator: accepts enabled-stage flags from request, runs available stages in sequence, collects per-stage timings + candidate counts, assembles `QueryResponse`
- `src/pipeline/stages/text-search.ts` — **Baseline stage** (always available): Postgres full-text search (`to_tsvector`/`plainto_tsquery`) on movie/series title and description; returns ranked candidate list
- `src/pipeline/stages/semantic-search.ts` — **Stub stage**: checks for pgvector and `media_embeddings` rows; if unavailable returns `{ available: false, reason: "no embeddings indexed" }`
- `src/pipeline/stages/llm-planner.ts` — **Stub stage**: checks `OPENAI_API_KEY` presence; if absent returns `{ available: false, reason: "OPENAI_API_KEY not configured" }`
- `src/logger.ts` — Pino structured logger: emits `requestId`, `stage`, `durationMs`, `candidateCount`, `finalCount` per request; never logs raw passwords, Xtream URLs, or secret-bearing provider strings
- `railway.toml` — Independent Railway service config: `builder = "NIXPACKS"`, `buildCommand`, `startCommand = "node dist/index.js"`, `healthcheckPath = "/health"`, `PORT` env reference
- `README.md` — Local run instructions: required env vars, `pnpm install`, `pnpm dev`, how to point at an existing `DATABASE_URL`

### `apps/recommendation-lab` (new minimal Vite/React UI)

- `package.json` — Vite + React + TypeScript, `VITE_ENGINE_URL` env var consumed at build time
- `vite.config.ts`, `tsconfig.json`, `index.html`
- `src/main.tsx`, `src/App.tsx` — Root layout: QueryForm + ResultGrid + DiagnosticPanel stacked
- `src/api.ts` — Typed `POST /v1/query` caller; reads `VITE_ENGINE_URL` (default `http://localhost:3001`)
- `src/components/QueryForm.tsx` — Free-text input, optional profileId field, media type selector (movie/series/both), limit selector (10/24/50), stage toggles sourced from the engine's availability response; Search button
- `src/components/ResultGrid.tsx` — Result cards: TMDB poster (via existing TMDB image URL pattern), title, year, score breakdown if present
- `src/components/DiagnosticPanel.tsx` — Two tabs: raw JSON response viewer; timing table (stage → durationMs, candidateCount)
- `src/components/StageToggle.tsx` — Renders enabled/disabled based on `StageAvailability`; disabled stages are visible but non-interactive with a tooltip ("not yet configured")

### Monorepo

- `pnpm-workspace.yaml` — `apps/*` already covers the new packages; no change
- Root `package.json` scripts — optionally add `dev:engine` / `dev:lab` aliases if turborepo pipeline doesn't pick them up automatically

## Excluded

- Migration or extraction of existing recommendation code from `apps/api` — the engine is new code, not a port; `apps/api` routes remain unchanged
- Embedding indexing, backfill, or actual pgvector cosine queries — semantic-search stage is a non-functional stub
- LLM query expansion implementation — llm-planner stage is a non-functional stub
- Profile taste / personalization stage — follow-up ticket
- Hybrid reranking logic — follow-up ticket
- Shelf concept generation — follow-up ticket
- Comparison mode UI panels — architecture should not block it, but no implementation
- Persisting experiment results or queries
- Consumer-facing Home integration (thin integration client in `apps/api` is follow-up)
- Creating a `packages/db-schema` shared package — schema is minimally duplicated in the engine for this ticket
- Any authentication/session middleware on the lab UI itself — `profileId` authorization is enforced server-side via read-only DB lookup only
- Android TV or media-relay changes

## Acceptance criteria

- `pnpm --filter recommendation-engine dev` starts a server; `GET http://localhost:3001/health` returns HTTP 200 with `{ status: "ok" }`
- `POST /v1/query { "text": "SF sombre", "mediaTypes": ["movie"], "limit": 10 }` returns a JSON object containing `results` (array), `stageOutputs` (per-stage diagnostics), `timing` (total + per-stage ms), and `meta` (pipeline version, enabled stages)
- At least one result in `results` contains a real movie title fetched from the IPTVFlix catalog (text-search stage active)
- Semantic-search and LLM-planner stages return `available: false` with a human-readable reason when not configured; the request does not error
- `pnpm --filter recommendation-lab dev` starts the Vite dev server; the query form renders in browser
- Submitting a query from the lab renders result cards showing real titles returned by the engine
- DiagnosticPanel displays raw JSON response and per-stage timing rows
- Stage toggles for semantic-search and LLM-planner are visible in the UI but rendered disabled with a tooltip
- `apps/recommendation-engine/railway.toml` is present and declares a valid independent service config (buildCommand, startCommand, healthcheckPath, PORT)
- `apps/recommendation-engine/README.md` documents the minimum env vars and local startup sequence
- Engine logs (stdout) include `requestId`, `durationMs`, `candidateCount`, `finalCount` and contain no raw credentials, Xtream provider URLs, or account passwords
