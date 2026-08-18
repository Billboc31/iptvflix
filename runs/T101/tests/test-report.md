Now I have everything I need. Here is the full test report.

---

## T101 — Test Report

**Branch:** `ticket/T101-create-standalone-recommendation-lab-service-and-s`
**Date:** 2026-08-18

---

### Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| AC1 | Standalone recommendation service exists outside the main API runtime | **PASS** | `apps/recommendation-engine` — separate Fastify process, not inside `apps/api` |
| AC2 | Service has a health endpoint and versioned query API | **PASS** | `GET /health` → `{"status":"ok","version":"1.0.0","timestamp":"..."}` ; `POST /v1/query` responds correctly |
| AC3 | Simple Recommendation Lab Web UI can call it | **PASS** | Lab builds, ships with `api.ts` that POSTs to the engine; full production build succeeds in 303ms |
| AC4 | User can type a natural-language query and see baseline result path | **PASS (with caveat)** | Text-search returns matching titles from catalog (e.g. "Breaking Bad" → "Breaking Bad Raw"); all stage outputs and timing are shown. Caveat: catalog is test fixtures only — see note below |
| AC5 | Debug response can carry stage outputs/scores/version metadata | **PASS** | `debug:true` returns `stageOutputs[].candidates`, per-stage `durationMs`, `pipelineVersion:"1.0.0"`, `requestId`, `enabledStages` |
| AC6 | Pipeline stages are architected as independently switchable components | **PASS** | Three separate stage modules (`text-search`, `semantic-search`, `llm-planner`), each with its own availability check and reason string |
| AC7 | Catalog access reuses canonical IPTVFlix data | **PASS** | Engine queries the shared `postgres://...@localhost:5433/iptvflix` DB (same connection as `apps/api`) — no duplicate data store |
| AC8 | Profile access is authorization-safe | **PASS** | Valid `profileId` → returns results; non-existent UUID → HTTP 404; no cross-account data exposed |
| AC9 | Local run instructions exist | **PASS** | `apps/recommendation-engine/README.md` covers `cp .env.example .env`, `pnpm install`, `pnpm dev`, env table, endpoint docs |
| AC10 | Railway deployment config exists or is documented | **PASS** | `railway.toml` present: NIXPACKS build, `node dist/index.js` start, `/health` healthcheck, restart policy, documented env vars |
| AC11 | Missing optional LLM/vector stages fail gracefully and visibly | **PASS** | Without `OPENAI_API_KEY`: `llm-planner` → `available:false, reason:"OPENAI_API_KEY not configured"`. Without embeddings: `semantic-search` → `available:false, reason:"no embeddings indexed"`. Service and text-search continue normally |

---

### Additional Checks

| Check | Status | Notes |
|---|---|---|
| TypeScript — engine | **PASS** | `pnpm typecheck` clean |
| TypeScript — lab | **PASS** | After `pnpm install` from root (see below) |
| Production build — lab | **PASS** | `vite build` → 153 kB bundle, no errors |
| Input validation | **PASS** | Missing `text` → HTTP 400; invalid `mediaTypes` → HTTP 400 with Zod details |
| Observability | **PASS** | Structured Pino logs include `requestId`, `stage`, `durationMs`, `candidateCount`, `finalCount`. No credentials logged |
| CORS | **PASS** | Configurable via `CORS_ORIGIN` env var |
| Graceful shutdown | **PASS** | SIGTERM handler calls `app.close()` before `process.exit(0)` |
| `pnpm install` from root installs lab deps | **PASS** | Root workspace (`apps/*`) covers both packages; single install populates all |

---

### Issues Found

#### Minor — Lab node_modules not pre-populated at commit time

**Severity:** Non-blocking  
When the worktree was last committed, `apps/recommendation-lab/node_modules` was absent. `pnpm install` from the monorepo root correctly installs them (the lockfile is up to date), so any fresh `pnpm install` step resolves this. No code change needed; this is a standard workspace hygiene point.

---

#### Blocking — Completion rule cannot be fully demonstrated: catalog contains only synthetic test fixtures

**Severity:** Blocking per the ticket's own completion rule

The local DB (`localhost:5433/iptvflix`) contains:
- **2 movies:** "Movie One", "Movie Two" — no year, no poster, no synopsis
- **37 series:** "Breaking Bad Raw", "Multi-Source Series", "Force Series", "Series A", etc. — all from earlier ticket fixtures, no real metadata

The ticket's **Completion Rule** states:
> *"Run the engine + lab locally, issue at least one real query against the existing IPTVFlix catalog, render real catalog titles in the Lab, and show the diagnostic request/response path end-to-end."*

The engine and lab are fully functional. The diagnostic request/response path is demonstrable. But the catalog does not contain real TMDB-sourced titles, so the completion rule as written cannot be satisfied in this environment. Posters, years, and synopsis-based ranking are all untested.

**Root cause:** This is a data gap, not an implementation gap. The implementation reads from the correct canonical tables (`movies`, `series`) via the correct DB. A TMDB catalog import or seeding step is a prerequisite that precedes T101 (or should accompany it).

**Recommendation:** Either:
1. Seed the dev DB with real catalog data (TMDB import) before closing T101, or
2. Amend the completion rule to accept demonstration with current fixture data and add a catalog seeding task as a dependency.

---

#### Non-issue (documented) — Per-stage pipeline toggles not wired in API

The README explicitly notes: *"Per-stage toggles are not yet wired — all available stages run unconditionally."* The architecture supports it (stage modules are independent functions), but the `POST /v1/query` body does not yet accept a `stages` toggle. This is an intentional deferral, not a defect.

---

### Summary

**10 of 11 acceptance criteria PASS.** The implementation is architecturally solid: clean separation between engine and lab, correct catalog access pattern, safe profile authorization, graceful stage degradation, and full Railway readiness. The single failing concern is the **completion rule** — the local IPTVFlix catalog has only test fixture rows, so a real end-to-end recommendation rendering with actual movie titles is not achievable in the current environment without a catalog seeding step.
