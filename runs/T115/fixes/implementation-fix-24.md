# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:14:47Z

---

I now have a complete picture of the implementation. Let me write the review.

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable

## Résumé

Après 25 cycles de review/fix, l'implémentation est techniquement complète, propre et bien structurée. 33 tests passent. Un seul blocage persiste, identique depuis la review-24 : le **Completion Rule** du ticket n'est pas satisfait — le run de production n'a pas été exécuté sur le vrai catalogue. Ce blocage ne peut pas être résolu par un cycle AI supplémentaire — il requiert une action humaine avec accès Fly.io.

---

## Vérifications effectuées

- Lecture directe de tous les fichiers source modifiés : `tmdb/client.ts`, `metadata-enrichment-service.ts`, `catalog-enrich-missing-service.ts`, `catalog-enrich-missing.ts`, `catalog-stats.ts`, `embedding-eligibility.ts`, `enrichment-failures.ts` (schema), `catalog-refresh-runs.ts`, `index.ts`
- Lecture des migrations SQL (0047, 0048)
- Lecture de `runs/T115/production-run-20260819.md` et `runs/T115/production-run-playbook.md`
- Lecture du plan (`runs/T115/plan.md`) et du contexte du dernier cycle (`context-20260820T210234Z.md`)
- Lecture de la review précédente (`review-attempt-24`) — position inchangée sur le blocage

---

## Points validés

**Normalisation TMDB (`tmdb/client.ts`)**
- `raw.runtime || null` → `runtime=0` produit `runtimeMinutes: null` — correct
- `raw.imdb_id || null` → `imdb_id=""` produit `imdbId: null` — correct
- `raw.overview?.trim() || null` → synopsis whitespace-only produit `null` — correct
- `mapSeriesDetail` applique les mêmes gardes — cohérent avec `mapMovieDetail`
- Deux `try/catch` distincts pour la désérialisation JSON et le mapping — permet la discrimination `fetch` vs `map` dans `persistFailure`

**Persistance des échecs (`MetadataEnrichmentService`)**
- `classifyError()` extrait `errorClass` (constructeur réel), `errorCode` (code PostgreSQL), `errorMessage` (message brut) — fini le `"Failed query: update ... params ..."`
- Transient : `Network*`, `RateLimit*`, `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED` → `retryable: true` ; tout autre erreur → `retryable: false` — classification correcte
- `persistFailure()` fait un upsert sur `(media_type, media_id)`, incrémente `retry_count` via `${enrichmentFailures.retryCount} + 1` — correct et atomique
- `clearFailure()` appelé en cas de succès — nettoyage propre
- `stage: 'seasons'` distingue l'échec d'enrichissement épisodes de l'échec metadata principale

**`CatalogEnrichMissingService`**
- Pagination keyset `WHERE id > :lastId ORDER BY id ASC LIMIT n` — non sensible au drift offset, reproductible
- Checkpoint JSONB persisté après chaque batch (`saveCheckpoint()`) — survie au crash/restart
- Double protection concurrence : `checkNoRunningConflict()` + catch 23505 sur l'INSERT
- `enrichWithRetry()` ne retente que `'provider-failed'` (transient), pas `'terminal-failed'` — logique correcte
- `resumeRunId` charge le checkpoint du run précédent, reprend depuis le bon curseur
- `retryFailures()` : filtrage `retryable=true` par défaut, `force=true` inclut les terminaux — fix de la route (coder-12) appliqué et vérifié dans le rapport

**Routes admin (`catalog-enrich-missing.ts`)**
- `POST /admin/catalog-enrich-missing` : validation batchSize [1-500], concurrency [1-20], throttleMs ≥ 0, mediaTypes enum — correcte
- `POST … /retry-failures` : `force` passé depuis le body au service — fix confirmé
- HTTP 202 pour démarrage async, 409 conflit run, 404 aucun run — cohérents

