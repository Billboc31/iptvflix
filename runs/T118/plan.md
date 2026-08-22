# T118 — Diagnostiquer et fiabiliser la preview ShelfConcept en production

## Objective

Replace the opaque `null`-returning pattern in `previewShelfConcept()` with a typed error result and structured logging so that the API route can return actionable HTTP codes (404 / 502 / 504) instead of a generic 502, and so that the cause of any failure is immediately visible in logs. Add a dedicated, configurable timeout for the preview route.

## Included

### `apps/api/src/config/env.ts`
- Add `RECOMMENDATION_PREVIEW_TIMEOUT_MS`: read from env, Zod `coerce.number().default(45_000)`, validated alongside existing vars.

### `apps/api/src/client/recommendation-engine-client.ts`

**New internal type** (file-scoped, not exported beyond what the route needs):
```ts
type EnginePreviewResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'not-found' | 'server-error' | 'timeout' | 'unreachable' | 'circuit-open'; status?: number; message?: string }
```

**`fetchWithTimeout`** — add an optional `timeoutMs` parameter (defaults to `REQUEST_TIMEOUT_MS` = 15 000 ms) so the preview call can pass a longer value without touching other callers.

**`previewShelfConcept()`** — rewrite:
- If circuit is open: return `{ ok: false, kind: 'circuit-open' }` (no fetch, no log).
- Record start time before fetch.
- Pass `RECOMMENDATION_PREVIEW_TIMEOUT_MS` to `fetchWithTimeout`.
- On `AbortError` (timeout): log `{ endpoint, durationMs, kind: 'timeout' }` → return `{ ok: false, kind: 'timeout' }`.
- On other thrown errors (network): log `{ endpoint, durationMs, kind: 'unreachable', error: err.message }` → return `{ ok: false, kind: 'unreachable' }`.
- On non-ok response:
  - Read body text (truncated to 500 chars, no sensitive headers ever logged).
  - Log `{ endpoint, status, durationMs, kind, body }`.
  - 404 → return `{ ok: false, kind: 'not-found', status: 404 }`.
  - 4xx other → return `{ ok: false, kind: 'server-error', status }`.
  - 5xx → return `{ ok: false, kind: 'server-error', status, message: truncatedBody }`.
- On ok response: log `{ endpoint, status: 200, durationMs }` → return `{ ok: true, data }`.
- Call `recordFailure()` on every non-ok path; `recordSuccess()` on ok path (unchanged).
- Return type changes from `ShelfConceptPreviewResponse | null` to `EnginePreviewResult<ShelfConceptPreviewResponse>`.
- All other public methods remain unchanged (they still return `T | null`).

### `apps/api/src/routes/shelf-concepts.ts`

Update the `POST /shelf-concepts/:id/preview` handler to consume the new result type:

| `result.kind` | HTTP | Body |
|---|---|---|
| `not-found` | 404 | `Recommendation preview endpoint not deployed` |
| `timeout` | 504 | `Recommendation preview timed out` |
| `server-error` | 502 | `Recommendation engine error (HTTP ${status})` |
| `unreachable` | 502 | `Recommendation engine unreachable` |
| `circuit-open` | 503 | `Recommendation engine circuit open` |

Remove the old `if (!result)` guard, replace with a switch/if on `result.ok` and `result.kind`.

### Tests — new file `apps/api/src/client/__tests__/recommendation-engine-client-preview.test.ts`

- Mock `fetch` globally for each case; reset between tests.
- Engine returns 404 → `result = { ok: false, kind: 'not-found', status: 404 }`.
- Engine returns 500 with body → `result = { ok: false, kind: 'server-error', status: 500, message: … }`.
- `fetch` throws `AbortError` → `result = { ok: false, kind: 'timeout' }`.
- `fetch` throws `TypeError` (network) → `result = { ok: false, kind: 'unreachable' }`.
- Engine returns 200 with valid body → `result = { ok: true, data: … }`.
- Each failure test asserts a `console.error` / logger call containing the expected fields (no headers present in logged object).

### Tests — add to `apps/api/src/routes/__tests__/recommendation-engine-delegation.test.ts` (or new sibling file)

- Mock `RecommendationEngineClient.previewShelfConcept` to return each error kind.
- `kind: 'timeout'` → `POST /shelf-concepts/:id/preview` responds 504.
- `kind: 'server-error', status: 500` → responds 502.
- `kind: 'not-found'` → responds 404.
- `kind: 'unreachable'` → responds 502.
- Nominal (`ok: true`) → responds 200 with preview payload.
- Preview with response time > 15 s but < `RECOMMENDATION_PREVIEW_TIMEOUT_MS` (simulated via fake timers) → responds 200 (not 504).

## Excluded

- Modifying any other `RecommendationEngineClient` methods — they keep their `T | null` signature.
- Circuit breaker threshold changes (failure from preview still trips the shared circuit; fixing that is a separate concern).
- Frontend changes — `ApiError` in `apps/web/src/lib/api.ts` already extracts `error` from the response body, and `RecommendationLabPage.tsx:388` already shows `err.message` in the toast; no change needed.
- Adding a health / version endpoint to the recommendation engine itself.
- Changing the recommendation engine deployment or its routes.
- Fixing the underlying engine bug (this ticket only makes it diagnosable).

## Acceptance criteria

- `previewShelfConcept()` never returns `null`; it always returns a typed `EnginePreviewResult`.
- A failed preview call produces a structured log entry containing at minimum: URL (no auth), HTTP status (if any), duration ms, error kind, truncated body — and never any request headers.
- `RECOMMENDATION_PREVIEW_TIMEOUT_MS` is read at startup; the default is 45 000 ms; other engine calls still use the 15 000 ms timeout.
- `POST /shelf-concepts/:id/preview` returns 404 when the engine has not deployed the route, 504 on timeout, 503 on open circuit, and 502 on 5xx or network error — each with a descriptive message different from the previous `"Recommendation engine unavailable"`.
- The frontend toast displays the precise message returned by the API (no code change required; verified by the route-level tests).
- All new unit and route-level tests pass; existing tests are unaffected.
