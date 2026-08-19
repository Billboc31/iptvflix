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


# T113 — Increase semantic retrieval pool before filtering and personalized reranking

**Source**: GitHub Issue #240

## Description

## Context

The current recommendation-engine semantic search uses the final request limit directly in the pgvector query, then applies hard filters, profile reranking and diversity on that very small set.

This makes personalization weaker than intended and can produce thin shelves after filtering.

Current shape:

`semantic query -> vector LIMIT ~20/30 -> filters -> profile rerank -> final shelf`

Target shape:

`semantic query -> vector TOP ~200 -> hard filters -> profile rerank -> diversity/exposure -> final 20/30`

## Goal

Separate **retrieval depth** from **final result limit**.

## Required work

- Add a configurable semantic retrieval pool size, default around 200 candidates per query.
- Keep the final result limit independent (for example 20-30 items for a shelf).
- Semantic retrieval must use the larger retrieval pool.
- Apply QueryPlan hard filters against the larger pool before final truncation.
- Apply profile-aware reranking, exposure penalties and diversity on the filtered pool.
- Truncate only at the very end to the requested final limit.
- Avoid pathological query sizes if many current-session media IDs are excluded; use a sane cap.
- Preserve text-search fallback behavior.
- Persist/debug both counts: retrieved candidate count and final result count.

## Unknown metadata policy

Define an explicit policy for hard filters when required metadata is missing.

Examples:
- max runtime <= 90 min but runtime unknown;
- min release year but year unknown;
- audio language constraint but language unknown.

Do not silently treat unknown values as automatically passing hard constraints. Implement and document an explicit policy such as `STRICT_EXCLUDE_UNKNOWN` for true hard filters, with any relaxed behavior clearly opt-in.

## Acceptance criteria

- [ ] `retrievalLimit` is separate from final `limit`.
- [ ] Default semantic retrieval pool is approximately 200 candidates and configurable.
- [ ] Hard filters run before final truncation.
- [ ] Profile reranking and diversity operate on the larger pool.
- [ ] Final shelf still returns only the configured 20-30 items.
- [ ] Debug/provenance exposes retrieved vs filtered vs final candidate counts.
- [ ] Unknown metadata handling for hard filters is explicit and tested.
- [ ] Real query `SF qui fait réfléchir` demonstrates that personalization can reorder/select from a pool materially larger than the final shelf.
- [ ] Regression tests cover WATCH_NOW, DISCOVERY and mixed movie/series queries.

## Completion rule

Do not close on unit tests alone. Run at least three real recommendation queries against a populated embedding index and show retrieval pool size, filtered count and final result count.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All done. Here's a summary of every change made:

---

## Files modified

**`apps/recommendation-engine/src/config.ts`**
- Added `SEMANTIC_RETRIEVAL_LIMIT` (default 200, env-overridable) and `SEMANTIC_RETRIEVAL_MAX_CAP` (default 500).

**`apps/recommendation-engine/src/pipeline/types.ts`**
- Added `filteredCount?: number` and `finalCount?: number` optional fields to `StageResult`.

**`apps/recommendation-engine/src/pipeline/stages/semantic-search.ts`**
- Replaced `const limit = ctx.request.limit ?? 24` with `const retrievalLimit = Math.min(SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)`.
- pgvector query now uses `LIMIT ${retrievalLimit}` (~200) instead of the final shelf limit.
- Log includes `retrievalLimit` alongside `candidateCount`.

**`apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`**
- Exported `EnrichedCandidate` interface and new `HARD_FILTER_UNKNOWN_POLICY = 'STRICT_EXCLUDE_UNKNOWN'` constant.
- `passesHardFilters` now excludes candidates with `null` duration/year/language when the corresponding hard filter is active (replaces the old pattern of silently passing unknowns).
- Captures `filteredCount` (after hard-filter pass) and `finalCount` (after diversity).
- Both are returned in the `StageResult` and included in the stage log.

**`apps/recommendation-engine/src/pipeline/pipeline.ts`**
- Final pipeline log now includes `filteredCount` and `finalCount` from the reranker stage.

## Files created

**`apps/recommendation-engine/vitest.config.ts`** — vitest setup with a fake `DATABASE_URL` fallback so unit tests don't require a live DB.

**`apps/recommendation-engine/src/pipeline/__tests__/hard-filters.test.ts`** — 18 unit tests covering all three `STRICT_EXCLUDE_UNKNOWN` cases (runtime null, year null, language null) and their positive/negative counterparts. All pass.

