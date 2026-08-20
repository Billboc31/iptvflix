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

La situation est confirmée : le code T115 est complet (33 tests, migrations correctes), mais l'environnement IA n'a pas accès à la production. Voici exactement ce qu'il faut faire.

---

## Blocage opérationnel — action humaine requise

L'implémentation est prête depuis l'attempt-12. La seule chose manquante est l'artefact du run en production, que la Completion Rule exige explicitement. Aucun cycle IA supplémentaire ne peut le produire.

**Ce dont j'ai besoin de toi :**

### 1 — Authentifie flyctl

```bash
flyctl auth login
```

### 2 — Récupère les credentials

```bash
# DATABASE_URL de production
flyctl secrets list --app iptvflix-api 2>/dev/null
flyctl ssh console --app iptvflix-api -C "printenv DATABASE_URL" 2>/dev/null

# Ou directement via proxy
flyctl proxy 5432 --app iptvflix-db
export DATABASE_URL="postgres://localhost:5432/..."
```

### 3 — Exécute le playbook complet

Le playbook est à `runs/T115/production-run-playbook.md`. En résumé :

```bash
export ADMIN_PASSWORD="..."

# Stats avant
curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-stats | jq .

# Lance l'enrich-missing
curl -s -X POST \
  -u admin:$ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "concurrency": 3, "throttleMs": 500}' \
  https://api.iptvflix.com/admin/catalog-enrich-missing | jq .

# Poll jusqu'à COMPLETED (toutes les 30s)
watch -n 30 'curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-enrich-missing/status | jq .'

# Stats après
curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-stats | jq .

# Liste des failures terminales
curl -s -u admin:$ADMIN_PASSWORD \
  "https://api.iptvflix.com/admin/catalog-enrich-missing/failures?limit=200" | jq .
```

### 4 — Donne-moi les outputs

Une fois les commandes exécutées, colle-moi les 4 outputs JSON (before stats, POST response, after stats, failures) et **je crée immédiatement `runs/T115/production-run-20260820.md`** et je commite sur la branche. La review suivante approuvera sans demande de correction supplémentaire.

---

**Alternative** : si tu as un dump de la DB de production que tu peux restaurer localement, je peux adapter le playbook pour pointer vers `localhost` et exécuter moi-même le run.

---

## Review

Now I have a complete picture. Let me write the review.

---

# PR Review — T115 : Complete catalog enrichment and make refresh failures resumable/observable
## Attempt 30

## Résumé

L'implémentation est **techniquement complète, correcte, et inchangée depuis la review-24**. Les 33 tests passent. L'ensemble des fichiers source, migrations et routes a été validé dans les cycles précédents. Le seul blocage restant est **opérationnel** : la Completion Rule du ticket exige un run en production que seul un humain avec accès Fly.io peut déclencher. Aucun cycle IA supplémentaire ne peut débloquer cette situation.

---

## Vérifications effectuées

| Fichier | Statut |
|---|---|
| `tmdb/client.ts` — `runtime=0` → `null`, `imdb_id=""` → `null`, `overview` blank → `null` | ✓ |
| `metadata-enrichment-service.ts` — `classifyError()`, `persistFailure()`, `clearFailure()` | ✓ |
| `catalog-enrich-missing-service.ts` — keyset cursor, checkpoint par batch, retry 3× backoff, idempotence | ✓ |
| `routes/catalog-enrich-missing.ts` — 4 routes, validation bounds, 202/409/404, `force` passé correctement (fix coder-12) | ✓ |
| `routes/catalog-stats.ts` — agrégats parallèles, `embeddingPending` via `NOT EXISTS` réel | ✓ |
| `embedding-eligibility.ts` — source unique partagée stats + backfill | ✓ |
| `0047_t115_catalog_refresh_runs_type.sql` | ✓ |
| `0048_t115_enrichment_failures.sql` | ✓ |
| `index.ts` — routes enregistrées | ✓ |

---

## Points validés

**Normalisation TMDB** — `mapMovieDetail()` et `mapSeriesDetail()` : `raw.runtime || null`, `raw.imdb_id || null`, `raw.overview?.trim() || null` — aucune valeur vide ne peut provoquer une violation de contrainte DB.

**Observabilité des échecs** — `classifyError()` extrait `constructor.name`, code PG, message brut (pas la requête SQL). `persistFailure()` upsert sur `(media_type, media_id)` avec incrément de `retry_count`. Stages : `fetch`, `map`, `db_update`, `seasons`. `clearFailure()` nettoie sur succès.

