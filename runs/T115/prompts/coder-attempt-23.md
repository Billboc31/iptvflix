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

**Fix livré.** Voici le résumé :

**Problème trouvé** : `catalog-stats.test.ts` mockait 12 appels DB mais le route `catalog-stats.ts` en fait 13 (`seriesSeasonFailureCount` a été ajouté dans un cycle précédent sans mise à jour du test). La 13ème call non-mockée renvoyait `undefined`, `.from()` lançait une TypeError → HTTP 500 dans les deux tests.

**Fichier modifié** : `apps/api/src/routes/__tests__/catalog-stats.test.ts` — ajout d'un `setupSelectFromWhere({ cnt: 0 })` pour `seriesSeasonFailureCount` dans les deux cas de test, et mise à jour du commentaire de 12 → 13 queries.

**État des tests T115** : 33 tests passent (2 catalog-stats + 22 metadata-enrichment + 5 t115-enrichment + 4 t115-normalization).

**Bloquant restant (inchangé — action humaine requise)** : Le completion rule du ticket exige un run sur le catalogue de production. Le playbook `runs/T115/production-run-playbook.md` est prêt ; l'exécution requiert un accès Fly.io authentifié (`flyctl auth login`), inaccessible depuis l'environnement IA.

---

## Review

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable

## Résumé

L'implémentation couvre l'ensemble du périmètre technique du ticket : normalisation des valeurs TMDB invalides, persistance granulaire des échecs avec la vraie cause d'erreur PostgreSQL/driver, nouveau service `CatalogEnrichMissingService` avec pagination par curseur et checkpoint, 4 routes admin, extension des stats catalog, et politique d'éligibilité embedding. Le code est propre, les tests passent (33 tests). **Un seul blocage** : le **Completion Rule** du ticket exige explicitement une exécution sur le catalogue de production (ou snapshot équivalent) avec publication des compteurs avant/après — cette étape n'a pas été réalisée.

---

## Vérifications effectuées

- Lecture de tous les fichiers source modifiés (`catalog-enrich-missing-service.ts`, `metadata-enrichment-service.ts`, `catalog-stats.ts`, `catalog-enrich-missing.ts`, `embedding-eligibility.ts`, `enrichment-failures.ts`, `catalog-refresh-runs.ts`, `tmdb/client.ts`, `types.ts`)
- Lecture des deux migrations SQL (0047, 0048)
- Lecture de la suite de tests T115 (`t115-enrichment.test.ts`, `t115-normalization.test.ts`, `catalog-stats.test.ts`)
- Lecture du plan (`runs/T115/plan.md`) et du rapport de run (`runs/T115/production-run-20260819.md`)
- Vérification de la cohérence schema/migration (index partiel `status='RUNNING'`, upsert sur `(media_type, media_id)`)

---

## Points validés

**Normalisation TMDB (client.ts)**
- `runtime === 0` → `runtimeMinutes: null` via `raw.runtime || null` — correct, évite la violation de contrainte DB.
- `imdb_id === ""` → `imdbId: null` via `raw.imdb_id || null` — correct.
- `overview` whitespace → `synopsis: null` via `raw.overview?.trim() || null` — correct.
- La séparation JSON parse / mapping dans deux `try-catch` distincts permet de distinguer les erreurs de stage `fetch` vs `map` — bien pensé.
- `MetadataMappingError` bien typé et utilisé comme discriminant dans `persistFailure()`.

**Persistance des échecs (`MetadataEnrichmentService.persistFailure`)**
- Extrait `errorClass`, `errorCode`, `errorMessage` depuis l'objet Error réel — fini le `"Failed query: update ... params ..."`.
- Classification transient/terminal dans `classifyError()` : Network*, RateLimit*, ECONNRESET, ETIMEDOUT, ECONNREFUSED → retryable; tout le reste → terminal.
- Upsert sur `(media_type, media_id)` incrémente `retry_count` sur conflit — comportement correct.
- `clearFailure()` appelé en cas de succès — suppression propre.
- `persistFailure()` avec `stage: 'seasons'` préserve la distinction entre échec metadata principale vs enrichissement épisodes.

**Service `CatalogEnrichMissingService`**
- Pagination keyset (`id > lastId ORDER BY id ASC`) — non-sensible aux déphasages offset, reproductible.
- Checkpoint JSONB persisté après chaque batch — survie au redémarrage.
- `checkNoRunningConflict()` + catch 23505 sur l'INSERT — double sécurité contre les runs concurrents, correcte.
- `enrichWithRetry()` ne retente que `'provider-failed'` (erreurs transient) et pas `'terminal-failed'` — logique correcte.
- `resumeRunId` : reprise depuis le curseur d'un run précédent interrompu — idempotent.
- `retryFailures()` : filtre `retryable=true` par défaut, `force=true` inclut les terminaux — fix route appliqué et vérifié.

