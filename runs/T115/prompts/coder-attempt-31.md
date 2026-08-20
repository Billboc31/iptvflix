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

The situation is clear. This workflow has been looping since attempt-12. The code is complete, the tests pass, and the only remaining blocker is a production run that requires your Fly.io credentials — which no AI agent can provide.

Here's the current state and exactly what breaks the loop:

---

## Situation : boucle sur attempt-30

**Code** : complet depuis attempt-12. 33 tests. Migrations 0047/0048. Aucun changement de code n'est nécessaire.

**Blocage** : la Completion Rule du ticket T115 exige un run contre la production réelle (~60k films / ~5k séries). L'artefact `production-run-20260820.md` avec des données réelles n'existe pas.

**Pourquoi ça loop** : le reviewer détecte l'absence de données production → `IMPLEMENTATION_FIX_REQUIRED` → le coder redémarre → same output → repeat.

---

## Ce que tu dois faire (toi, pas un agent)

Tu as **3 options** pour briser la boucle :

### Option A — Run contre la production (recommandé)

```bash
# 1. Récupère l'URL admin
export ADMIN_PASSWORD="<ton password admin>"
export API="https://api.iptvflix.com"

# 2. Stats avant
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats | jq . > /tmp/before.json

# 3. Lance l'enrichissement
curl -s -X POST \
  -u admin:$ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "concurrency": 3, "throttleMs": 500}' \
  $API/admin/catalog-enrich-missing | jq .

# 4. Poll jusqu'à COMPLETED
watch -n 30 'curl -s -u admin:$ADMIN_PASSWORD '$API'/admin/catalog-enrich-missing/status | jq .'

# 5. Stats après + failures
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats | jq . > /tmp/after.json
curl -s -u admin:$ADMIN_PASSWORD "$API/admin/catalog-enrich-missing/failures?limit=200" | jq . > /tmp/failures.json
```

**Colle-moi les 3 fichiers JSON** → je crée immédiatement `runs/T115/production-run-20260820.md` et commit.

### Option B — Restore DB locale

Si tu as un dump de la prod :

```bash
pg_restore -d postgres://localhost:5432/iptvflix_prod dump.pg
export DATABASE_URL="postgres://localhost:5432/iptvflix_prod"
```

Dis-moi que la DB locale est prête → je lance les commandes moi-même.

### Option C — Accepter le run local comme suffisant

Si tu considères que le run de dev du 2026-08-19 (6 films, démonstration des failure paths) suffit pour satisfaire le ticket, dis-le moi explicitement. Je mets à jour le `state.json` en `IMPLEMENTATION_APPROVED` et je commit. La review suivante le marquera comme accepté.

---

**Quelle option tu choisis ?** Si tu vas faire l'Option A maintenant, je génère aussi le template du fichier rapport pendant que tu prépares les commandes.

---

## Review

I now have a complete picture of the implementation. Let me write the review.

---

# PR Review — T115 : Complete catalog enrichment and make refresh failures resumable/observable
## Attempt 31

## Résumé

L'implémentation est **techniquement complète et correcte**. Aucun changement de code n'a eu lieu depuis la review-24. Les 33 tests passent. Le seul blocage restant est **opérationnel** : la Completion Rule du ticket exige un run contre la production réelle (~60k films / ~5k séries) qui n'a pas été effectué. Ce blocage ne peut pas être résolu par un cycle IA supplémentaire.

---

## Vérifications effectuées

| Composant | Statut |
|---|---|
| `tmdb/client.ts` — `mapMovieDetail()` : `runtime \|\| null`, `imdb_id \|\| null`, `overview?.trim() \|\| null` | ✓ |
| `tmdb/client.ts` — `mapSeriesDetail()` : `overview?.trim() \|\| null` (normalisation cohérente) | ✓ |
| `metadata-enrichment-service.ts` — `classifyError()` extrait `constructor.name`, code PG, message brut | ✓ |
| `metadata-enrichment-service.ts` — `persistFailure()` upsert sur `(media_type, media_id)`, incrément `retry_count` | ✓ |
| `metadata-enrichment-service.ts` — `clearFailure()` sur succès | ✓ |
| `metadata-enrichment-service.ts` — stages `fetch` / `map` / `db_update` / `seasons` correctement distingués | ✓ |
| `catalog-enrich-missing-service.ts` — keyset cursor `WHERE id > :lastId`, checkpoint par batch | ✓ |
| `catalog-enrich-missing-service.ts` — idempotence via recency check + `checkNoRunningConflict()` + catch `23505` | ✓ |
| `catalog-enrich-missing-service.ts` — `enrichWithRetry()` 3× avec backoff exponentiel (250/500/1000ms) | ✓ |
| `catalog-enrich-missing-service.ts` — `retryFailures()` : filter `retryable=true` par défaut, `force=true` pour tout retenter | ✓ |
| `routes/catalog-enrich-missing.ts` — validation des bornes, 202 async, 409 RUN_CONFLICT, `force` propagé | ✓ |
| `routes/catalog-stats.ts` — agrégats parallèles, `embeddingPending` via `NOT EXISTS` réel (non hardcodé) | ✓ |
| `embedding-eligibility.ts` — source unique partagée stats + backfill, JSDoc de politique | ✓ |
| Migration `0047_t115_catalog_refresh_runs_type.sql` — colonne `type` avec `DEFAULT 'REFRESH'` | ✓ |
| Migration `0048_t115_enrichment_failures.sql` — table + index unique `(media_type, media_id)` | ✓ |
| `index.ts` — routes `catalogEnrichMissingRoutes` enregistrées | ✓ (à vérifier ci-dessous) |
| Sécurité — aucun secret dans les logs, paramètres validés côté route | ✓ |

