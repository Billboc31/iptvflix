# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:23:24Z

---

Voici la review pour l'attempt-26.

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable
## Attempt 26

## Résumé

L'implémentation est techniquement complète et inchangée depuis la review-24. **33 tests passent** (vérifiés en direct). Aucun changement de code n'a été effectué entre coder-attempt-25 et cette review. Le seul blocage persistant est identique : le **Completion Rule** du ticket n'est pas satisfait — la validation sur le catalogue de production n'a pas eu lieu.

---

## Vérifications effectuées (review-26)

- Lecture directe de tous les fichiers source modifiés vs `main` (hors `dist/`)
- Exécution des 4 fichiers de tests T115 : **33/33 passent** (voir ci-dessous)
- Lecture du rapport `runs/T115/production-run-20260819.md`
- Lecture du `state.json` : état `IMPLEMENTATION_REVIEW_NEEDED`, aucune modification de code depuis review-25

```
 ✓ src/services/__tests__/metadata-enrichment-service.test.ts (23 tests)
 ✓ src/services/__tests__/t115-enrichment.test.ts (4 tests)
 ✓ src/routes/__tests__/catalog-stats.test.ts (2 tests)
 ✓ src/providers/metadata/tmdb/__tests__/t115-normalization.test.ts (4 tests)

 Test Files  4 passed (4)
      Tests  33 passed (33)
```

---

## Points validés (confirmés, aucun changement depuis review-24)

**Normalisation TMDB (`tmdb/client.ts`)**
- `raw.runtime || null` → `runtime=0` produit `runtimeMinutes: null` ✓
- `raw.imdb_id || null` → `imdb_id=""` produit `imdbId: null` ✓
- `raw.overview?.trim() || null` → synopsis whitespace-only produit `null` ✓
- `mapSeriesDetail` applique les mêmes gardes ✓

**`MetadataEnrichmentService`**
- `classifyError()` extrait le constructeur réel, code PG (`23502`, `23505`…), message brut ✓
- `persistFailure()` : upsert sur `(media_type, media_id)`, `retryCount + 1` atomique ✓
- `clearFailure()` en cas de succès ✓
- `stage: 'seasons'` discriminé du stage `db_update` ✓

**`CatalogEnrichMissingService`**
- Pagination keyset `WHERE id > :lastId ORDER BY id LIMIT n` — résistante au drift ✓
- Checkpoint JSONB après chaque batch ✓
- Double protection concurrence : `checkNoRunningConflict()` + catch `23505` ✓
- `enrichWithRetry()` : ne retente que `provider-failed` (transient) ✓
- `resumeRunId` : charge le checkpoint du run précédent ✓
- `retryFailures()` : `force=true` inclut les terminaux, `force=false` filtre `retryable=true` ✓

**Routes (`catalog-enrich-missing.ts`)**
- Validation : `batchSize` [1-500], `concurrency` [1-20], `throttleMs ≥ 0`, `mediaTypes` enum ✓
- `force` passé depuis le body (fix coder-12) ✓
- HTTP 202/409/404 cohérents ✓

**Catalog-stats (`catalog-stats.ts`)**
- 13 requêtes parallèles ✓
- `embeddingPending` via `NOT EXISTS (SELECT 1 FROM media_embeddings …)` — plus de `0` hardcodé ✓
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` source unique partagée ✓
- `enrichedWithSeasonFailures` exposé ✓

**Schéma & migrations**
- `enrichment_failures` : tous les champs requis, `UNIQUE INDEX (media_type, media_id)` ✓
- Migration 0047 : `ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'REFRESH'` — rétrocompatible ✓
- Migration 0048 : table + index ✓

**Sécurité**
- Aucun secret loggué ou hardcodé ✓
- Validation des entrées externes aux frontières (routes) ✓

---

## Problèmes détectés

### [BLOQUANT] Completion Rule non satisfaite — escalade humaine requise

Le ticket stipule explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le rapport `production-run-20260819.md` documente un run local sur **6 films**. Ce n'est pas équivalent à un snapshot de production. Les critères non démontrés :

| Critère ticket | Statut |
|---|---|
| Run against real production catalog | ❌ Non exécuté |
| Meaningful reduction of `neverEnriched` (~60k films) | ❌ Non démontré |
| Remaining terminal failures with real causes (les 126 échecs) | ❌ Non démontré |
| Cursor behavior at real volume | ❌ Non testé |

**Ce blocage ne peut pas être résolu par un cycle IA supplémentaire.** L'accès Fly.io (`flyctl auth login`) est requis. Le playbook est prêt à `runs/T115/production-run-playbook.md`.

**Action requise** : un opérateur humain avec accès production doit exécuter le playbook, publier les compteurs avant/après et la liste des failures réelles. Aucun nouveau cycle IA sur ce ticket n'est utile avant que cette étape soit complétée.

### [Mineur] `retryFailures()` sans stats temps réel

`GET /status` retourne `"stats": null` pendant toute la durée d'un batch retry. Documenté, non bloquant.

---

## Risques

1. **Scalabilité** : 13 queries agrégées sur 60k lignes en production sans cache — endpoint admin à trafic faible, acceptable.
2. **Rate limiting TMDB** : le playbook recommande `throttleMs ≥ 500` sur 60k films. À monitorer.
3. **Migration 0047** sur table `catalog_refresh_runs` non vide : `IF NOT EXISTS` protège la rétrocompatibilité ✓.

---

## Décision

L'implémentation est techniquement correcte, complète, et sans régression. 33 tests passent. La position de review est inchangée depuis la review-24 car **aucun changement de code n'a été effectué et la production n'a pas été touchée**.

**Ce ticket doit être débloqué par un opérateur humain, pas par un nouveau cycle IA.**

---

IMPLEMENTATION_FIX_REQUIRED
