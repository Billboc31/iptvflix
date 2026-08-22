**20/20 tests passent.** Voici le résumé des changements :

---

## Fichiers modifiés

**`apps/api/src/config/env.ts`**
- Ajout de `RECOMMENDATION_PREVIEW_TIMEOUT_MS` (défaut : 45 000 ms, configurable via env).

**`apps/api/src/client/recommendation-engine-client.ts`**
- Nouveau type exporté `EnginePreviewResult<T>` avec les discriminants `ok: true | false` et `kind: 'not-found' | 'server-error' | 'timeout' | 'unreachable' | 'circuit-open'`.
- `fetchWithTimeout` accepte maintenant un `timeoutMs` optionnel (défaut : 15 s inchangé pour tous les autres appels).
- `previewShelfConcept()` réécrite : signature `Promise<EnginePreviewResult<ShelfConceptPreviewResponse>>`, timeout dédié de 45 s, logs structurés `console.error` / `console.info` avec `{ endpoint, status, durationMs, kind, body }` — aucun header logué.

**`apps/api/src/routes/shelf-concepts.ts`**
- Handler `POST /shelf-concepts/:id/preview` : switch sur `result.kind` → 404 / 503 / 504 / 502 avec messages précis au lieu de l'ancien 502 générique.

## Fichiers créés

**`apps/api/src/client/__tests__/recommendation-engine-client-preview.test.ts`** (6 tests)
- 200 → `{ ok: true, data }`, 404 → `not-found`, 500 → `server-error`, AbortError → `timeout`, TypeError → `unreachable`, fake-timers à 20 s → succès (timeout 45 s non déclenché).

**`apps/api/src/routes/__tests__/shelf-concepts-preview.test.ts`** (8 tests)
- Mapping complet de chaque `kind` vers son code HTTP, vérification que les messages diffèrent de l'ancien "Recommendation engine unavailable".
