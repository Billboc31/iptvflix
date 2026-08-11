# GLOBAL CONTEXT

# Global Context — Iptvflix

## Project

- project_id: iptvflix
- repo: git@github.com:Billboc31/iptvflix.git

## AI Dev Factory

This project uses AI Dev Factory for AI-assisted development.

Agent context folders:
- `ai/` — roles and skills
- `docs/` — project documentation
- `prompts/` — ticket-specific and generic prompts
- `runs/` — per-ticket runtime artifacts
- `tickets/` — ticket definitions

---

# ROLE

# Role — Conflict Resolver

## Mission

Resolve Git merge conflicts in the current ticket worktree by editing conflicted files in-place, preserving both the ticket intent and the latest main branch behavior.

## Tu dois

- lire le fichier `conflict/context.md` qui contient le ticket, le plan, les reviews, le diff PR, les fichiers en conflit et les derniers commits de main
- éditer chaque fichier en conflit pour supprimer les marqueurs de conflit (`<<<<<<<`, `=======`, `>>>>>>>`)
- résoudre chaque conflit de façon raisonnée en conservant l'intent du ticket ET le comportement de main
- écrire un résumé de chaque décision de résolution dans ton output (qui deviendra `conflict/resolution.md`)
- signaler toute incertitude ou limitation

## Tu ne dois pas

- choisir aveuglément `ours` ou `theirs` sans justification
- faire de reset de branche
- merger vers main
- ignorer les fichiers en conflit
- masquer les erreurs ou incertitudes
- modifier des fichiers hors scope de la résolution

## Sortie attendue

La sortie (stdout) doit être `conflict/resolution.md` contenant :
- liste des fichiers résolus avec la décision prise pour chaque conflit
- justification de chaque choix (ticket vs main)
- hypothèses faites si le conflit était ambigu
- limites connues

## Règles de sécurité

- ne jamais résoudre les conflits sur la branche `main`
- ne jamais faire de `git reset --hard`
- ne jamais auto-merger vers main
- ne pas supprimer du code fonctionnel des deux côtés sans justification explicite
- toujours préserver le comportement attendu du ticket en priorité

---

# SKILL: workflow-discipline

# Skill — Workflow Discipline

## Objectif

Faire respecter le lifecycle officiel des tickets et PR IA.

## Règles

- respecter l’ordre des étapes du workflow
- ne pas bypass les reviews obligatoires
- maintenir les statuts cohérents
- conserver les artefacts versionnés
- séparer plan, implémentation et mémoire

## Refuser si

- une review obligatoire est sautée
- la mémoire est mise à jour avant validation implémentation
- le workflow officiel est contourné

---

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# TASK

# Generic Conflict Resolver Task

Read `conflict/context.md` in the run directory. It contains the full ticket context, plan, reviews, PR diff, conflicted files (with conflict markers), and the latest commits on main.

Your task:
1. Edit every conflicted file in-place to remove all conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
2. Resolve each conflict by preserving both the ticket intent and the latest main behavior where possible.
3. Do not blindly pick ours or theirs — reason through each conflict.
4. Write your output (stdout) as `conflict/resolution.md` summarising every conflict decision.

Safety rules:
- Do not reset the branch.
- Do not auto-merge to main.
- Do not blindly choose ours/theirs without justification.
- Preserve both ticket intent and latest main behavior when possible.

The ticket follows.


# Conflict Context — T008

Generated at: 2026-08-11T14:58:44Z

## Metadata

- pre_conflict_state: IMPLEMENTATION_APPROVED
- conflict_detected_at: 2026-08-11T14:58:23Z
- conflict_pr_number: unknown
- conflicted_files (source): apps/api/src/index.ts, apps/api/src/routes/catalog.ts, apps/api/src/routes/sync-runs.ts
- skipped_runtime_noise: 0 path(s)

---

## Ticket

# T008 — Add deterministic end-to-end smoke coverage for the Batch 1 vertical slice

**Source**: GitHub Issue #17

## Description

## Objective

Validate the complete IPTVFlix Batch 1 vertical slice end to end and add deterministic automated coverage so future batches do not build on an unverified integration.

## Context / Problem

The initial foundation, persistence, canonical catalog, IPTV source management, Xtream ingestion, catalog synchronization and web UI have been developed by AI Dev Factory, but the complete user journey has not yet been manually validated against the integrated application.

The project needs a reliable regression safety net before advanced catalog enrichment and personalization work accelerates.

## Included

- Add an end-to-end test path covering the complete first vertical slice:
  - start the required local services;
  - configure an Xtream source;
  - test the source connection;
  - synchronize Movies and Series;
  - verify canonical catalog persistence;
  - browse synchronized Movies and Series from the web UI.
- Use deterministic fixtures or a local fake Xtream-compatible test server so CI and automated tests never depend on real IPTV credentials or an external provider.
- Verify representative success, empty-catalog and source/synchronization failure paths.
- Add Playwright-based browser coverage for the main web journey if Playwright is already compatible with the repository tooling; otherwise preserve the existing test stack and provide equivalent browser-level coverage.
- Document a concise manual smoke checklist for validating the same flow with a real user-configured Xtream account locally.
- Fix integration defects discovered while implementing the tests when they are clearly within the Batch 1 vertical slice and do not require unrelated product changes.

## Acceptance Criteria

- [ ] A deterministic automated E2E test can validate source configuration → connection test → synchronization → catalog browsing without real IPTV credentials.
- [ ] CI/local tests exercise Movies and Series through the public application/API boundaries rather than directly inserting final catalog rows.
- [ ] The test suite verifies that synchronized provider data is exposed through canonical catalog contracts to the frontend.
- [ ] At least one source/synchronization failure path is covered and produces a usable UI error state.
- [ ] Empty catalog behavior is covered.
- [ ] Real credentials, credential-bearing stream URLs and secrets never appear in fixtures, logs or committed artifacts.
- [ ] A documented manual smoke checklist exists for testing against a real configured Xtream source.
- [ ] Any Batch 1 regression fixed by this ticket receives an automated regression test.

