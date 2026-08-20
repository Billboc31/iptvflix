# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T15:52:31Z

---

---

# PR Review — T115 Complete catalog enrichment / failure observability

## Résumé

L'implémentation couvre les trois piliers du ticket : une passe `enrich-missing` resumable, la persistance des causes réelles d'échec, et des stats d'enrichissement détaillées. Le code est solide et les tests unitaires sont pertinents. **Un point bloquant** : la règle de clôture du ticket exige explicitement une exécution contre le catalogue de production réel (~60k films / ~5k séries) ou un snapshot restauré équivalent ; la run réalisée utilise un DB dev local avec 6 films.

---

## Vérifications effectuées

- Migrations `0046` et `0047` (type column + enrichment_failures table)
- `CatalogEnrichMissingService` : pagination curseur, checkpoint, compteurs, retry
- `MetadataEnrichmentService` : `persistFailure()`, `clearFailure()`, classification d'erreur
- `catalog-stats.ts` : toutes les colonnes requises, `embeddingPending` via NOT EXISTS réel
- `embedding-eligibility.ts` : politique documentée
- `TmdbClient` : normalisation runtime=0, imdb_id="", overview whitespace
- Tests : t115-normalization, t115-enrichment, catalog-stats
- Artefacts de run : local-validation-run-20260819.md, production-run-20260819.md
- Schema `enrichment_failures` : index unique `(media_type, media_id)`, upsert en conflit

---

## Points validés

**Observabilité des échecs** — `persistFailure()` capture `errorClass`, `errorCode`, `errorMessage` réels (ex. `PostgresError` code `23502`) au lieu d'un "Failed query: ...". Le stage (`fetch`, `map`, `db_update`, `seasons`) est correctement assigné. L'upsert sur `(media_type, media_id)` incrémente `retryCount` plutôt que de dupliquer.

**Normalisation TMDB** — `runtime: 0 → null`, `imdb_id: "" → null`, `overview: " " → null` dans `mapMovieDetail`/`mapSeriesDetail`. Tests unitaires couvrent les trois cas. Ces normalisations évitent les violations de contraintes DB.

**Passe enrich-missing** — Pagination curseur par `id` (`gt(table.id, lastId)`, `ORDER BY id ASC`), batch configurable, concurrence bornée, throttle, idempotente (skip si `metadataEnrichedAt` non nul et non stale). Le checkpoint DB est mis à jour à chaque batch.

**Stats catalogue** — `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingEligible`, `embeddingPending` calculés correctement. `embeddingPending` utilise un NOT EXISTS réel contre `media_embeddings` — ne peut pas retourner 0 si le corpus n'est pas créé.

**Retry** — `POST /admin/catalog-enrich-missing/retry-failures` avec filtre `retryable=true` par défaut, `force=true` pour tout réessayer. Bug route (force non transmis) corrigé en coder-12.

**Eligibilité embedding** — Politique documentée dans `embedding-eligibility.ts` avec commentaire sur les champs préférés. Le prédicat SQL est synchronized avec la fonction TypeScript.

**Migration journal** — Entrées `0044`–`0047` correctement ajoutées dans `meta/_journal.json` (fix critique découvert en local-validation).

---

## Problèmes détectés

### 🔴 Bloquant — Production run non exécutée

La règle de clôture du ticket est explicite :

> *"Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."*

La run documentée utilise un DB dev local avec **6 movies** (dont 3 enrichis en amont) et **39 séries** (37 sans tmdbId). Ce n'est pas un snapshot production restauré équivalent à ~60k films / ~5k séries. L'artefact `production-run-20260819.md` reconnaît explicitement que l'API de production n'est pas accessible depuis cet environnement.

**Conséquences non démontrées :**
- Comportement sur un vrai curseur de 60k rows (batch à batch, sur plusieurs heures)
- Les 126 failures historiques (dont le cas "Les Chevaliers du Fiel") avec leur vraie cause DB
- La réduction effective du nombre de titres incomplets avant/après

**Action requise :** Exécuter la passe contre le catalogue production (ou snapshot restauré) et publier before/after stats + liste des failures avec causes réelles.

---

### 🟡 Significatif — Checkpoint write-only, pas de resume réel

