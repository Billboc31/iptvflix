# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:30:05Z

---

I now have all the information needed. Let me write the review.

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable
## Attempt 27

## Résumé

L'implémentation est **techniquement correcte et complète**. Les 33 tests passent (vérifiés en direct). Aucun changement de code depuis la review-26. Un nouveau défaut mineur a été identifié dans le playbook de production (numérotation des migrations). Le blocage opérationnel sur le Completion Rule demeure inchangé.

---

## Vérifications effectuées

- Lecture directe de tous les fichiers source modifiés vs `main` (hors `dist/`)
- Exécution des 4 fichiers de tests T115 : **33/33 passent**
- Lecture du rapport `runs/T115/production-run-20260819.md`
- Vérification du répertoire migrations pour contrôle des numéros réels
- Lecture du playbook `runs/T115/production-run-playbook.md`

```
 ✓ src/services/__tests__/metadata-enrichment-service.test.ts (23 tests)
 ✓ src/services/__tests__/t115-enrichment.test.ts (4 tests)
 ✓ src/routes/__tests__/catalog-stats.test.ts (2 tests)
 ✓ src/providers/metadata/tmdb/__tests__/t115-normalization.test.ts (4 tests)

 Test Files  4 passed (4)
      Tests  33 passed (33)
```

---

## Points validés (inchangés depuis review-24)

**Normalisation TMDB (`tmdb/client.ts`)**
- `raw.runtime || null` → `runtime=0` produit `runtimeMinutes: null` ✓
- `raw.imdb_id || null` → `imdb_id=""` produit `imdbId: null` ✓
- `raw.overview?.trim() || null` → synopsis whitespace-only produit `null` ✓
- Mêmes gardes dans `mapSeriesDetail()` ✓

**`MetadataEnrichmentService`**
- `classifyError()` extrait constructeur réel, code PG (`23502`, `23505`…), message brut ✓
- `persistFailure()` : upsert sur `(media_type, media_id)`, `retryCount + 1` atomique ✓
- `clearFailure()` au succès ✓
- `stage: 'seasons'` discriminé du stage `db_update` ✓

**`CatalogEnrichMissingService`**
- Pagination keyset `WHERE id > :lastId ORDER BY id LIMIT n` — résistante au drift ✓
- Checkpoint JSONB après chaque batch ✓
- Double protection concurrence : `checkNoRunningConflict()` + catch `23505` ✓
- `enrichWithRetry()` ne retente que `provider-failed` (transient) ✓
- `resumeRunId` charge le checkpoint du run précédent ✓
- `retryFailures()` : `force=true` inclut les terminaux ✓

**Routes (`catalog-enrich-missing.ts`)**
- Validation : `batchSize` [1-500], `concurrency` [1-20], `throttleMs ≥ 0`, `mediaTypes` enum ✓
- `force` passé depuis le body ✓
- HTTP 202/409/404 cohérents ✓

**Catalog-stats (`catalog-stats.ts`)**
- 13 requêtes parallèles ✓
- `embeddingPending` via `NOT EXISTS` — plus de `0` hardcodé ✓
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` source unique partagée ✓
- `enrichedWithSeasonFailures` exposé ✓

**Migrations**
- `0047_t115_catalog_refresh_runs_type.sql` : `ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'REFRESH'` — rétrocompatible ✓
- `0048_t115_enrichment_failures.sql` : table + index unique ✓
- Schema Drizzle aligné sur les migrations ✓

**Sécurité** : aucun secret loggué ou hardcodé, validation aux frontières ✓

---

## Problèmes détectés

### [Mineur — corrigeable par coder] Numérotation incorrecte dans le playbook

Le fichier `runs/T115/production-run-playbook.md` (Step 1) indique les migrations attendues comme :
```
0046_t115_catalog_refresh_runs_type
0047_t115_enrichment_failures
```

Les **vrais** noms de fichiers sur le filesystem sont :
```
0047_t115_catalog_refresh_runs_type.sql
0048_t115_enrichment_failures.sql
```

`0046` est en réalité `0046_device_account_id.sql` (migration non liée à T115). L'opérateur qui suivrait le playbook ne trouverait pas les migrations attendues et pourrait croire qu'elles ne sont pas appliquées.

**Correction requise** : mettre à jour le playbook Step 1 pour mentionner `0047_t115_catalog_refresh_runs_type` et `0048_t115_enrichment_failures`.

---

### [BLOQUANT — Opérationnel, escalade humaine requise] Completion Rule non satisfaite

Le ticket exige explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le rapport `production-run-20260819.md` documente un run sur **6 films en DB locale**, pas une snapshot de production équivalente. Les critères non démontrés :

| Critère ticket | Statut |
|---|---|
| Run against real production catalog (~60k films / ~5k séries) | ❌ |
| Meaningful reduction of `neverEnriched` | ❌ |
| Remaining terminal failures with real causes (les 126 échecs) | ❌ |
| Cursor behavior at real volume | ❌ |

**Ce blocage ne peut pas être résolu par un cycle IA.** L'accès Fly.io est requis. Le playbook est prêt à `runs/T115/production-run-playbook.md` (à corriger selon le point mineur ci-dessus).

**Action requise** : un opérateur humain avec accès production doit :
1. Corriger le playbook (numéros de migrations)
2. Exécuter le playbook contre la production
3. Publier le rapport before/after dans `runs/T115/production-run-YYYYMMDD.md`

---

## Risques

1. **Scalabilité** : 13 requêtes agrégées sur ~60k lignes sans cache — endpoint admin à faible trafic, acceptable.
2. **Rate limiting TMDB** : le playbook recommande `throttleMs ≥ 500` sur ~60k films.
3. **Migration 0047** sur table non vide : `IF NOT EXISTS` protège la rétrocompatibilité ✓.

---

## Décision

L'implémentation est techniquement correcte. 33 tests passent. Un seul correctif de code est nécessaire (playbook), et la condition de clôture du ticket reste non satisfaite par manque d'accès production.

**Aucun nouveau cycle IA sur la partie code n'est utile après la correction du playbook.** La validation finale est un acte opérationnel humain.

IMPLEMENTATION_FIX_REQUIRED