## Excluded / Out of scope

- Metadata enrichment.
- Recommendation logic.
- Playback validation.
- M3U support.
- Performance/load testing of very large real IPTV catalogs.

## Dependencies

Requires the Batch 1 implementation to be integrated, including the web UI from #9.

---

## Plan

# Plan — T008: Add deterministic end-to-end smoke coverage for the Batch 1 vertical slice

## Objective

Add a deterministic automated E2E smoke test suite that validates the complete IPTVFlix Batch 1 user journey (source configuration → Xtream connection test → catalog synchronization → web UI browsing) without real IPTV credentials, backed by a local fake Xtream-compatible HTTP server. Also add a GitHub Actions CI pipeline and a manual smoke checklist.

## Included

### 1. Fake Xtream HTTP server — `e2e/fixtures/xtream-server.ts`

A lightweight Node.js `http.createServer` server implementing the minimal `player_api.php` protocol needed by `apps/api/src/providers/xtream/client.ts`:

- **Routes**: `GET /player_api.php` with `action` query params: auth (implicit on every call), `get_vod_categories`, `get_vod_streams`, `get_series_categories`, `get_series`
- **Three fixture modes** selected via a constructor argument:
  - `happy` — valid auth, 2 deterministic movies, 2 deterministic series (with categories)
  - `empty` — valid auth, all lists return `[]`
  - `auth-fail` — every request returns `{ user_info: { auth: 0 } }`
- Export: `startFakeXtream(mode: 'happy' | 'empty' | 'auth-fail', port: number): Promise<{ baseUrl: string; stop(): Promise<void> }>`
- Fixture JSON data is hardcoded (no external files), so the server is fully self-contained

### 2. Playwright E2E workspace — `e2e/`

New pnpm workspace added to `pnpm-workspace.yaml`.

**`e2e/package.json`**
- Dependencies: `@playwright/test`, `@types/node`
- Scripts: `test` → `playwright test`, `test:ui` → `playwright test --ui`

**`e2e/playwright.config.ts`**
- `baseURL`: `http://localhost:5173`
- `webServer` blocks: start API (`pnpm --filter api dev`) and web (`pnpm --filter web dev`), wait for readiness
- Screenshot on failure, 1 retry in CI
- Single project: `chromium`
- `globalSetup`: start the fake Xtream server on a fixed port (e.g. 9998) and write its URL to an env var or temp file read by tests; `globalTeardown`: stop it

**`e2e/fixtures/index.ts`**
- Playwright test fixture extending `test` with: `fakeXtreamUrl` (string, mode-specific), `apiBaseUrl`

**`e2e/tests/smoke.spec.ts`**
Four scenarios:

| Scenario | Steps | Asserts |
|---|---|---|
| Happy path | Navigate to /sources → add source (pointing to fake Xtream `happy`) → click Test connection → click Sync → navigate to /movies → navigate to /series | Connection status shows success; sync completes without error; movies page lists ≥1 movie title; series page lists ≥1 series title |
| Empty catalog | Add source pointing to fake Xtream `empty` → sync → browse /movies and /series | Sync completes; both pages show the empty-state UI element (no error) |
| Connection failure | Add source with credentials rejected by fake Xtream `auth-fail` → click Test connection | UI shows connection error message; no sync is triggered |
| Sync failure | Add source → trigger sync while fake server is stopped mid-test | Sync run ends in error status; UI reflects error state on the source or sync status indicator |

### 3. API integration tests — `apps/api/src/__tests__/integration/vertical-slice.test.ts`

Vitest test file targeting the full request→DB pipeline with a real PostgreSQL test database and `msw` (Node server mode) intercepting outbound `fetch` calls to the fake Xtream fixture data.

- **`msw`** added to `apps/api` dev dependencies (already present in `apps/web`; safe to add to API)
- Setup: run DB migrations against a `TEST_DATABASE_URL` before the suite; truncate tables between tests
- Uses Fastify `app.inject()` — no real HTTP port needed for the API side
- Test cases:
  1. `POST /api/sources` → `POST /api/sources/:id/test` → `POST /api/sources/:id/sync` → `GET /api/movies` → `GET /api/series` — asserts canonical fields (title, year/firstAirYear, genres) are present and availability rows exist
  2. Empty-catalog sync — GET /api/movies returns `{ data: [] }`
  3. Auth error on test-connection — response body contains an error key; no sync row created
  4. Sync error (msw returns 500 mid-sync) — sync run row has `status: 'error'`; error message is not empty

### 4. GitHub Actions CI — `.github/workflows/ci.yml`

- Trigger: push and pull_request to `main`
- Job `test`:
  - `services`: PostgreSQL 16 (credentials matching `.env.example`)
  - Steps: checkout → setup Node 20 + pnpm → install → run migrations → `pnpm test` (unit + integration)
- Job `e2e` (depends on `test`):
  - Same service setup
  - Install Playwright browsers: `pnpm --filter e2e exec playwright install --with-deps chromium`
  - Run `pnpm --filter e2e test`
  - Upload Playwright report as artifact on failure
- No real IPTV credentials in any step; all secrets limited to DB connection string

### 5. Manual smoke checklist — `docs/smoke-checklist.md`

Concise Markdown document covering:
- Prerequisites (Docker running, `.env` filled with a real Xtream account, migrations applied)
- Steps: start services → open UI → add source → test connection → trigger sync → browse Movies → browse Series
- Expected outcomes per step
- Edge cases to verify manually: empty account, wrong password, very large catalog