Le `checkpoint` est écrit dans `catalog_refresh_runs` à chaque batch, mais `start()` crée toujours un nouveau run avec `lastId: null`. Un crash en cours d'exécution entraîne un re-scan depuis le début au prochain appel. L'idempotence compense (les items enrichis sont skippés), mais pour un catalogue de 60k films, re-scanner depuis l'ID 0 jusqu'à la position précédente peut prendre un temps significatif.

Le ticket dit "checkpoint by stable cursor/key so restart does not lose progress." La correctitude est préservée (aucun item n'est raté), mais l'efficacité ne l'est pas.

**Mitigation acceptable** : Ajouter une méthode `resume(runId)` qui relit le checkpoint DB et reprend depuis `lastId`, ou documenter explicitement cette limitation dans la description de l'endpoint.

---

### 🟡 Significatif — Type lie sur `checkpoint` jsonb

`catalog-refresh-runs.ts` déclare `checkpoint: jsonb('checkpoint').$type<RefreshCheckpoint>()` où `RefreshCheckpoint = Record<string, { done: boolean; offset: number }>`. Le service ENRICH_MISSING écrit une structure `RunCheckpoint` (`{ movies: { lastId, processedCount, done }, series: {...}, stats: {...} }`) en contournant avec `as any`.

Cela crée une incohérence pour tout code lisant le checkpoint d'un run REFRESH vs ENRICH_MISSING. Suggère d'utiliser une union typée ou `unknown`.

---

### 🟡 Significatif — Test "cursor pagination" ne teste pas la pagination

Le test `CatalogEnrichMissingService — cursor pagination` affiche une intention de vérifier que la condition `gt(table.id, lastId)` est appliquée au 2ème batch, mais le corps du test ne fait que vérifier `countEligible()`. Le commentaire `// We can't easily test the full async run without a real DB` reconnaît la limitation. Ce test ne valide pas le comportement annoncé.

---

### 🟠 Mineur — Compteur `retrying` inflaté

`stats.retrying` est incrémenté **par tentative de retry** (via le callback `onRetry`) et non par item. Avec 3 tentatives maximum et concurrence=3, un item qui échoue 3 fois contribue `+2` à `stats.retrying` (les 2 premières tentatives non-finales). La sémantique documentée dans `EnrichMissingStats` devrait préciser que c'est un compte de tentatives, pas d'items.

---

### 🟠 Mineur — Race condition conflict check → HTTP 500

`checkNoRunningConflict()` est une vérification applicative avec une fenêtre de race entre le check et l'insert. Si deux requêtes passent le check simultanément, le second insert violerait le partial unique index DB (`catalog_refresh_runs_running_idx`) et remonterait une erreur DB non catchée → HTTP 500 au lieu de 409. Sur un endpoint admin peu sollicité, le risque est faible.

---

### 🟠 Mineur — `diagnose-db.mjs` n'inclut pas `enrichment_failures`

Le script de diagnostic (header T112) ne liste pas `enrichment_failures` dans ses row counts. Sur production, ce compteur serait utile pour valider que la table est bien créée et peuplée.

---

### 🔵 Observation — `partiallyEnriched: 0, fullyEnriched: 0` pour films réels

La run locale montre Inception/Dark Knight/Interstellar comme `partiallyEnriched` (keywords=null). Selon l'artefact, TMDB ne retourne pas `keywords` dans la réponse locale. En production, avec `append_to_response: 'keywords,external_ids'`, cela devrait fonctionner. À confirmer sur la production run.

---

## Risques éventuels

- **Aucun secret exposé** — `classifyError` ne logue pas de credentials. Le describeUrl dans diagnose-db masque le mot de passe. ✅
- **Destructivité** — `clearFailure()` delete les rows de failure quand l'enrichissement réussit. Comportement attendu et documenté. ✅
- **Rate limiting TMDB** — `fetchWithRetry` gère le 429 avec Retry-After. La concurrence est bornée à 20 par l'API. ✅

---

## Décision

L'implémentation est techniquement correcte et bien construite. Le seul bloquant est la non-exécution contre le catalogue production, exigée explicitement par la règle de clôture du ticket. Les points Significatifs sont des améliorations souhaitables mais non bloquantes pour la correction fonctionnelle.

**Action requise :** Obtenir l'accès au catalogue production (ou snapshot restauré), exécuter la passe `enrich-missing`, et publier les before/after counts + failures réelles.

IMPLEMENTATION_FIX_REQUIRED