**Catalog-stats (`catalog-stats.ts`)**
- 13 requêtes parallèles ; mock de test mis à jour à 13 slots (fix coder-23) — les 33 tests passent
- `embeddingPending` calculé via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — plus de `0` hardcodé
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` source unique partagée entre stats et backfill — pas de duplication inline
- `enrichedWithSeasonFailures` exposé pour les séries dont la metadata principale est enrichie mais les épisodes ont échoué

**Politique d'éligibilité embedding (`embedding-eligibility.ts`)**
- `isEmbeddingEligible` : `metadataEnrichedAt IS NOT NULL` — documenté, extensible
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` et `embeddingEligibleCondition` en cohérence avec la fonction — sync explicitement documentée dans les commentaires

**Schéma et migrations**
- `enrichment_failures` : tous les champs requis par le ticket présents, UNIQUE INDEX sur `(media_type, media_id)` — correct
- Migration 0047 : `ALTER TABLE catalog_refresh_runs ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'REFRESH'` — rétrocompatible
- Migration 0048 : création table + unique index — correct

---

## Problèmes détectés

### [BLOQUANT] Completion Rule non respectée — run production non exécuté

Le ticket stipule explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le rapport `runs/T115/production-run-20260819.md` documente un run sur une base locale de **6 films** (3 enrichis, 2 sans tmdbId, 1 avec TMDB ID fictif `99999999`). Ce run ne constitue pas une validation au sens du Completion Rule. Les critères non démontrés restent :

- Réduction mesurable de `neverEnriched` sur le catalogue réel (~60k films / ~5k séries)
- Causes réelles des 126 échecs de production (notamment le vrai TMDB ID de `Les Chevaliers du Fiel : L'assassin est dans la salle`)
- Comportement du checkpoint/pagination à volume réel
- Application de la migration 0047 sur la table `catalog_refresh_runs` de production non vide

**Ce blocage ne peut pas être résolu par un cycle AI supplémentaire.** L'accès Fly.io (`flyctl auth login`) est requis. Le `production-run-playbook.md` est prêt. L'action requise est une escalade vers un opérateur humain disposant de l'accès production.

### [Mineur] `retryFailures()` sans stats en temps réel

`retryFailures()` ne persiste pas de checkpoint intermédiaire pendant le run. `GET /status` retourne `"stats": null` pendant toute la durée d'un batch retry. Comportement documenté dans le rapport de run mais peut surprendre un opérateur qui surveille un large batch de retries.

### [Mineur] `retryCount: 0` ambigu

À la première insertion dans `enrichment_failures`, `retry_count = 0`. Le commentaire `-- 0 = initial failure, no retry attempted; incremented on each subsequent retry` existe dans le schema Drizzle (vérifié) — suffisant.

---

## Risques éventuels

1. **Scalabilité des 13 queries agrégées** : sur 60k lignes en production sans cache, `GET /admin/catalog-stats` peut dépasser 200ms. Pas bloquant — endpoint admin, trafic faible.

2. **Index partiel `status='RUNNING'`** : un seul run simultané (REFRESH ou ENRICH_MISSING). Un refresh planifié en cours bloque le démarrage manuel d'un enrich-missing → 409. Comportement correct, documenté dans le playbook.

3. **Rate limiting TMDB à grande échelle** : double 429 → `TmdbRateLimitError` → transient → 3 retries avec délais courts. À monitorer sur 60k films. Le playbook recommande `throttleMs ≥ 500`.

---

## Décision

L'implémentation est techniquement correcte et complète. 33 tests passent. Le code répond à tous les critères de qualité, scope, sécurité et architecture. **La seule raison de ne pas approuver est le Completion Rule non honoré**, identique depuis la review-24.

Ce blocage requiert une escalade humaine — pas un nouveau cycle AI. **Action requise** : un opérateur humain avec accès Fly.io doit exécuter le `production-run-playbook.md`, attacher les compteurs avant/après et la liste des failures réelles, puis cette review sera réexaminée.

---

IMPLEMENTATION_FIX_REQUIRED
