# recommendation-engine

Standalone recommendation service for IPTVFlix. Reads the shared catalog/profile DB and exposes a versioned HTTP API for the Recommendation Lab and future Home integration.

## Local setup

```bash
# From monorepo root
cp apps/recommendation-engine/.env.example apps/recommendation-engine/.env
# Edit .env: set DATABASE_URL to your local IPTVFlix Postgres instance
pnpm install
pnpm --filter recommendation-engine dev
```

The service starts on `http://localhost:3001` by default.

## Required environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (shared IPTVFlix DB) |
| `PORT` | No | 3001 | HTTP port |
| `LOG_LEVEL` | No | info | Pino log level |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin (set to lab URL in production) |
| `OPENAI_API_KEY` | No | — | Enables llm-planner stage; service starts gracefully without it |

## Endpoints

### `GET /health`

Returns `{ status: "ok", version, timestamp }` when the service and its DB connection are healthy. Returns HTTP 503 with `{ status: "error", reason: "database unavailable" }` if the DB probe fails. Used by Railway for health checks.

### `POST /v1/query`

Run a recommendation pipeline query against the catalog.

**Request body:**
```json
{
  "text": "SF qui fait réfléchir, sombre, peu d'action",
  "profileId": "optional-uuid",
  "mediaTypes": ["movie", "series"],
  "limit": 24,
  "debug": true
}
```

> **Note:** Per-stage toggles (`stages.textSearch`, etc.) are not yet wired — all available stages run unconditionally. The field is not accepted by the API until the pipeline supports it.

**Response:**
```json
{
  "requestId": "...",
  "results": [{ "id": "...", "mediaType": "movie", "title": "...", "year": 2023, "posterPath": "/...", "score": 1.5 }],
  "stageOutputs": [{ "stage": "text-search", "available": true, "durationMs": 45, "outputCount": 12 }],
  "stageAvailability": [{ "name": "text-search", "available": true }, { "name": "semantic-search", "available": false, "reason": "no embeddings indexed" }],
  "timing": { "totalMs": 60, "stages": { "text-search": 45 } },
  "meta": { "pipelineVersion": "1.0.0", "enabledStages": ["text-search"], "query": "SF..." }
}
```

## Pipeline stages

| Stage | Status | Requires |
|---|---|---|
| `text-search` | Available (baseline) | DB connection |
| `semantic-search` | Stub | pgvector + indexed embeddings |
| `llm-planner` | Stub | `OPENAI_API_KEY` |

Unavailable stages return `available: false` with a human-readable reason. The request never errors due to a missing optional stage.

## Railway deployment

Deploy as an independent Railway service:
1. Add a new service pointing at this monorepo, set root directory to `apps/recommendation-engine`
2. Set `DATABASE_URL` to the shared IPTVFlix Postgres service URL
3. Railway will use `railway.toml` for build/start/health config
4. Set `CORS_ORIGIN` to the recommendation-lab Railway URL

## Observability

Structured JSON logs (Pino via Fastify) include `requestId`, `stage`, `durationMs`, `candidateCount`, `finalCount` per request. No raw credentials, Xtream URLs, or account passwords are logged.
