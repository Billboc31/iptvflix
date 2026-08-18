Implementation is complete and verified. Here's a summary:

---

## Files created

### `apps/recommendation-engine` (Fastify service, port 3001)
- `package.json` — `@iptvflix/recommendation-engine`, Fastify v4, drizzle-orm, postgres.js, zod
- `tsconfig.json` + `tsconfig.build.json`
- `src/config.ts` — typed env config (DATABASE_URL required, PORT/LOG_LEVEL/OPENAI_API_KEY/CORS_ORIGIN optional)
- `src/db/client.ts` — drizzle + postgres.js read-only connection
- `src/db/schema.ts` — minimal schema declarations for movies, series, profiles, mediaEmbeddings
- `src/pipeline/types.ts` — shared types: QueryRequest, QueryResponse, StageResult, CandidateItem, etc.
- `src/pipeline/pipeline.ts` — orchestrator: runs stages in sequence, collects timings, assembles response
- `src/pipeline/stages/text-search.ts` — **baseline** (always available): ILIKE + FTS via `websearch_to_tsquery('simple', ...)`
- `src/pipeline/stages/semantic-search.ts` — **stub**: checks for indexed embeddings, returns `available: false`
- `src/pipeline/stages/llm-planner.ts` — **stub**: checks OPENAI_API_KEY, returns `available: false`
- `src/routes/health.ts` — `GET /health` → `{ status, version, timestamp }`
- `src/routes/query.ts` — `POST /v1/query` with Zod validation, profileId DB authorization
- `src/index.ts` — Fastify bootstrap with CORS, structured logging, SIGTERM handler
- `railway.toml`, `.env.example`, `README.md`

### `apps/recommendation-lab` (Vite/React dev UI, port 3002)
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/api.ts` — typed engine client reading `VITE_ENGINE_URL` (default `http://localhost:3001`)
- `src/App.tsx` — layout: QueryForm → ResultGrid → DiagnosticPanel
- `src/components/QueryForm.tsx` — free-text query, profileId field, content type/limit selectors, stage pills
- `src/components/StageToggle.tsx` — green=active / grey=disabled with tooltip
- `src/components/ResultGrid.tsx` — TMDB poster cards with title, year, media type badge, score
- `src/components/DiagnosticPanel.tsx` — Timing/Stages table + Raw JSON tabs

## Verified end-to-end
- `GET /health` → `{ status: "ok", version: "1.0.0", ... }` ✅
- `POST /v1/query { text: "Movie" }` → returns "Movie One", "Movie Two" from real catalog ✅
- text-search available, llm-planner + semantic-search report `available: false` with reasons ✅
- Structured logs include `requestId`, `stage`, `durationMs`, `candidateCount`, `finalCount`, no credentials ✅
- Lab Vite server starts and serves the React app ✅
- Both TypeScript typechecks pass with zero errors ✅