**Routes admin**
- Validation des paramètres d'entrée (batchSize 1–500, concurrency 1–20, throttleMs ≥ 0, mediaTypes enum) — correcte.
- Codes HTTP cohérents : 202 pour démarrage async, 409 pour conflit run, 404 si aucun run.
- `GET /failures` : pagination + filtres mediaType/retryable.

**Catalog-stats**
- 13 requêtes parallèles couvrant tous les champs demandés par le ticket.
- `embeddingPending` calculé via `NOT EXISTS` (sous-requête réelle) — plus de `0` hardcodé.
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` utilisé comme source unique dans catalog-stats et embedding-backfill-service — pas de duplication inline.
- `enrichedWithSeasonFailures` expose le cas séries dont la metadata principale est enrichie mais les épisodes ont échoué.

**Tests**
- `t115-normalization.test.ts` : couvre runtime=0, imdb_id="", overview whitespace pour movies et series.
- `t115-enrichment.test.ts` : couvre `persistFailure()` avec PostgresError code 23505, et le chemin `stage='db_update'` lors d'une exception DB update.
- Test curseur : vérifie que deux batches sont exécutés et que `enrichMovie` est appelé exactement pour les bons IDs.
- `catalog-stats.test.ts` : couvre les 13 slots de la Promise.all — le mock `seriesSeasonFailureCount` est bien présent.

---

## Problèmes détectés

### [BLOQUANT] Completion Rule non respectée — pas de run production

Le ticket stipule explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le rapport `runs/T115/production-run-20260819.md` documente un run sur une base locale avec **6 films seulement** (3 enrichis, 2 sans tmdbId, 1 cas de test artificiel avec un TMDB ID invalide `99999999`). Ce run ne constitue pas une validation au sens du Completion Rule. Les critères suivants restent non démontrés sur production :

- Réduction mesurable de `neverEnriched` sur le catalogue réel (~60k films / ~5k séries)
- Causes réelles des 126 échecs de production (notamment `Les Chevaliers du Fiel : L'assassin est dans la salle` avec son vrai TMDB ID)
- Comportement du checkpoint et de la pagination sur un volume de données réel
- Comportement de la migration 0047 (`ALTER TABLE ... ADD COLUMN`) sur une table de production non vide

