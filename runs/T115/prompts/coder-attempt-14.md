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

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

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

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T115 — Complete catalog enrichment and make refresh failures resumable/observable

**Source**: GitHub Issue #242

## Description

## Context

A real production catalog refresh completed with:
- 2,725 movies refreshed
- 807 series refreshed
- 0 imported (expected after bootstrap)
- **126 failed updates**

The latest refresh checkpoint shows bounded batches (for example `refresh:MOVIE:stable offset 2750`, `refresh:SERIES:stable offset 800`) rather than a complete enrichment pass over the full ~60k movie / ~5k series catalog.

Some titles are still visibly incomplete until opened, indicating lazy/on-demand enrichment remains in use.

Before generating the production embedding corpus, we need a deterministic way to fully enrich all eligible catalog titles and retry failures.

## Goals

1. Provide a complete/resumable `enrich missing` pass over the canonical catalog.
2. Diagnose and fix the 126 refresh failures instead of only storing a generic failed query string.
3. Expose accurate enrichment progress so we know when the catalog is ready for embeddings.

## Required investigation

Audit `CatalogRefreshService` and related metadata enrichment code to determine:
- why stable refresh is capped/batched at the observed offsets;
- how titles are selected for `recent`, `stable`, `upcoming`;
- whether repeated refresh runs eventually cover the entire incomplete population or continually revisit the same rows;
- why specific updates fail;
- whether nullable/empty TMDB values such as runtime `0`, empty IMDb ID, empty synopsis, keywords/collection/external IDs can violate DB constraints or type expectations.

The production example failure included a movie update for `Les Chevaliers du Fiel : L'assassin est dans la salle`; preserve and expose the actual PostgreSQL/driver error cause, not only `Failed query: update ... params ...`.

## Enrich-missing mode

Add an explicit resumable mode/action that targets all canonical movies/series whose metadata is incomplete/stale, independently from the normal periodic refresh cadence.

It should:
- enumerate eligible incomplete rows deterministically;
- process in bounded batches with configurable concurrency/rate limiting;
- checkpoint by stable cursor/key so restart does not lose progress;
- skip already-complete/fresh rows unless forced;
- retry transient TMDB/DB failures with bounded retry/backoff;
- retain per-item terminal failures for later retry;
- be idempotent;
- support movies and series;
- not depend on opening a detail page to become enriched.

## Failure observability

Persist/report at minimum for each terminal failure:
- media type;
- media ID;
- TMDB ID;
- title;
- stage (`fetch`, `map`, `db_update`, etc.);
- sanitized error class/code/message;
- retry count;
- occurredAt;
- whether retryable.

Do not log secrets/credentials.

Expose run-level stats such as:
- total eligible;
- processed;
- enriched/completed;
- skipped already complete;
- remaining;
- retrying;
- failed terminal;
- current rate;
- ETA if practical.

## Catalog stats

Extend `/admin/catalog-stats` (or a dedicated diagnostic endpoint) so we can distinguish:
- total canonical titles;
- fully enriched;
- partially enriched;
- never enriched;
- stale;
- failed last enrichment;
- embedding eligible;
- embedding blocked by incomplete metadata.

Do not report `embeddingPending: 0` when the embedding corpus has not actually been created in the target pgvector DB.

## Embedding readiness

Define an explicit minimum metadata-quality policy for embedding generation. At minimum document which fields are required/preferred and whether incomplete titles are excluded or embedded with reduced documents.

The eventual backfill must be able to select only titles that meet this policy, and later pick up titles once enrichment succeeds.

## Acceptance criteria

- [ ] Production refresh failure root causes are observable with the real DB error, not only generated SQL/params.
- [ ] Known classes of invalid/empty TMDB values are normalized safely.
- [ ] Explicit `enrich missing` pass exists and is resumable/idempotent.
- [ ] Re-running it progresses toward zero eligible incomplete titles rather than repeatedly processing the same capped batch.
- [ ] Terminal failures are persisted/listable and individually retryable or retryable as a batch.
- [ ] Admin stats expose complete/partial/missing/failed/remaining counts accurately.
- [ ] Detail-page lazy enrichment is no longer required to obtain complete metadata for eligible catalog items.
- [ ] Embedding eligibility/readiness is explicit and accurate.
- [ ] Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.

## Completion rule

Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

---

**Situation claire — cycle 14, blocage uniquement humain.**

Il n'y a aucun changement de code à faire. Voici ce que j'ai vérifié dans ce cycle :

- `fly` est installé (`/opt/homebrew/bin/fly`) mais **non authentifié** — `fly auth whoami` retourne "no access token available"
- Railway CLI n'est pas installé
- Aucun `.env.local` ni `DATABASE_URL` dans l'environnement
- `api.iptvflix.com` n'est pas joignable depuis cet environnement (timeout)
- Le code est techniquement complet et correct (confirmé par la review)

**Ce qui bloque depuis 13 cycles : la completion rule** exige un run sur le catalogue de production (~60k films), et l'IA n'a pas les credentials.

---

**Pour débloquer — 3 options, pick one:**

**Option A (la plus simple)** — Donne-moi le DATABASE_URL production depuis Railway :
```
DATABASE_URL=postgresql://...
```
Je peux alors faire un `pg_dump` + restore local et exécuter tout le playbook.

**Option B** — Authentifie fly dans ce terminal :
```bash
fly auth login
```
Une fois connecté, je peux faire `fly proxy` sur la DB de production et exécuter le run directement.

**Option C** — Exécute le playbook toi-même (5 commandes, 5-10 min) :
Le fichier `runs/T115/production-run-playbook.md` contient les commandes exactes. Copie-colle la sortie ici et je génère l'artefact de completion.

---

Le code n'a pas besoin de nouveaux commits. Le seul livrable manquant est l'artefact `production-run-YYYYMMDD.md` avec de vrais before/after counts sur le catalogue de production.

---

## Review

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

---

## Instructions de fix

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