**Mode enrich-missing** — Pagination keyset (`WHERE id > :lastId`), éligibilité `tmdbId IS NOT NULL AND matchStatus = 'MATCHED' AND (metadataEnrichedAt IS NULL OR stale)`, checkpoint après chaque batch, idempotence via recency check, protection concurrence (`checkNoRunningConflict()` + catch `23505`).

**Routes** — Validation des bornes, 202 Accepted asynchrone, 409 si run déjà actif, `force` propagé (fix coder-12).

**Catalog stats** — `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingPending` non hardcodé.

**Sécurité** — Aucun secret loggué ; paramètres validés côté route.

---

## Problèmes détectés

### [BLOQUANT — Opérationnel] Completion Rule non satisfaite

Le ticket stipule explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Et l'acceptance criterion correspondant :

> Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.

Le seul rapport existant (`production-run-20260819.md`) est un run **local dev DB** (6 films, environnement explicitement hors-production) :

> *"Production API (api.iptvflix.com) not DNS-resolvable from this environment; Fly.io unauthenticated."*

Il n'existe aucun `production-run-*.md` avec des données à l'échelle production (~60k films / ~5k séries). Les 126 failures connues n'ont pas été diagnostiquées avec leur vraie cause DB.

**Ce blocage est purement opérationnel. Aucun cycle IA supplémentaire n'est utile ici.**

---

## Risques éventuels (mineurs, non bloquants)

- **`retryFailures()` sans checkpoint live** : statut figé pendant un retry sur grand lot. Acceptable — le ticket ne demande pas de monitoring temps-réel des retries.
- **Compteur `retrying`** mesure des tentatives, pas des items uniques. Documenté dans le code.

---

## Décision

