# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:39:35Z

---

# PR Review — T115 : Complete catalog enrichment and make refresh failures resumable/observable
## Attempt 29

## Résumé

L'implémentation est **techniquement complète et correcte**. L'ensemble du code source, des migrations et des tests ont été validés lors des reviews précédentes (24-28) et aucun changement n'a été apporté au code source depuis la review-28. Les 33 tests passent. Le seul blocage restant est opérationnel : la **Completion Rule** exige un run en production que seul un humain avec accès Fly.io peut exécuter.

---

## Vérifications effectuées

Audit direct des fichiers source sur la branche :

| Fichier | Statut |
|---|---|
| `tmdb/client.ts` — normalisation `runtime=0`, `imdb_id=""`, `overview` blank | ✓ |
| `metadata-enrichment-service.ts` — `classifyError()`, `persistFailure()`, `clearFailure()` | ✓ |
| `catalog-enrich-missing-service.ts` — keyset cursor, checkpoint, retry, idempotence | ✓ |
| `routes/catalog-enrich-missing.ts` — 4 routes, validation bounds, 202/409/404 | ✓ |
| `routes/catalog-stats.ts` — 13 agrégats parallèles, `embeddingPending` via NOT EXISTS | ✓ |
| `embedding-eligibility.ts` — source unique partagée stats + backfill | ✓ |
| `0047_t115_catalog_refresh_runs_type.sql` — colonne `type` | ✓ |
| `0048_t115_enrichment_failures.sql` — table + index unique | ✓ |
| `index.ts` — routes enregistrées | ✓ |

---

## Points validés

**Normalisation TMDB**
- `raw.runtime || null` → `runtimeMinutes: null` pour `runtime=0` ✓
- `raw.imdb_id || null` → `imdbId: null` pour `imdb_id=""` ✓
- `raw.overview?.trim() || null` → `synopsis: null` pour les chaînes blanches ✓
- Appliqué identiquement dans `mapMovieDetail()` et `mapSeriesDetail()` ✓

**Observabilité des échecs**
- `classifyError()` extrait `constructor.name`, code PG (ex. `23502`, `23505`), message brut — pas la requête SQL générée ✓
- `persistFailure()` upsert sur `(media_type, media_id)`, incrémente `retry_count` à chaque réessai ✓
- Stages distincts : `fetch`, `map`, `db_update`, `seasons` ✓
- `clearFailure()` supprime la ligne sur succès ✓

**Mode enrich-missing**
- Pagination keyset : `WHERE id > :lastId ORDER BY id LIMIT n` — stable même si des lignes s'intercalent ✓
- Éligibilité : `tmdbId IS NOT NULL AND matchStatus = 'MATCHED' AND (metadataEnrichedAt IS NULL OR stale)` ✓
- Checkpoint JSON écrit après chaque batch — redémarrage sans perte de position ✓
- Retry transient : 3 tentatives avec backoff 250/500/1000 ms ✓
- Idempotence : les lignes fraîches sont sautées (sauf `force=true`) ✓
- Protection concurrence : `checkNoRunningConflict()` + unique partial index sur `status='RUNNING'` + catch `23505` ✓
- Saisons enrichies via `enrichSeriesSeasons()` existant ✓

**Routes**
- `POST /admin/catalog-enrich-missing` → 202 `{runId}`, run asynchrone ✓
- `GET .../status` → dernières stats live depuis le checkpoint ✓
- `GET .../failures` → liste paginée avec filtres `mediaType`, `retryable` ✓
- `POST .../retry-failures` → réessai des failures (retryables par défaut, `force=true` pour toutes) ✓
- Validation des paramètres : `batchSize ∈ [1,500]`, `concurrency ∈ [1,20]`, `throttleMs ≥ 0` ✓

**Catalog stats**
- `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment` ✓
- `embeddingPending` calculé via `NOT EXISTS (SELECT 1 FROM media_embeddings ...)` — non hardcodé à 0 ✓

**Eligibilité embedding**
- `isEmbeddingEligible()` + `EMBEDDING_ELIGIBLE_SQL_PREDICATE` + `embeddingEligibleCondition` dans `embedding-eligibility.ts` ✓
- Utilisé par `catalog-stats.ts` (SQL brut) et `embedding-backfill-service.ts` (Drizzle condition) — source unique ✓

**Sécurité**
- Aucun secret loggué — `classifyError()` n'extrait que classe, code, message ✓
- Paramètres validés côté route avant transmission au service ✓

---

## Problèmes détectés

### [BLOQUANT — Opérationnel] Completion Rule non satisfaite

Le ticket exige explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le seul rapport existant (`production-run-20260819.md`) est **auto-labellisé** comme run local sur dev DB (6 films, pas un snapshot de production) :

> "Production API (api.iptvflix.com) not DNS-resolvable from this environment; Fly.io unauthenticated."

Aucun `production-run-*.md` avec des données à l'échelle de production (~60k films / ~5k séries) n'existe sur la branche.

Critères d'acceptance non démontrés :

| Critère | Statut |
|---|---|
| Run against the real production catalog | ❌ |
| Meaningful reduction of `neverEnriched` | ❌ |
| Remaining terminal failures with their real causes (les 126) | ❌ |
| Before/after counts at production scale | ❌ |

**Aucun cycle IA supplémentaire ne peut résoudre ce blocage.** Le code et le playbook sont prêts depuis l'attempt-12 ; la numérotation des migrations dans le playbook a été corrigée en attempt-27.

---

## Risques éventuels

**Mineur — `retryFailures()` sans checkpoint live** : contrairement à `start()` qui écrit le checkpoint après chaque batch, `retryFailures()` n'écrit le statut qu'à la fin. Sur un grand lot de failures, `GET .../status` reste figé sur le run précédent pendant le retry. Acceptable en l'état — le ticket ne demande pas de monitoring temps-réel des retries.

**Mineur — `retrying` dans les stats** : le compteur mesure des tentatives (pas des items uniques). Un seul item peut contribuer 3 fois. Commenté dans le code (`// Counts retry *attempts*, not unique items`). Comportement correct et documenté.

---

## Décision

REQUEST_CHANGES — non pour une raison de code (l'implémentation est correcte), mais parce que le critère d'acceptance opérationnel explicite n'est pas rempli.

---

## Actions demandées

**Humain uniquement** (l'IA ne peut pas exécuter cette étape) :

1. `flyctl auth login`
2. Déployer la branche en production ou accéder directement à `DATABASE_URL`
3. Vérifier que les migrations `0047` et `0048` sont appliquées (`psql $DATABASE_URL -c "SELECT tag FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5"`)
4. Exécuter le playbook `runs/T115/production-run-playbook.md` intégralement
5. Créer `runs/T115/production-run-20260820.md` avec :
   - Stats avant (`GET /admin/catalog-stats`)
   - `runId` et réponse du POST
   - Stats après
   - Liste des failures terminales avec `errorClass`, `errorCode`, `errorMessage` réels
   - Analyse des 126 failures connues (résolues vs encore terminales)
6. Commiter ce fichier sur la branche

Après ce commit, la review suivante devrait approuver immédiatement — aucune correction de code n'est attendue.

IMPLEMENTATION_FIX_REQUIRED