---

## Observation mineure : `mapSeriesDetail()` — imdbId hardcodé à null

`client.ts:100` — `imdbId: null` est hardcodé dans `mapSeriesDetail()` alors que TMDB expose `external_ids.imdb_id` pour les séries (accessible via append_to_response). Ce champ est actuellement absent du type `TmdbSeriesDetail`. Ce comportement préexiste au ticket T115 et n'est pas dans son scope. Non bloquant.

---

## Problème détecté — [BLOQUANT opérationnel] Completion Rule non satisfaite

Le ticket stipule explicitement (Completion Rule) :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

Et l'acceptance criterion correspondant :

> Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.

Le seul rapport d'exécution existant (`runs/T115/production-run-20260819.md`) est un run **local dev DB** avec **6 films** et une DB artificielle. Ceci n'est pas "an equivalent restored production snapshot" par rapport aux ~60k films / ~5k séries de production mentionnés dans le ticket.

**Ce blocage est purement opérationnel. L'implémentation est correcte. Aucun cycle IA supplémentaire ne peut résoudre cette situation.**

### Ce qui est requis (humain uniquement)

**Option A (recommandée)** — Run contre la production réelle :
```bash
export API="https://api.iptvflix.com"
# 1. Stats avant
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats > /tmp/before.json
# 2. Lancer l'enrichissement
curl -s -X POST -u admin:$ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "concurrency": 3, "throttleMs": 500}' \
  $API/admin/catalog-enrich-missing
# 3. Attendre COMPLETED, puis :
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats > /tmp/after.json
curl -s -u admin:$ADMIN_PASSWORD "$API/admin/catalog-enrich-missing/failures?limit=200" > /tmp/failures.json
```
Résultat : créer `runs/T115/production-run-YYYYMMDD.md` avec les données avant/après/failures.

**Option B** — Dump de la prod restauré localement (transmettre les 3 fichiers JSON au coder).

**Option C** — Déclarer explicitement que le run local (6 films, 2026-08-19) est accepté comme suffisant pour ce ticket. Dans ce cas, le reviewer peut être instruit d'approuver.

---

## Risques résiduels (mineurs, non bloquants)

- `retryFailures()` n'a pas de checkpoint intermédiaire : statut figé pendant le retry. Acceptable pour le scope T115.
- `retrying` comptabilise des tentatives, pas des items uniques. Documenté dans le code.
- `enrichPending()` charge **tous** les IDs en mémoire avant de les traiter séquentiellement (pas de pagination). Préexiste au ticket, hors scope.

---

## Décision

L'implémentation est techniquement correcte et complète. La Completion Rule explicite du ticket n'est pas satisfaite faute d'accès à la production. Après 31 tentatives, **cette boucle doit être brisée par intervention humaine**.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:50:41Z

---

I now have a complete picture of the implementation. Let me write the review.

---

# PR Review — T115 : Complete catalog enrichment and make refresh failures resumable/observable
## Attempt 31

## Résumé

L'implémentation est **techniquement complète et correcte**. Aucun changement de code n'a eu lieu depuis la review-24. Les 33 tests passent. Le seul blocage restant est **opérationnel** : la Completion Rule du ticket exige un run contre la production réelle (~60k films / ~5k séries) qui n'a pas été effectué. Ce blocage ne peut pas être résolu par un cycle IA supplémentaire.

---

## Vérifications effectuées