`IMPLEMENTATION_FIX_REQUIRED` — non pour une raison de code (l'implémentation est correcte et complète), mais parce que le critère d'acceptance opérationnel explicite du ticket n'est pas satisfait. La Completion Rule est non négociable selon les termes du ticket.

---

## Actions demandées

**Humain uniquement — aucun agent IA ne peut exécuter cette étape :**

1. `flyctl auth login` (ou accès direct à `DATABASE_URL`)
2. Vérifier migrations : `psql $DATABASE_URL -c "SELECT tag FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5"` — confirmer `0047` et `0048` présents
3. `GET /admin/catalog-stats` → capturer l'état avant (~60k films, ~5k séries attendus)
4. `POST /admin/catalog-enrich-missing` `{"batchSize":50,"concurrency":3,"throttleMs":500}` → capturer `runId`
5. Poller `GET /admin/catalog-enrich-missing/status` jusqu'à `"status":"COMPLETED"`
6. `GET /admin/catalog-stats` → capturer l'état après
7. `GET /admin/catalog-enrich-missing/failures?limit=200` → capturer les failures terminales avec `errorClass`, `errorCode`, `errorMessage` réels (dont celle pour `Les Chevaliers du Fiel`)
8. `POST /admin/catalog-enrich-missing/retry-failures {"force":true}` → retenter les 126 failures connues
9. Créer `runs/T115/production-run-20260820.md` avec ce rapport et commiter sur la branche

Le playbook complet est dans `runs/T115/production-run-playbook.md`.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:44:31Z

---

Now I have a complete picture. Let me write the review.

---

# PR Review — T115 : Complete catalog enrichment and make refresh failures resumable/observable
## Attempt 30

## Résumé

L'implémentation est **techniquement complète, correcte, et inchangée depuis la review-24**. Les 33 tests passent. L'ensemble des fichiers source, migrations et routes a été validé dans les cycles précédents. Le seul blocage restant est **opérationnel** : la Completion Rule du ticket exige un run en production que seul un humain avec accès Fly.io peut déclencher. Aucun cycle IA supplémentaire ne peut débloquer cette situation.

---

## Vérifications effectuées

| Fichier | Statut |
|---|---|
| `tmdb/client.ts` — `runtime=0` → `null`, `imdb_id=""` → `null`, `overview` blank → `null` | ✓ |
| `metadata-enrichment-service.ts` — `classifyError()`, `persistFailure()`, `clearFailure()` | ✓ |
| `catalog-enrich-missing-service.ts` — keyset cursor, checkpoint par batch, retry 3× backoff, idempotence | ✓ |
| `routes/catalog-enrich-missing.ts` — 4 routes, validation bounds, 202/409/404, `force` passé correctement (fix coder-12) | ✓ |
| `routes/catalog-stats.ts` — agrégats parallèles, `embeddingPending` via `NOT EXISTS` réel | ✓ |
| `embedding-eligibility.ts` — source unique partagée stats + backfill | ✓ |
| `0047_t115_catalog_refresh_runs_type.sql` | ✓ |
| `0048_t115_enrichment_failures.sql` | ✓ |
| `index.ts` — routes enregistrées | ✓ |

---

## Points validés

**Normalisation TMDB** — `mapMovieDetail()` et `mapSeriesDetail()` : `raw.runtime || null`, `raw.imdb_id || null`, `raw.overview?.trim() || null` — aucune valeur vide ne peut provoquer une violation de contrainte DB.

**Observabilité des échecs** — `classifyError()` extrait `constructor.name`, code PG, message brut (pas la requête SQL). `persistFailure()` upsert sur `(media_type, media_id)` avec incrément de `retry_count`. Stages : `fetch`, `map`, `db_update`, `seasons`. `clearFailure()` nettoie sur succès.

**Mode enrich-missing** — Pagination keyset (`WHERE id > :lastId`), éligibilité `tmdbId IS NOT NULL AND matchStatus = 'MATCHED' AND (metadataEnrichedAt IS NULL OR stale)`, checkpoint après chaque batch, idempotence via recency check, protection concurrence (`checkNoRunningConflict()` + catch `23505`).

**Routes** — Validation des bornes, 202 Accepted asynchrone, 409 si run déjà actif, `force` propagé (fix coder-12).

**Catalog stats** — `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingPending` non hardcodé.

**Sécurité** — Aucun secret loggué ; paramètres validés côté route.

---

## Problèmes détectés

### [BLOQUANT — Opérationnel] Completion Rule non satisfaite

Le ticket stipule explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Et l'acceptance criterion correspondant :

> Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.

Le seul rapport existant (`production-run-20260819.md`) est un run **local dev DB** (6 films, environnement explicitement hors-production) :

> *"Production API (api.iptvflix.com) not DNS-resolvable from this environment; Fly.io unauthenticated."*

Il n'existe aucun `production-run-*.md` avec des données à l'échelle production (~60k films / ~5k séries). Les 126 failures connues n'ont pas été diagnostiquées avec leur vraie cause DB.

**Ce blocage est purement opérationnel. Aucun cycle IA supplémentaire n'est utile ici.**

---

## Risques éventuels (mineurs, non bloquants)

- **`retryFailures()` sans checkpoint live** : statut figé pendant un retry sur grand lot. Acceptable — le ticket ne demande pas de monitoring temps-réel des retries.
- **Compteur `retrying`** mesure des tentatives, pas des items uniques. Documenté dans le code.

---

## Décision

`IMPLEMENTATION_FIX_REQUIRED` — non pour une raison de code (l'implémentation est correcte et complète), mais parce que le critère d'acceptance opérationnel explicite du ticket n'est pas satisfait. La Completion Rule est non négociable selon les termes du ticket.

---

## Actions demandées

**Humain uniquement — aucun agent IA ne peut exécuter cette étape :**

1. `flyctl auth login` (ou accès direct à `DATABASE_URL`)
2. Vérifier migrations : `psql $DATABASE_URL -c "SELECT tag FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5"` — confirmer `0047` et `0048` présents
3. `GET /admin/catalog-stats` → capturer l'état avant (~60k films, ~5k séries attendus)
4. `POST /admin/catalog-enrich-missing` `{"batchSize":50,"concurrency":3,"throttleMs":500}` → capturer `runId`
5. Poller `GET /admin/catalog-enrich-missing/status` jusqu'à `"status":"COMPLETED"`
6. `GET /admin/catalog-stats` → capturer l'état après
7. `GET /admin/catalog-enrich-missing/failures?limit=200` → capturer les failures terminales avec `errorClass`, `errorCode`, `errorMessage` réels (dont celle pour `Les Chevaliers du Fiel`)
8. `POST /admin/catalog-enrich-missing/retry-failures {"force":true}` → retenter les 126 failures connues
9. Créer `runs/T115/production-run-20260820.md` avec ce rapport et commiter sur la branche

Le playbook complet est dans `runs/T115/production-run-playbook.md`.

IMPLEMENTATION_FIX_REQUIRED