### 6. Batch 1 regression fixes (bounded scope)

Any integration defects surfaced while wiring the E2E harness that are clearly within the Batch 1 vertical slice (e.g. a missing API route, a broken sync status endpoint, a UI state not resetting between syncs) are fixed in this ticket. Each fix receives a targeted automated regression test (Vitest unit or integration level, or a Playwright assertion in the relevant spec).

### Files created

| Path | Purpose |
|---|---|
| `e2e/package.json` | Playwright workspace manifest |
| `e2e/playwright.config.ts` | Playwright configuration |
| `e2e/fixtures/xtream-server.ts` | Fake Xtream HTTP server |
| `e2e/fixtures/index.ts` | Playwright custom fixtures |
| `e2e/tests/smoke.spec.ts` | E2E smoke scenarios |
| `apps/api/src/__tests__/integration/vertical-slice.test.ts` | API integration test suite |
| `.github/workflows/ci.yml` | CI pipeline |
| `docs/smoke-checklist.md` | Manual smoke checklist |

### Files modified

| Path | Change |
|---|---|
| `pnpm-workspace.yaml` | Add `e2e` to workspace packages |
| Root `package.json` | Add `e2e` script delegating to Playwright workspace |
| `apps/api/package.json` | Add `msw` to devDependencies |
| `apps/api/vitest.config.ts` | Add integration test include pattern and `TEST_DATABASE_URL` env passthrough |

## Excluded

- Metadata enrichment (TMDb, IMDB lookups)
- Recommendation and personalization logic
- Playback validation (stream URLs, player)
- M3U source format support
- Android TV app testing
- Performance or load testing of large IPTV catalogs
- Visual regression testing and accessibility audits
- Any feature work not already part of the Batch 1 vertical slice

## Acceptance criteria

- `pnpm --filter e2e test` passes locally and in CI without any real IPTV credentials or network access to external providers.
- Playwright suite covers exactly four scenarios: happy path, empty catalog, connection failure, sync failure — all green.
- API integration test suite verifies that a full source-config → sync → catalog-query cycle produces correctly shaped canonical movie and series objects (title, year/firstAirYear, at least one genre, at least one availability row) accessible via public API endpoints.
- At least one sync-failure and one auth-failure path are covered by automated tests.
- Empty-catalog behavior is covered by at least one automated test.
- No real credentials, bearer tokens, or credential-bearing URLs appear in fixtures, test output, logs, or committed files; CI secrets are limited to the local test DB connection string.
- `docs/smoke-checklist.md` exists and enumerates every step of the manual validation flow with expected outcomes.
- GitHub Actions CI runs the full test matrix (unit + integration + E2E) on every push to `main` and on every PR targeting `main`.
- Any Batch 1 integration defect discovered during implementation has a dedicated automated regression test committed in the same ticket.

---

## Ticket branch diff since merge-base (d734f2b2)

(no source paths — only runtime/noise diffs against main)

---

## Conflicted Files

### apps/api/src/index.ts

```
import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { healthRoutes } from './routes/health.js'
import { sourcesRoutes } from './routes/sources.js'
<<<<<<< HEAD
import { enrichmentRoutes } from './routes/enrichment.js'
import { moviesRoutes } from './routes/movies.js'
import { seriesRoutes } from './routes/series.js'
import { searchRoutes } from './routes/search.js'
import { genresRoutes } from './routes/genres.js'
import { syncRunsRoutes } from './routes/sync-runs.js'
import { watchlistRoutes } from './routes/watchlist.js'
import { viewingProgressRoutes } from './routes/viewing-progress.js'
import { PORT, CORS_ORIGIN, TMDB_API_KEY } from './config/env.js'
import { db } from './db/client.js'
import { TmdbClient } from './providers/metadata/tmdb/client.js'
import { MetadataEnrichmentService } from './services/metadata-enrichment-service.js'
=======
import { catalogRoutes } from './routes/catalog.js'
import { syncRunsRoutes } from './routes/sync-runs.js'
import { testHelpersRoutes } from './routes/test-helpers.js'
import { PORT, CORS_ORIGIN } from './config/env.js'
>>>>>>> a1ef28e (feat(T008/dashboard,docs,workflow): coder — update 22 file(s))

const app = Fastify({ logger: true })

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error)
  const status = error.statusCode ?? 500
  reply.status(status).send({ error: status >= 500 ? 'Internal Server Error' : error.message })
})

await app.register(cors, { origin: CORS_ORIGIN })
await app.register(healthRoutes)
await app.register(sourcesRoutes)
<<<<<<< HEAD
await app.register(syncRunsRoutes)
await app.register(moviesRoutes)
await app.register(seriesRoutes)
await app.register(searchRoutes)
await app.register(genresRoutes)
await app.register(watchlistRoutes)
await app.register(viewingProgressRoutes)

const enrichmentService = TMDB_API_KEY
  ? new MetadataEnrichmentService(db, new TmdbClient({ apiKey: TMDB_API_KEY }))
  : null
await app.register(enrichmentRoutes, { enrichmentService })
=======
await app.register(catalogRoutes)
await app.register(syncRunsRoutes)

if (process.env.NODE_ENV !== 'production') {
  await app.register(testHelpersRoutes)
}
>>>>>>> a1ef28e (feat(T008/dashboard,docs,workflow): coder — update 22 file(s))

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
```

### apps/api/src/routes/catalog.ts