| Composant | Statut |
|---|---|
| `tmdb/client.ts` — `mapMovieDetail()` : `runtime \|\| null`, `imdb_id \|\| null`, `overview?.trim() \|\| null` | ✓ |
| `tmdb/client.ts` — `mapSeriesDetail()` : `overview?.trim() \|\| null` (normalisation cohérente) | ✓ |
| `metadata-enrichment-service.ts` — `classifyError()` extrait `constructor.name`, code PG, message brut | ✓ |
| `metadata-enrichment-service.ts` — `persistFailure()` upsert sur `(media_type, media_id)`, incrément `retry_count` | ✓ |
| `metadata-enrichment-service.ts` — `clearFailure()` sur succès | ✓ |
| `metadata-enrichment-service.ts` — stages `fetch` / `map` / `db_update` / `seasons` correctement distingués | ✓ |
| `catalog-enrich-missing-service.ts` — keyset cursor `WHERE id > :lastId`, checkpoint par batch | ✓ |
| `catalog-enrich-missing-service.ts` — idempotence via recency check + `checkNoRunningConflict()` + catch `23505` | ✓ |
| `catalog-enrich-missing-service.ts` — `enrichWithRetry()` 3× avec backoff exponentiel (250/500/1000ms) | ✓ |
| `catalog-enrich-missing-service.ts` — `retryFailures()` : filter `retryable=true` par défaut, `force=true` pour tout retenter | ✓ |
| `routes/catalog-enrich-missing.ts` — validation des bornes, 202 async, 409 RUN_CONFLICT, `force` propagé | ✓ |
| `routes/catalog-stats.ts` — agrégats parallèles, `embeddingPending` via `NOT EXISTS` réel (non hardcodé) | ✓ |
| `embedding-eligibility.ts` — source unique partagée stats + backfill, JSDoc de politique | ✓ |
| Migration `0047_t115_catalog_refresh_runs_type.sql` — colonne `type` avec `DEFAULT 'REFRESH'` | ✓ |
| Migration `0048_t115_enrichment_failures.sql` — table + index unique `(media_type, media_id)` | ✓ |
| `index.ts` — routes `catalogEnrichMissingRoutes` enregistrées | ✓ (à vérifier ci-dessous) |
| Sécurité — aucun secret dans les logs, paramètres validés côté route | ✓ |

---

## Observation mineure : `mapSeriesDetail()` — imdbId hardcodé à null

`client.ts:100` — `imdbId: null` est hardcodé dans `mapSeriesDetail()` alors que TMDB expose `external_ids.imdb_id` pour les séries (accessible via append_to_response). Ce champ est actuellement absent du type `TmdbSeriesDetail`. Ce comportement préexiste au ticket T115 et n'est pas dans son scope. Non bloquant.

---

## Problème détecté — [BLOQUANT opérationnel] Completion Rule non satisfaite

Le ticket stipule explicitement (Completion Rule) :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

Et l'acceptance criterion correspondant :

> Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.

Le seul rapport d'exécution existant (`runs/T115/production-run-20260819.md`) est un run **local dev DB** avec **6 films** et une DB artificielle. Ceci n'est pas "an equivalent restored production snapshot" par rapport aux ~60k films / ~5k séries de production mentionnés dans le ticket.

**Ce blocage est purement opérationnel. L'implémentation est correcte. Aucun cycle IA supplémentaire ne peut résoudre cette situation.**

### Ce qui est requis (humain uniquement)

**Option A (recommandée)** — Run contre la production réelle :
```bash
export API="https://api.iptvflix.com"
# 1. Stats avant
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats > /tmp/before.json
# 2. Lancer l'enrichissement
curl -s -X POST -u admin:$ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "concurrency": 3, "throttleMs": 500}' \
  $API/admin/catalog-enrich-missing
# 3. Attendre COMPLETED, puis :
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats > /tmp/after.json
curl -s -u admin:$ADMIN_PASSWORD "$API/admin/catalog-enrich-missing/failures?limit=200" > /tmp/failures.json
```
Résultat : créer `runs/T115/production-run-YYYYMMDD.md` avec les données avant/après/failures.

**Option B** — Dump de la prod restauré localement (transmettre les 3 fichiers JSON au coder).

**Option C** — Déclarer explicitement que le run local (6 films, 2026-08-19) est accepté comme suffisant pour ce ticket. Dans ce cas, le reviewer peut être instruit d'approuver.

---

## Risques résiduels (mineurs, non bloquants)

- `retryFailures()` n'a pas de checkpoint intermédiaire : statut figé pendant le retry. Acceptable pour le scope T115.
- `retrying` comptabilise des tentatives, pas des items uniques. Documenté dans le code.
- `enrichPending()` charge **tous** les IDs en mémoire avant de les traiter séquentiellement (pas de pagination). Préexiste au ticket, hors scope.

---

## Décision

L'implémentation est techniquement correcte et complète. La Completion Rule explicite du ticket n'est pas satisfaite faute d'accès à la production. Après 31 tentatives, **cette boucle doit être brisée par intervention humaine**.

IMPLEMENTATION_FIX_REQUIRED