Le `production-run-playbook.md` existe et documente les étapes exactes. Il doit être exécuté (par un opérateur humain disposant de l'accès Fly.io) et ses résultats attachés avant approbation.

### [Mineur] `retryFailures()` n'écrit pas de stats dans le checkpoint

`retryFailures()` crée un run `catalog_refresh_runs` mais n'initialise ni ne sauvegarde de `checkpoint` contenant les stats. Le statut retourné par `GET /admin/catalog-enrich-missing/status` après un retry run affiche `"stats": null`. Le progrès d'un retry batch n'est donc pas observable en temps réel. Ce comportement est documenté implicitement dans le rapport de run (`{ "status": "COMPLETED", "stats": null }`), mais surprend un opérateur qui s'attend à suivre la progression.

### [Mineur] `retryCount: 0` ambigu sur le premier échec

Lors de la première insertion dans `enrichment_failures`, `retry_count = 0`. Sémantiquement, `0` pourrait signifier "pas encore retryé" ou "premier tentative". Sur conflit, le trigger `+ 1` est correct. Mais la valeur `0` ne distingue pas "échec initial, aucun retry tenté" de l'absence d'information. Aucune correction requise mais un commentaire dans le schema clarifierait (`-- 0 = échec initial, incrémenté à chaque retry ultérieur`).

---

## Risques éventuels

1. **Stats query à l'échelle** : 13 requêtes agrégées parallèles sur 60k lignes sans cache. Sur production à fort trafic, `GET /admin/catalog-stats` pourrait être lent (> 200ms). Pas bloquant mais à monitorer après déploiement.

2. **Unique partial index sur `status='RUNNING'`** : un seul run à la fois (REFRESH ou ENRICH_MISSING). Si une opération de refresh planifiée est en cours au moment où un opérateur démarre manuellement un `enrich-missing`, il recevra un 409. Ce comportement est correct mais mérite d'être documenté dans le playbook.

3. **Rate limiting TMDB à grande échelle** : `enrichWithRetry` retente avec des délais courts (250ms, 500ms, 1000ms). `TmdbClient.fetchWithRetry` gère déjà un premier 429 en interne. Un deuxième 429 lève `TmdbRateLimitError`, classifié comme transient → 3 retries supplémentaires à intervalles courts. Sur 60k films en concurrence 3, ce chemin pourrait amplifier les 429. Pas bloquant mais à surveiller avec `throttleMs` élevé en production (≥ 500ms recommandé dans le playbook).

---

## Décision

L'implémentation est techniquement correcte, bien structurée, et couvre l'ensemble du périmètre code du ticket. La seule raison de ne pas approuver est le **Completion Rule** non honoré : la validation sur catalogue de production (ou snapshot restauré) n'a pas été effectuée et ses résultats ne sont pas publiés.

**Action requise** : exécuter le `production-run-playbook.md` avec accès Fly.io, attacher les compteurs avant/après et la liste des failures réelles (avec leurs `errorClass`, `errorCode`, `errorMessage` authentiques), puis relancer la review.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:01:19Z

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable

## Résumé

L'implémentation couvre l'ensemble du périmètre technique du ticket : normalisation des valeurs TMDB invalides, persistance granulaire des échecs avec la vraie cause d'erreur PostgreSQL/driver, nouveau service `CatalogEnrichMissingService` avec pagination par curseur et checkpoint, 4 routes admin, extension des stats catalog, et politique d'éligibilité embedding. Le code est propre, les tests passent (33 tests). **Un seul blocage** : le **Completion Rule** du ticket exige explicitement une exécution sur le catalogue de production (ou snapshot équivalent) avec publication des compteurs avant/après — cette étape n'a pas été réalisée.

---

## Vérifications effectuées

- Lecture de tous les fichiers source modifiés (`catalog-enrich-missing-service.ts`, `metadata-enrichment-service.ts`, `catalog-stats.ts`, `catalog-enrich-missing.ts`, `embedding-eligibility.ts`, `enrichment-failures.ts`, `catalog-refresh-runs.ts`, `tmdb/client.ts`, `types.ts`)
- Lecture des deux migrations SQL (0047, 0048)
- Lecture de la suite de tests T115 (`t115-enrichment.test.ts`, `t115-normalization.test.ts`, `catalog-stats.test.ts`)
- Lecture du plan (`runs/T115/plan.md`) et du rapport de run (`runs/T115/production-run-20260819.md`)
- Vérification de la cohérence schema/migration (index partiel `status='RUNNING'`, upsert sur `(media_type, media_id)`)

---

## Points validés

**Normalisation TMDB (client.ts)**
- `runtime === 0` → `runtimeMinutes: null` via `raw.runtime || null` — correct, évite la violation de contrainte DB.
- `imdb_id === ""` → `imdbId: null` via `raw.imdb_id || null` — correct.
- `overview` whitespace → `synopsis: null` via `raw.overview?.trim() || null` — correct.
- La séparation JSON parse / mapping dans deux `try-catch` distincts permet de distinguer les erreurs de stage `fetch` vs `map` — bien pensé.
- `MetadataMappingError` bien typé et utilisé comme discriminant dans `persistFailure()`.

**Persistance des échecs (`MetadataEnrichmentService.persistFailure`)**
- Extrait `errorClass`, `errorCode`, `errorMessage` depuis l'objet Error réel — fini le `"Failed query: update ... params ..."`.
- Classification transient/terminal dans `classifyError()` : Network*, RateLimit*, ECONNRESET, ETIMEDOUT, ECONNREFUSED → retryable; tout le reste → terminal.
- Upsert sur `(media_type, media_id)` incrémente `retry_count` sur conflit — comportement correct.
- `clearFailure()` appelé en cas de succès — suppression propre.
- `persistFailure()` avec `stage: 'seasons'` préserve la distinction entre échec metadata principale vs enrichissement épisodes.

**Service `CatalogEnrichMissingService`**
- Pagination keyset (`id > lastId ORDER BY id ASC`) — non-sensible aux déphasages offset, reproductible.
- Checkpoint JSONB persisté après chaque batch — survie au redémarrage.
- `checkNoRunningConflict()` + catch 23505 sur l'INSERT — double sécurité contre les runs concurrents, correcte.
- `enrichWithRetry()` ne retente que `'provider-failed'` (erreurs transient) et pas `'terminal-failed'` — logique correcte.
- `resumeRunId` : reprise depuis le curseur d'un run précédent interrompu — idempotent.
- `retryFailures()` : filtre `retryable=true` par défaut, `force=true` inclut les terminaux — fix route appliqué et vérifié.

**Routes admin**
- Validation des paramètres d'entrée (batchSize 1–500, concurrency 1–20, throttleMs ≥ 0, mediaTypes enum) — correcte.
- Codes HTTP cohérents : 202 pour démarrage async, 409 pour conflit run, 404 si aucun run.
- `GET /failures` : pagination + filtres mediaType/retryable.

**Catalog-stats**
- 13 requêtes parallèles couvrant tous les champs demandés par le ticket.
- `embeddingPending` calculé via `NOT EXISTS` (sous-requête réelle) — plus de `0` hardcodé.
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` utilisé comme source unique dans catalog-stats et embedding-backfill-service — pas de duplication inline.
- `enrichedWithSeasonFailures` expose le cas séries dont la metadata principale est enrichie mais les épisodes ont échoué.

**Tests**
- `t115-normalization.test.ts` : couvre runtime=0, imdb_id="", overview whitespace pour movies et series.
- `t115-enrichment.test.ts` : couvre `persistFailure()` avec PostgresError code 23505, et le chemin `stage='db_update'` lors d'une exception DB update.
- Test curseur : vérifie que deux batches sont exécutés et que `enrichMovie` est appelé exactement pour les bons IDs.
- `catalog-stats.test.ts` : couvre les 13 slots de la Promise.all — le mock `seriesSeasonFailureCount` est bien présent.

---

## Problèmes détectés

### [BLOQUANT] Completion Rule non respectée — pas de run production

Le ticket stipule explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le rapport `runs/T115/production-run-20260819.md` documente un run sur une base locale avec **6 films seulement** (3 enrichis, 2 sans tmdbId, 1 cas de test artificiel avec un TMDB ID invalide `99999999`). Ce run ne constitue pas une validation au sens du Completion Rule. Les critères suivants restent non démontrés sur production :

- Réduction mesurable de `neverEnriched` sur le catalogue réel (~60k films / ~5k séries)
- Causes réelles des 126 échecs de production (notamment `Les Chevaliers du Fiel : L'assassin est dans la salle` avec son vrai TMDB ID)
- Comportement du checkpoint et de la pagination sur un volume de données réel
- Comportement de la migration 0047 (`ALTER TABLE ... ADD COLUMN`) sur une table de production non vide

Le `production-run-playbook.md` existe et documente les étapes exactes. Il doit être exécuté (par un opérateur humain disposant de l'accès Fly.io) et ses résultats attachés avant approbation.

### [Mineur] `retryFailures()` n'écrit pas de stats dans le checkpoint

`retryFailures()` crée un run `catalog_refresh_runs` mais n'initialise ni ne sauvegarde de `checkpoint` contenant les stats. Le statut retourné par `GET /admin/catalog-enrich-missing/status` après un retry run affiche `"stats": null`. Le progrès d'un retry batch n'est donc pas observable en temps réel. Ce comportement est documenté implicitement dans le rapport de run (`{ "status": "COMPLETED", "stats": null }`), mais surprend un opérateur qui s'attend à suivre la progression.

### [Mineur] `retryCount: 0` ambigu sur le premier échec

Lors de la première insertion dans `enrichment_failures`, `retry_count = 0`. Sémantiquement, `0` pourrait signifier "pas encore retryé" ou "premier tentative". Sur conflit, le trigger `+ 1` est correct. Mais la valeur `0` ne distingue pas "échec initial, aucun retry tenté" de l'absence d'information. Aucune correction requise mais un commentaire dans le schema clarifierait (`-- 0 = échec initial, incrémenté à chaque retry ultérieur`).

---

## Risques éventuels

1. **Stats query à l'échelle** : 13 requêtes agrégées parallèles sur 60k lignes sans cache. Sur production à fort trafic, `GET /admin/catalog-stats` pourrait être lent (> 200ms). Pas bloquant mais à monitorer après déploiement.

2. **Unique partial index sur `status='RUNNING'`** : un seul run à la fois (REFRESH ou ENRICH_MISSING). Si une opération de refresh planifiée est en cours au moment où un opérateur démarre manuellement un `enrich-missing`, il recevra un 409. Ce comportement est correct mais mérite d'être documenté dans le playbook.

3. **Rate limiting TMDB à grande échelle** : `enrichWithRetry` retente avec des délais courts (250ms, 500ms, 1000ms). `TmdbClient.fetchWithRetry` gère déjà un premier 429 en interne. Un deuxième 429 lève `TmdbRateLimitError`, classifié comme transient → 3 retries supplémentaires à intervalles courts. Sur 60k films en concurrence 3, ce chemin pourrait amplifier les 429. Pas bloquant mais à surveiller avec `throttleMs` élevé en production (≥ 500ms recommandé dans le playbook).

---

## Décision

L'implémentation est techniquement correcte, bien structurée, et couvre l'ensemble du périmètre code du ticket. La seule raison de ne pas approuver est le **Completion Rule** non honoré : la validation sur catalogue de production (ou snapshot restauré) n'a pas été effectuée et ses résultats ne sont pas publiés.

**Action requise** : exécuter le `production-run-playbook.md` avec accès Fly.io, attacher les compteurs avant/après et la liste des failures réelles (avec leurs `errorClass`, `errorCode`, `errorMessage` authentiques), puis relancer la review.

---

IMPLEMENTATION_FIX_REQUIRED