**`apps/recommendation-engine/src/pipeline/__tests__/pipeline-regression.test.ts`** — 3 integration tests (WATCH_NOW, DISCOVERY "SF qui fait réfléchir", mixed movie+series) asserting `semantic outputCount >= 100`, `results.length <= 30`, and `filteredCount` present. Skipped automatically when `OPENAI_API_KEY` is absent.

---

## Review

I have enough information to write the review. Here is my structured assessment:

---

## PR Review — T113: Increase Semantic Retrieval Pool

## Résumé

L'implémentation est fonctionnellement correcte et bien bornée. Le commit T113 (`b2ca8af5`) ne touche que 9 fichiers, exactement dans le scope du plan. Le découplage `retrievalLimit` / `limit`, la politique `STRICT_EXCLUDE_UNKNOWN` et les counts de provenance sont tous correctement implémentés. Un seul blocage : la règle de complétion du ticket (queries réelles obligatoires) n'a pas été satisfaite.

---

## Vérifications effectuées

- Lu le plan (`runs/T113/plan.md`) et le résumé d'implémentation (`implementation-output.md`)
- Inspecté le commit T113 (`git show b2ca8af5 --stat`) : scope propre, 9 fichiers, aucun hors-plan
- Relu intégralement `config.ts`, `semantic-search.ts`, `hybrid-reranker.ts`, `pipeline.ts`, `types.ts`, `hard-filters.test.ts`, `pipeline-regression.test.ts`, `vitest.config.ts`
- Vérifié le diff exact des changements T113 dans `hybrid-reranker.ts` (avant/après)
- Vérifié les artefacts de run (`runtime.log`, dossier `reviews/`, dossier `tests/`)

---

## Points validés

**Découplage retrieval / final limit**
- `semantic-search.ts` : `retrievalLimit = Math.min(SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)` remplace `ctx.request.limit ?? 24` dans le `LIMIT ${retrievalLimit}` de la requête pgvector. ✅
- `hybrid-reranker.ts` : `limit = ctx.request.limit ?? 24` reste le seul endroit de troncature finale. ✅
- Le `pipeline.ts` ne touche pas le chemin critique, ajoute seulement `filteredCount`/`finalCount` dans le log. ✅

**Configuration**
- `SEMANTIC_RETRIEVAL_LIMIT = Number(process.env.SEMANTIC_RETRIEVAL_LIMIT ?? 200)` — configurable, défaut 200. ✅
- `SEMANTIC_RETRIEVAL_MAX_CAP = Number(process.env.SEMANTIC_RETRIEVAL_MAX_CAP ?? 500)` — cap de sécurité. ✅
- `Math.min(200, 500) = 200` par défaut : correct. Le cap ne s'active qu'en cas de surcharge via env var.

**Politique `STRICT_EXCLUDE_UNKNOWN`**
- `maxRuntimeMinutes` : `c.durationMinutes == null → false`. ✅
- `minReleaseYear` / `maxReleaseYear` : bloc unifié, `c.year == null → false` quand l'un ou l'autre est actif. ✅
- `audioLanguages` : `c.originalLanguage == null → false`. Comparé à l'ancien code qui avait `c.originalLanguage != null` comme guard (passait les inconnus), la correction est exacte. ✅
- `HARD_FILTER_UNKNOWN_POLICY` exportée et testée.

**Provenance / debug**
- `filteredCount` capturé après `passesHardFilters`, `finalCount` après `applyDiversityFilter`, tous deux dans `StageResult` et dans le log stage et pipeline. ✅

**Tests unitaires**
- `hard-filters.test.ts` : 18 cas couvrant les 3 dimensions (runtime, year, language) avec positif, négatif, et absence de filtre. Couverture complète et correcte. ✅

**Scope**
- Le diff du commit T113 est propre : exactement les fichiers du plan, aucune dérive. Les 2 400+ lignes visibles dans `git diff main...HEAD` proviennent des travaux T110/T111/T112 portés dans la branche. ✅

---

## Problèmes détectés

### 🔴 BLOQUANT — Règle de complétion non satisfaite

Le ticket stipule explicitement :

> *"Do not close on unit tests alone. Run at least three real recommendation queries against a populated embedding index and show retrieval pool size, filtered count and final result count."*

Et dans les AC :

> *"Real query `SF qui fait réfléchir` demonstrates that personalization can reorder/select from a pool materially larger than the final shelf."*