```
import type { FastifyInstance } from 'fastify'
<<<<<<< HEAD
import { and, eq, inArray, ilike, sql, asc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movies, movieGenres } from '../db/schema/movies.js'
import { series as seriesTable, seriesGenres } from '../db/schema/series.js'
import { seasons } from '../db/schema/seasons.js'
import { episodes } from '../db/schema/episodes.js'
import { genres } from '../db/schema/genres.js'
import {
  movieAvailabilities,
  seriesAvailabilities,
  episodeAvailabilities,
} from '../db/schema/availabilities.js'
import type {
  MovieResponse,
  MovieDetailResponse,
  SeriesResponse,
  SeriesDetailResponse,
  EpisodeResponse,
  EnrichmentStatus,
  AvailabilityStatus,
  PaginatedList,
} from '@iptvflix/api-contracts'

function deriveEnrichmentStatus(row: {
  tmdbId: number | null
  imdbId: string | null
  synopsis: string | null
}): EnrichmentStatus {
  const hasExternalId = row.tmdbId !== null || row.imdbId !== null
  const hasSynopsis = row.synopsis !== null
  if (hasExternalId && hasSynopsis) return 'matched'
  if (!hasExternalId && !hasSynopsis) return 'unmatched'
  return 'partial'
}

function filterString(names: (string | null)[]): string[] {
  return names.filter((n): n is string => n !== null)
}

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // GET /movies
  // ---------------------------------------------------------------------------
  app.get<{
    Querystring: { genreId?: string; year?: string; page?: string; pageSize?: string }
  }>('/movies', async (request) => {
    const { genreId, year, page = '1', pageSize = '20' } = request.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
    const offset = (pageNum - 1) * pageSizeNum

    const conditions = []
    if (year) {
      const yearNum = parseInt(year, 10)
      if (!isNaN(yearNum)) conditions.push(eq(movies.year, yearNum))
    }
    if (genreId) {
      conditions.push(
        sql`${movies.id} IN (SELECT movie_id FROM movie_genres WHERE genre_id = ${genreId})`,
      )
    }
    const whereClause = conditions.length > 0 ? and(...(conditions as [typeof conditions[0], ...typeof conditions])) : undefined

    const [countRow] = await db
      .select({ total: sql<number>`cast(count(*) as integer)` })
      .from(movies)
      .where(whereClause)
    const total = Number(countRow?.total ?? 0)

    const movieRows = await db
      .select()
      .from(movies)
      .where(whereClause)
      .limit(pageSizeNum)
      .offset(offset)
      .orderBy(asc(movies.title))

    if (movieRows.length === 0) {
      return { items: [], total, page: pageNum, pageSize: pageSizeNum } satisfies PaginatedList<MovieResponse>
    }

    const movieIds = movieRows.map((m) => m.id)

    const genreRows = await db
      .select({ movieId: movieGenres.movieId, name: genres.name })
      .from(movieGenres)
      .leftJoin(genres, eq(genres.id, movieGenres.genreId))
      .where(inArray(movieGenres.movieId, movieIds))

    const genreMap = new Map<string, string[]>()
    for (const row of genreRows) {
      if (!genreMap.has(row.movieId)) genreMap.set(row.movieId, [])
      if (row.name) genreMap.get(row.movieId)!.push(row.name)
    }

    const availRows = await db
      .select({ movieId: movieAvailabilities.movieId })
      .from(movieAvailabilities)
      .where(
        and(
          inArray(movieAvailabilities.movieId, movieIds),
          eq(movieAvailabilities.status, 'AVAILABLE'),
        ),
      )
    const availableSet = new Set(availRows.map((r) => r.movieId))

    const items: MovieResponse[] = movieRows.map((m) => ({
      id: m.id,
      title: m.title,
      year: m.year,
      synopsis: m.synopsis,
      posterUrl: m.posterPath,
      backdropUrl: m.backdropPath,
      runtime: m.durationMinutes,
      genres: genreMap.get(m.id) ?? [],
      quality: null,
      availabilityStatus: (availableSet.has(m.id) ? 'AVAILABLE' : 'UNAVAILABLE') as AvailabilityStatus,
    }))

    return { items, total, page: pageNum, pageSize: pageSizeNum } satisfies PaginatedList<MovieResponse>
  })

  // ---------------------------------------------------------------------------
  // GET /movies/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/movies/:id', async (request, reply) => {
    const { id } = request.params

    const [movie] = await db.select().from(movies).where(eq(movies.id, id))
    if (!movie) return reply.status(404).send({ error: 'Movie not found' })

    const genreRows = await db
      .select({ name: genres.name })
      .from(movieGenres)
      .leftJoin(genres, eq(genres.id, movieGenres.genreId))
      .where(eq(movieGenres.movieId, id))

    const [availRow] = await db
      .select()
      .from(movieAvailabilities)
      .where(
        and(
          eq(movieAvailabilities.movieId, id),
          eq(movieAvailabilities.status, 'AVAILABLE'),
        ),
      )
      .limit(1)

    const response: MovieDetailResponse = {
      id: movie.id,
      title: movie.title,
      year: movie.year,
      synopsis: movie.synopsis,
      posterUrl: movie.posterPath,
      backdropUrl: movie.backdropPath,
      runtime: movie.durationMinutes,
      genres: filterString(genreRows.map((r) => r.name)),
      quality: null,
      availabilityStatus: availRow ? 'AVAILABLE' : 'UNAVAILABLE',
      originalTitle: movie.originalTitle,
      imdbId: movie.imdbId,
      tmdbId: movie.tmdbId,
      enrichmentStatus: deriveEnrichmentStatus(movie),
    }

    return response
  })

  // ---------------------------------------------------------------------------
  // GET /series
  // ---------------------------------------------------------------------------
  app.get<{
    Querystring: { genreId?: string; year?: string; page?: string; pageSize?: string }
  }>('/series', async (request) => {
    const { genreId, year, page = '1', pageSize = '20' } = request.query
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
    const offset = (pageNum - 1) * pageSizeNum

    const conditions = []
    if (year) {
      const yearNum = parseInt(year, 10)
      if (!isNaN(yearNum)) conditions.push(eq(seriesTable.firstAirYear, yearNum))
    }
    if (genreId) {
      conditions.push(
        sql`${seriesTable.id} IN (SELECT series_id FROM series_genres WHERE genre_id = ${genreId})`,
      )
    }
    const whereClause = conditions.length > 0 ? and(...(conditions as [typeof conditions[0], ...typeof conditions])) : undefined

    const [countRow] = await db
      .select({ total: sql<number>`cast(count(*) as integer)` })
      .from(seriesTable)
      .where(whereClause)
    const total = Number(countRow?.total ?? 0)

    const seriesRows = await db
      .select()
      .from(seriesTable)
      .where(whereClause)
      .limit(pageSizeNum)
      .offset(offset)
      .orderBy(asc(seriesTable.title))

    if (seriesRows.length === 0) {
      return { items: [], total, page: pageNum, pageSize: pageSizeNum } satisfies PaginatedList<SeriesResponse>
    }

    const seriesIds = seriesRows.map((s) => s.id)

    const genreRows = await db
      .select({ seriesId: seriesGenres.seriesId, name: genres.name })
      .from(seriesGenres)
      .leftJoin(genres, eq(genres.id, seriesGenres.genreId))
      .where(inArray(seriesGenres.seriesId, seriesIds))

    const genreMap = new Map<string, string[]>()
    for (const row of genreRows) {
      if (!genreMap.has(row.seriesId)) genreMap.set(row.seriesId, [])
      if (row.name) genreMap.get(row.seriesId)!.push(row.name)
    }

    const availRows = await db
      .select({ seriesId: seriesAvailabilities.seriesId })
      .from(seriesAvailabilities)
      .where(
        and(
          inArray(seriesAvailabilities.seriesId, seriesIds),
          eq(seriesAvailabilities.status, 'AVAILABLE'),
        ),
      )
    const availableSet = new Set(availRows.map((r) => r.seriesId))

    const seasonCountRows = await db
      .select({
        seriesId: seasons.seriesId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(seasons)
      .where(inArray(seasons.seriesId, seriesIds))
      .groupBy(seasons.seriesId)
    const seasonCountMap = new Map(seasonCountRows.map((r) => [r.seriesId, Number(r.count)]))

    const items: SeriesResponse[] = seriesRows.map((s) => ({
      id: s.id,
      title: s.title,
      year: s.firstAirYear,
      synopsis: s.synopsis,
      posterUrl: s.posterPath,
      backdropUrl: s.backdropPath,
      genres: genreMap.get(s.id) ?? [],
      seasonCount: seasonCountMap.get(s.id) ?? 0,
      availabilityStatus: (availableSet.has(s.id) ? 'AVAILABLE' : 'UNAVAILABLE') as AvailabilityStatus,
    }))

    return { items, total, page: pageNum, pageSize: pageSizeNum } satisfies PaginatedList<SeriesResponse>
  })

  // ---------------------------------------------------------------------------
  // GET /series/:id
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>('/series/:id', async (request, reply) => {
    const { id } = request.params

    const [seriesRow] = await db.select().from(seriesTable).where(eq(seriesTable.id, id))
    if (!seriesRow) return reply.status(404).send({ error: 'Series not found' })

    const genreRows = await db
      .select({ name: genres.name })
      .from(seriesGenres)
      .leftJoin(genres, eq(genres.id, seriesGenres.genreId))
      .where(eq(seriesGenres.seriesId, id))

    const [availRow] = await db
      .select()
      .from(seriesAvailabilities)
      .where(
        and(
          eq(seriesAvailabilities.seriesId, id),
          eq(seriesAvailabilities.status, 'AVAILABLE'),
        ),
      )
      .limit(1)

    const seasonRows = await db
      .select({
        seasonNumber: seasons.seasonNumber,
        title: seasons.title,
        airYear: seasons.airYear,
        episodeCount: sql<number>`cast(count(${episodes.id}) as integer)`,
      })
      .from(seasons)
      .leftJoin(episodes, eq(episodes.seasonId, seasons.id))
      .where(eq(seasons.seriesId, id))
      .groupBy(seasons.id, seasons.seasonNumber, seasons.title, seasons.airYear)
      .orderBy(asc(seasons.seasonNumber))

    const response: SeriesDetailResponse = {
      id: seriesRow.id,
      title: seriesRow.title,
      year: seriesRow.firstAirYear,
      synopsis: seriesRow.synopsis,
      posterUrl: seriesRow.posterPath,
      backdropUrl: seriesRow.backdropPath,
      genres: filterString(genreRows.map((r) => r.name)),
      seasonCount: seasonRows.length,
      availabilityStatus: availRow ? 'AVAILABLE' : 'UNAVAILABLE',
      originalTitle: seriesRow.originalTitle,
      imdbId: seriesRow.imdbId,
      tmdbId: seriesRow.tmdbId,
      enrichmentStatus: deriveEnrichmentStatus(seriesRow),
      seasons: seasonRows.map((s) => ({
        seasonNumber: s.seasonNumber,
        title: s.title,
        episodeCount: Number(s.episodeCount),
        airYear: s.airYear,
      })),
    }

    return response
  })

  // ---------------------------------------------------------------------------
  // GET /series/:id/seasons/:seasonNumber/episodes
  // ---------------------------------------------------------------------------
  app.get<{ Params: { id: string; seasonNumber: string } }>(
    '/series/:id/seasons/:seasonNumber/episodes',
    async (request, reply) => {
      const { id, seasonNumber } = request.params
      const seasonNum = parseInt(seasonNumber, 10)
      if (isNaN(seasonNum)) return reply.status(404).send({ error: 'Season not found' })

      const [season] = await db
        .select({ id: seasons.id })
        .from(seasons)
        .where(and(eq(seasons.seriesId, id), eq(seasons.seasonNumber, seasonNum)))

      if (!season) return reply.status(404).send({ error: 'Season not found' })

      const episodeRows = await db
        .select()
        .from(episodes)
        .where(eq(episodes.seasonId, season.id))
        .orderBy(asc(episodes.episodeNumber))

      if (episodeRows.length === 0) return []

      const episodeIds = episodeRows.map((e) => e.id)
      const availRows = await db
        .select({ episodeId: episodeAvailabilities.episodeId })
        .from(episodeAvailabilities)
        .where(inArray(episodeAvailabilities.episodeId, episodeIds))

      const availableSet = new Set(availRows.map((r) => r.episodeId))

      return episodeRows.map((e): EpisodeResponse => ({
        id: e.id,
        episodeNumber: e.episodeNumber,
        title: e.title,
        synopsis: e.synopsis,
        durationMinutes: e.durationMinutes,
        airDate: e.airDate,
        availabilityStatus: availableSet.has(e.id) ? 'AVAILABLE' : 'UNAVAILABLE',
      }))
    },
  )

  // ---------------------------------------------------------------------------
  // GET /search
  // ---------------------------------------------------------------------------
  app.get<{ Querystring: { q?: string } }>('/search', async (request) => {
    const { q } = request.query
    if (!q) return { movies: [], series: [] }

    const searchPattern = `%${q}%`

    const movieRows = await db
      .select()
      .from(movies)
      .where(ilike(movies.title, searchPattern))
      .limit(10)

    const seriesRows = await db
      .select()
      .from(seriesTable)
      .where(ilike(seriesTable.title, searchPattern))
      .limit(10)

    const movieIds = movieRows.map((m) => m.id)
    const seriesIds = seriesRows.map((s) => s.id)

    const movieGenreMap = new Map<string, string[]>()
    const movieAvailableSet = new Set<string>()
    const seriesGenreMap = new Map<string, string[]>()
    const seriesAvailableSet = new Set<string>()
    const seasonCountMap = new Map<string, number>()

    if (movieIds.length > 0) {
      const mgRows = await db
        .select({ movieId: movieGenres.movieId, name: genres.name })
        .from(movieGenres)
        .leftJoin(genres, eq(genres.id, movieGenres.genreId))
        .where(inArray(movieGenres.movieId, movieIds))
      for (const row of mgRows) {
        if (!movieGenreMap.has(row.movieId)) movieGenreMap.set(row.movieId, [])
        if (row.name) movieGenreMap.get(row.movieId)!.push(row.name)
      }
      const maRows = await db
        .select({ movieId: movieAvailabilities.movieId })
        .from(movieAvailabilities)
        .where(
          and(
            inArray(movieAvailabilities.movieId, movieIds),
            eq(movieAvailabilities.status, 'AVAILABLE'),
          ),
        )
      for (const r of maRows) movieAvailableSet.add(r.movieId)
    }

    if (seriesIds.length > 0) {
      const sgRows = await db
        .select({ seriesId: seriesGenres.seriesId, name: genres.name })
        .from(seriesGenres)
        .leftJoin(genres, eq(genres.id, seriesGenres.genreId))
        .where(inArray(seriesGenres.seriesId, seriesIds))
      for (const row of sgRows) {
        if (!seriesGenreMap.has(row.seriesId)) seriesGenreMap.set(row.seriesId, [])
        if (row.name) seriesGenreMap.get(row.seriesId)!.push(row.name)
      }
      const saRows = await db
        .select({ seriesId: seriesAvailabilities.seriesId })
        .from(seriesAvailabilities)
        .where(
          and(
            inArray(seriesAvailabilities.seriesId, seriesIds),
            eq(seriesAvailabilities.status, 'AVAILABLE'),
          ),
        )
      for (const r of saRows) seriesAvailableSet.add(r.seriesId)
      const scRows = await db
        .select({
          seriesId: seasons.seriesId,
          count: sql<number>`cast(count(*) as integer)`,
        })
        .from(seasons)
        .where(inArray(seasons.seriesId, seriesIds))
        .groupBy(seasons.seriesId)
      for (const r of scRows) seasonCountMap.set(r.seriesId, Number(r.count))
    }

    return {
      movies: movieRows.map((m): MovieResponse => ({
        id: m.id,
        title: m.title,
        year: m.year,
        synopsis: m.synopsis,
        posterUrl: m.posterPath,
        backdropUrl: m.backdropPath,
        runtime: m.durationMinutes,
        genres: movieGenreMap.get(m.id) ?? [],
        quality: null,
        availabilityStatus: (movieAvailableSet.has(m.id) ? 'AVAILABLE' : 'UNAVAILABLE') as AvailabilityStatus,
      })),
      series: seriesRows.map((s): SeriesResponse => ({
        id: s.id,
        title: s.title,
        year: s.firstAirYear,
        synopsis: s.synopsis,
        posterUrl: s.posterPath,
        backdropUrl: s.backdropPath,
        genres: seriesGenreMap.get(s.id) ?? [],
        seasonCount: seasonCountMap.get(s.id) ?? 0,
        availabilityStatus: (seriesAvailableSet.has(s.id) ? 'AVAILABLE' : 'UNAVAILABLE') as AvailabilityStatus,
=======
import { eq, ilike, sql, count, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movies, series, movieAvailabilities, seriesAvailabilities } from '../db/schema/index.js'
import type {
  MovieResponse,
  SeriesResponse,
  PaginatedList,
  MovieFilters,
  SeriesFilters,
} from '@iptvflix/api-contracts'

function availabilitySubquery(table: 'movies' | 'series') {
  if (table === 'movies') {
    return sql<'AVAILABLE' | 'UNAVAILABLE'>`
      CASE WHEN EXISTS (
        SELECT 1 FROM movie_availabilities
        WHERE movie_id = ${movies.id} AND status = 'AVAILABLE'
      ) THEN 'AVAILABLE' ELSE 'UNAVAILABLE' END
    `
  }
  return sql<'AVAILABLE' | 'UNAVAILABLE'>`
    CASE WHEN EXISTS (
      SELECT 1 FROM series_availabilities
      WHERE series_id = ${series.id} AND status = 'AVAILABLE'
    ) THEN 'AVAILABLE' ELSE 'UNAVAILABLE' END
  `
}

function parseIntParam(val: string | undefined, fallback: number): number {
  if (!val) return fallback
  const n = parseInt(val, 10)
  return isNaN(n) ? fallback : n
}

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: MovieFilters }>('/movies', async (request) => {
    const page = parseIntParam(String(request.query.page ?? ''), 1)
    const pageSize = Math.min(parseIntParam(String(request.query.pageSize ?? ''), 20), 100)
    const offset = (page - 1) * pageSize

    const [totalRow] = await db.select({ count: count() }).from(movies)
    const total = Number(totalRow?.count ?? 0)

    const rows = await db
      .select({
        id: movies.id,
        title: movies.title,
        year: movies.year,
        synopsis: movies.synopsis,
        posterPath: movies.posterPath,
        backdropPath: movies.backdropPath,
        runtime: movies.durationMinutes,
        availabilityStatus: availabilitySubquery('movies'),
      })
      .from(movies)
      .orderBy(desc(movies.createdAt))
      .limit(pageSize)
      .offset(offset)

    const items: MovieResponse[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      year: r.year ?? null,
      synopsis: r.synopsis ?? null,
      posterUrl: r.posterPath ?? null,
      backdropUrl: r.backdropPath ?? null,
      runtime: r.runtime ?? null,
      genres: [],
      quality: null,
      availabilityStatus: r.availabilityStatus,
    }))

    return { items, total, page, pageSize } satisfies PaginatedList<MovieResponse>
  })

  app.get<{ Params: { id: string } }>('/movies/:id', async (request, reply) => {
    const [row] = await db
      .select({
        id: movies.id,
        title: movies.title,
        year: movies.year,
        synopsis: movies.synopsis,
        posterPath: movies.posterPath,
        backdropPath: movies.backdropPath,
        runtime: movies.durationMinutes,
        availabilityStatus: availabilitySubquery('movies'),
      })
      .from(movies)
      .where(eq(movies.id, request.params.id))

    if (!row) return reply.status(404).send({ error: 'Movie not found' })

    return {
      id: row.id,
      title: row.title,
      year: row.year ?? null,
      synopsis: row.synopsis ?? null,
      posterUrl: row.posterPath ?? null,
      backdropUrl: row.backdropPath ?? null,
      runtime: row.runtime ?? null,
      genres: [],
      quality: null,
      availabilityStatus: row.availabilityStatus,
    } satisfies MovieResponse
  })

  app.get<{ Querystring: SeriesFilters }>('/series', async (request) => {
    const page = parseIntParam(String(request.query.page ?? ''), 1)
    const pageSize = Math.min(parseIntParam(String(request.query.pageSize ?? ''), 20), 100)
    const offset = (page - 1) * pageSize

    const [totalRow] = await db.select({ count: count() }).from(series)
    const total = Number(totalRow?.count ?? 0)

    const rows = await db
      .select({
        id: series.id,
        title: series.title,
        firstAirYear: series.firstAirYear,
        synopsis: series.synopsis,
        posterPath: series.posterPath,
        backdropPath: series.backdropPath,
        availabilityStatus: availabilitySubquery('series'),
        seasonCount: sql<number>`(SELECT COUNT(*) FROM seasons WHERE series_id = ${series.id})`,
      })
      .from(series)
      .orderBy(desc(series.createdAt))
      .limit(pageSize)
      .offset(offset)

    const items: SeriesResponse[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      year: r.firstAirYear ?? null,
      synopsis: r.synopsis ?? null,
      posterUrl: r.posterPath ?? null,
      backdropUrl: r.backdropPath ?? null,
      genres: [],
      seasonCount: Number(r.seasonCount),
      availabilityStatus: r.availabilityStatus,
    }))

    return { items, total, page, pageSize } satisfies PaginatedList<SeriesResponse>
  })

  app.get<{ Params: { id: string } }>('/series/:id', async (request, reply) => {
    const [row] = await db
      .select({
        id: series.id,
        title: series.title,
        firstAirYear: series.firstAirYear,
        synopsis: series.synopsis,
        posterPath: series.posterPath,
        backdropPath: series.backdropPath,
        availabilityStatus: availabilitySubquery('series'),
        seasonCount: sql<number>`(SELECT COUNT(*) FROM seasons WHERE series_id = ${series.id})`,
      })
      .from(series)
      .where(eq(series.id, request.params.id))

    if (!row) return reply.status(404).send({ error: 'Series not found' })

    return {
      id: row.id,
      title: row.title,
      year: row.firstAirYear ?? null,
      synopsis: row.synopsis ?? null,
      posterUrl: row.posterPath ?? null,
      backdropUrl: row.backdropPath ?? null,
      genres: [],
      seasonCount: Number(row.seasonCount),
      availabilityStatus: row.availabilityStatus,
    } satisfies SeriesResponse
  })

  app.get<{ Querystring: { q?: string } }>('/search', async (request) => {
    const q = request.query.q?.trim()
    if (!q) return { movies: [], series: [] }

    const pattern = `%${q}%`

    const movieRows = await db
      .select({
        id: movies.id,
        title: movies.title,
        year: movies.year,
        synopsis: movies.synopsis,
        posterPath: movies.posterPath,
        backdropPath: movies.backdropPath,
        runtime: movies.durationMinutes,
        availabilityStatus: availabilitySubquery('movies'),
      })
      .from(movies)
      .where(ilike(movies.title, pattern))
      .limit(20)

    const seriesRows = await db
      .select({
        id: series.id,
        title: series.title,
        firstAirYear: series.firstAirYear,
        synopsis: series.synopsis,
        posterPath: series.posterPath,
        backdropPath: series.backdropPath,
        availabilityStatus: availabilitySubquery('series'),
        seasonCount: sql<number>`(SELECT COUNT(*) FROM seasons WHERE series_id = ${series.id})`,
      })
      .from(series)
      .where(ilike(series.title, pattern))
      .limit(20)

    return {
      movies: movieRows.map((r) => ({
        id: r.id,
        title: r.title,
        year: r.year ?? null,
        synopsis: r.synopsis ?? null,
        posterUrl: r.posterPath ?? null,
        backdropUrl: r.backdropPath ?? null,
        runtime: r.runtime ?? null,
        genres: [],
        quality: null,
        availabilityStatus: r.availabilityStatus,
      })),
      series: seriesRows.map((r) => ({
        id: r.id,
        title: r.title,
        year: r.firstAirYear ?? null,
        synopsis: r.synopsis ?? null,
        posterUrl: r.posterPath ?? null,
        backdropUrl: r.backdropPath ?? null,
        genres: [],
        seasonCount: Number(r.seasonCount),
        availabilityStatus: r.availabilityStatus,
>>>>>>> a1ef28e (feat(T008/dashboard,docs,workflow): coder — update 22 file(s))
      })),
    }
  })
}
```