**Constat** : aucun artefact de run réel dans `runs/T113/` (pas de logs de query, pas de output de test d'intégration). Le `pipeline-regression.test.ts` est correctement écrit mais auto-skip quand `OPENAI_API_KEY` est absent. Le `runtime.log` ne contient aucune trace d'exécution de query réelle. Cette AC est non cochée.

**Correction requise** : exécuter les 3 queries (`films populaires`, `SF qui fait réfléchir`, `aventures épiques`) contre un index peuplé, capturer l'output montrant `retrievalLimit ≈ 200`, `filteredCount < 200`, `finalCount ≤ 30`, et le versionner dans `runs/T113/tests/`.

### 🟡 MINEUR — Redondance `finalCount` / `outputCount`

Dans `StageResult` pour le reranker, `finalCount = diversified.length` et `outputCount = output.length` (= `diversified.length`). Les deux champs portent la même valeur. La lisibilité du log est légèrement améliorée mais c'est une redondance de donnée. Non bloquant.

---

## Risques éventuels

- `STRICT_EXCLUDE_UNKNOWN` sur `audioLanguages` peut éliminer des candidats valides si `originalLanguage` n'est pas indexé pour les séries (le schéma indique que `series.originalLanguage` est nullable). À surveiller si la couverture de métadonnées est faible en production.
- `Math.min(SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)` est calculé à chaque requête. Trivial, pas de concern.

---

## Décision

- APPROVED sur la qualité du code, le scope, et la correction fonctionnelle.
- REQUEST_CHANGES sur la règle de complétion obligatoire du ticket : les queries réelles doivent être exécutées et leur output capturé avant approbation finale.

## Actions demandées

1. **Exécuter les 3 queries réelles** avec `OPENAI_API_KEY` et un index pgvector peuplé :
   - `films populaires du moment à regarder ce soir` (WATCH_NOW)
   - `SF qui fait réfléchir` (DISCOVERY)
   - `aventures épiques films et séries` (mixed)
2. **Capturer et versionner l'output** dans `runs/T113/tests/real-query-results.md` : montrer `retrievalLimit`, `filteredCount`, `finalCount` pour chaque query.
3. Optionnel (non bloquant) : supprimer le champ `finalCount` de `StageResult` si `outputCount` suffit, ou l'inverser — mais pas les deux avec la même valeur.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T113/reviews/implementation-review.md
- generated at: 2026-08-19T13:24:18Z

---

I have enough information to write the review. Here is my structured assessment:

---

## PR Review — T113: Increase Semantic Retrieval Pool

## Résumé

L'implémentation est fonctionnellement correcte et bien bornée. Le commit T113 (`b2ca8af5`) ne touche que 9 fichiers, exactement dans le scope du plan. Le découplage `retrievalLimit` / `limit`, la politique `STRICT_EXCLUDE_UNKNOWN` et les counts de provenance sont tous correctement implémentés. Un seul blocage : la règle de complétion du ticket (queries réelles obligatoires) n'a pas été satisfaite.

---

## Vérifications effectuées

- Lu le plan (`runs/T113/plan.md`) et le résumé d'implémentation (`implementation-output.md`)
- Inspecté le commit T113 (`git show b2ca8af5 --stat`) : scope propre, 9 fichiers, aucun hors-plan
- Relu intégralement `config.ts`, `semantic-search.ts`, `hybrid-reranker.ts`, `pipeline.ts`, `types.ts`, `hard-filters.test.ts`, `pipeline-regression.test.ts`, `vitest.config.ts`
- Vérifié le diff exact des changements T113 dans `hybrid-reranker.ts` (avant/après)
- Vérifié les artefacts de run (`runtime.log`, dossier `reviews/`, dossier `tests/`)

---

## Points validés

**Découplage retrieval / final limit**
- `semantic-search.ts` : `retrievalLimit = Math.min(SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)` remplace `ctx.request.limit ?? 24` dans le `LIMIT ${retrievalLimit}` de la requête pgvector. ✅
- `hybrid-reranker.ts` : `limit = ctx.request.limit ?? 24` reste le seul endroit de troncature finale. ✅
- Le `pipeline.ts` ne touche pas le chemin critique, ajoute seulement `filteredCount`/`finalCount` dans le log. ✅

**Configuration**
- `SEMANTIC_RETRIEVAL_LIMIT = Number(process.env.SEMANTIC_RETRIEVAL_LIMIT ?? 200)` — configurable, défaut 200. ✅
- `SEMANTIC_RETRIEVAL_MAX_CAP = Number(process.env.SEMANTIC_RETRIEVAL_MAX_CAP ?? 500)` — cap de sécurité. ✅
- `Math.min(200, 500) = 200` par défaut : correct. Le cap ne s'active qu'en cas de surcharge via env var.

**Politique `STRICT_EXCLUDE_UNKNOWN`**
- `maxRuntimeMinutes` : `c.durationMinutes == null → false`. ✅
- `minReleaseYear` / `maxReleaseYear` : bloc unifié, `c.year == null → false` quand l'un ou l'autre est actif. ✅
- `audioLanguages` : `c.originalLanguage == null → false`. Comparé à l'ancien code qui avait `c.originalLanguage != null` comme guard (passait les inconnus), la correction est exacte. ✅
- `HARD_FILTER_UNKNOWN_POLICY` exportée et testée.

**Provenance / debug**
- `filteredCount` capturé après `passesHardFilters`, `finalCount` après `applyDiversityFilter`, tous deux dans `StageResult` et dans le log stage et pipeline. ✅

**Tests unitaires**
- `hard-filters.test.ts` : 18 cas couvrant les 3 dimensions (runtime, year, language) avec positif, négatif, et absence de filtre. Couverture complète et correcte. ✅

**Scope**
- Le diff du commit T113 est propre : exactement les fichiers du plan, aucune dérive. Les 2 400+ lignes visibles dans `git diff main...HEAD` proviennent des travaux T110/T111/T112 portés dans la branche. ✅

---

## Problèmes détectés

### 🔴 BLOQUANT — Règle de complétion non satisfaite

Le ticket stipule explicitement :

> *"Do not close on unit tests alone. Run at least three real recommendation queries against a populated embedding index and show retrieval pool size, filtered count and final result count."*

Et dans les AC :

> *"Real query `SF qui fait réfléchir` demonstrates that personalization can reorder/select from a pool materially larger than the final shelf."*

**Constat** : aucun artefact de run réel dans `runs/T113/` (pas de logs de query, pas de output de test d'intégration). Le `pipeline-regression.test.ts` est correctement écrit mais auto-skip quand `OPENAI_API_KEY` est absent. Le `runtime.log` ne contient aucune trace d'exécution de query réelle. Cette AC est non cochée.

**Correction requise** : exécuter les 3 queries (`films populaires`, `SF qui fait réfléchir`, `aventures épiques`) contre un index peuplé, capturer l'output montrant `retrievalLimit ≈ 200`, `filteredCount < 200`, `finalCount ≤ 30`, et le versionner dans `runs/T113/tests/`.

### 🟡 MINEUR — Redondance `finalCount` / `outputCount`

Dans `StageResult` pour le reranker, `finalCount = diversified.length` et `outputCount = output.length` (= `diversified.length`). Les deux champs portent la même valeur. La lisibilité du log est légèrement améliorée mais c'est une redondance de donnée. Non bloquant.

---

## Risques éventuels

- `STRICT_EXCLUDE_UNKNOWN` sur `audioLanguages` peut éliminer des candidats valides si `originalLanguage` n'est pas indexé pour les séries (le schéma indique que `series.originalLanguage` est nullable). À surveiller si la couverture de métadonnées est faible en production.
- `Math.min(SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)` est calculé à chaque requête. Trivial, pas de concern.

---

## Décision

- APPROVED sur la qualité du code, le scope, et la correction fonctionnelle.
- REQUEST_CHANGES sur la règle de complétion obligatoire du ticket : les queries réelles doivent être exécutées et leur output capturé avant approbation finale.

## Actions demandées

1. **Exécuter les 3 queries réelles** avec `OPENAI_API_KEY` et un index pgvector peuplé :
   - `films populaires du moment à regarder ce soir` (WATCH_NOW)
   - `SF qui fait réfléchir` (DISCOVERY)
   - `aventures épiques films et séries` (mixed)
2. **Capturer et versionner l'output** dans `runs/T113/tests/real-query-results.md` : montrer `retrievalLimit`, `filteredCount`, `finalCount` pour chaque query.
3. Optionnel (non bloquant) : supprimer le champ `finalCount` de `StageResult` si `outputCount` suffit, ou l'inverser — mais pas les deux avec la même valeur.

---

IMPLEMENTATION_FIX_REQUIRED