### apps/api/src/routes/sync-runs.ts

```
import type { FastifyInstance } from 'fastify'
<<<<<<< HEAD
import type { TriggerSyncBody } from '@iptvflix/api-contracts'
import { listSyncRuns, triggerSync } from '../services/sync-runs-service.js'
import { NotFoundError } from '../services/source-service.js'

export async function syncRunsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/sync-runs', async () => {
    return listSyncRuns()
  })

  app.post<{ Body: TriggerSyncBody }>('/sync-runs', async (request, reply) => {
    try {
      const run = await triggerSync(request.body ?? { sourceId: '' })
      return reply.status(201).send(run)
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send({ error: err.message })
      }
      const status = (err as Error & { statusCode?: number }).statusCode
      if (status && status >= 400 && status < 500) {
        return reply.status(status).send({ error: (err as Error).message })
      }
      throw err
    }
=======
import { desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { sources, syncRuns } from '../db/schema/index.js'
import { XtreamCodesClient } from '../providers/xtream/client.js'
import { CatalogSyncService, SyncAlreadyRunningError } from '../services/catalog-sync-service.js'
import type { SyncRunResponse, TriggerSyncBody } from '@iptvflix/api-contracts'

type SyncRunRow = typeof syncRuns.$inferSelect

function toResponse(row: SyncRunRow): SyncRunResponse {
  return {
    id: row.id,
    sourceId: row.sourceId,
    status: row.status === 'COMPLETED' ? 'DONE' : row.status,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.completedAt?.toISOString() ?? null,
    moviesAdded: row.moviesCreated,
    seriesAdded: row.seriesCreated,
    error: row.errorMessage ?? null,
  }
}

export async function syncRunsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/sync-runs', async () => {
    const rows = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt))
    return rows.map(toResponse)
  })

  app.post<{ Body: TriggerSyncBody }>('/sync-runs', async (request, reply) => {
    const { sourceId } = request.body ?? {}
    if (!sourceId) {
      return reply.status(400).send({ error: 'sourceId is required' })
    }

    const [source] = await db.select().from(sources).where(eq(sources.id, sourceId))
    if (!source) {
      return reply.status(404).send({ error: `Source ${sourceId} not found` })
    }
    if (source.type === 'M3U') {
      return reply.status(400).send({ error: 'Sync is not supported for M3U sources' })
    }

    const client = new XtreamCodesClient({
      baseUrl: source.baseUrl,
      username: source.username ?? '',
      password: source.password ?? '',
    })

    let fetchError: Error | undefined
    let vodCategories: Awaited<ReturnType<typeof client.getVodCategories>> = []
    let vodStreams: Awaited<ReturnType<typeof client.getVodStreams>> = []
    let seriesCategories: Awaited<ReturnType<typeof client.getSeriesCategories>> = []
    let seriesList: Awaited<ReturnType<typeof client.getSeries>> = []

    try {
      const fetchedAt = new Date()
      ;[vodCategories, vodStreams, seriesCategories, seriesList] = await Promise.all([
        client.getVodCategories(),
        client.getVodStreams(),
        client.getSeriesCategories(),
        client.getSeries(),
      ])

      const result = await CatalogSyncService.syncCatalog(sourceId, {
        sourceId,
        fetchedAt,
        vodCategories,
        vodStreams,
        seriesCategories,
        series: seriesList,
      })

      const [runRow] = await db.select().from(syncRuns).where(eq(syncRuns.id, result.runId))
      return reply.status(201).send(toResponse(runRow!))
    } catch (err) {
      if (err instanceof SyncAlreadyRunningError) {
        return reply.status(409).send({ error: err.message })
      }
      // Catalog fetch failed — record a FAILED run so the UI reflects the error
      fetchError = err instanceof Error ? err : new Error(String(err))
    }

    const [runRow] = await db
      .insert(syncRuns)
      .values({
        sourceId,
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: fetchError!.message,
      })
      .returning()
    return reply.status(201).send(toResponse(runRow!))
>>>>>>> a1ef28e (feat(T008/dashboard,docs,workflow): coder — update 22 file(s))
  })
}
```