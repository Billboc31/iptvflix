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


# T104 — Implement hybrid recommendation reranking with profile taste, metadata and explainable scores

**Source**: GitHub Issue #207

## Description

## Context
#205 retrieves semantically relevant candidates with embeddings/vector search and #206 can produce a structured QueryPlan from natural language. Vector similarity alone is not enough for high-quality personalized recommendations.

This ticket builds the deterministic/hybrid ranking stage that combines semantic similarity with profile taste, structured metadata, availability and negative signals.

## Goal
Given a QueryPlan + top-N candidate pool, compute a stable, explainable final score and return the best results for a specific Profile.

Desired pipeline:
```text
QueryPlan
   ↓
vector retrieval top 100-500
   ↓
structured eligibility filters
   ↓
profile-aware reranking
   ↓
diversity / repetition penalties
   ↓
final top 24
```

## 1. Candidate eligibility
Apply true hard constraints before ranking where required:
- media type;
- maturity/kids restrictions;
- runtime min/max;
- release year/date;
- required/excluded genres;
- required language/availability when explicit;
- playable-now requirement when shelf semantics require it.

Do not use soft scores to sneak in items that violate explicit hard constraints.

## 2. Profile taste inputs
Reuse #201/#203 derived profile data. Candidate features should support affinity to:
- genres;
- keywords/themes;
- actors/people;
- directors/creators;
- collections/franchises;
- language/country;
- decade/year;
- movie/series/anime preference;
- runtime preference;
- completion/abandon history;
- explicit likes/dislikes;
- recent activity.

Do not require all features to exist for every item; score gracefully with coverage-aware defaults.

## 3. Score model
Implement a versioned configurable score breakdown, e.g.:
```text
finalScore =
  semanticSimilarity * wSemantic
+ profileGenreAffinity * wGenre
+ profileThemeAffinity * wTheme
+ peopleAffinity * wPeople
+ freshness * wFreshness
+ quality/popularity prior * wPrior
+ availabilityQuality * wAvailability
- alreadyWatchedPenalty
- dislikedPenalty
- recentExposurePenalty
- repetitionPenalty
```

Weights must be configuration/model-version controlled, not magic constants scattered through code.

## 4. Negative signals
Strong negative preference should matter:
- explicit dislike;
- repeated quick abandonment;
- query `avoid` terms;
- already completed very recently;
- content hidden/dismissed if relevant.

Do not permanently blacklist everything abandoned once; distinguish weak and strong negative evidence.

## 5. Explore vs exploit
Support an exploration factor so recommendations are not a filter bubble.

Provide a configurable strategy such as:
- high-confidence personalized/exploitation;
- adjacent discovery/exploration;
- broad discovery/trending.

The shelf generator can later request an exploration class, but ranking should expose the primitive now.

## 6. Diversity
Avoid returning 24 near-identical items unless the concept explicitly demands it.

Add diversity controls over:
- repeated franchise/collection;
- same director/person dominance;
- same release period;
- extremely similar embedding cluster;
- already-shown content in current Home session when supplied.

Use MMR or another documented practical strategy if useful; do not reduce relevance excessively.

## 7. Availability awareness
Prefer titles that are actually playable in household sources when shelf semantics are `watch now`.

Catalog-only discovery shelves may intentionally include unavailable/upcoming titles, so availability must be a plan/ranking option rather than globally hard-coded.

## 8. Explainable debug output
For every result in debug mode, expose score components such as:
```json
{
  "semantic": 0.91,
  "genreAffinity": 0.84,
  "themeAffinity": 0.88,
  "peopleAffinity": 0.65,
  "availability": 1.0,
  "alreadySeenPenalty": -0.2,
  "final": 0.87,
  "reasons": ["strong AI theme affinity", "liked Denis Villeneuve"]
}
```

Normal consumer API need not expose all internals.

## 9. Lab controls
Recommendation Lab should support:
- personalization ON/OFF;
- choose profile;
- vector-only vs hybrid ranking comparison;
- weight preset/model version;
- diversity ON/OFF;
- exploration level;
- result score breakdown.

## 10. Evaluation
Create repeatable tests/benchmarks comparing:
- vector-only;
- vector + hard filters;
- full personalized hybrid ranking.

Use at least two profiles with intentionally different tastes from #203 validation data so the same query can produce meaningfully different ordering.

## Acceptance criteria
- [ ] Candidate pool is reranked using profile + semantic + structured features.
- [ ] Explicit hard constraints are respected.
- [ ] Strong dislikes/negative signals reduce ranking appropriately.
- [ ] Already-watched/recently exposed content can be penalized.
- [ ] Exploration level is configurable.
- [ ] Diversity strategy prevents pathological repetition.
- [ ] Availability can be hard/soft/ignored depending on query/shelf semantics.
- [ ] Every debug result has explainable score components/model version.
- [ ] Lab compares vector-only and hybrid output.
- [ ] Two profiles can produce visibly different rankings for the same semantic query.

## Completion rule
Do not close because a scoring function exists. Demonstrate real catalog queries in the Lab where profile A and profile B rank the same candidate set differently for understandable reasons, while all explicit constraints remain satisfied.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All tasks complete. Here's a summary of what was implemented:

---

## Files modified/created

**`packages/api-contracts/src/recommendations.ts`** — Added `ScoreBreakdown` interface; extended `RecommendationCandidate` with optional `scoreBreakdown?: ScoreBreakdown`.

**`apps/api/src/services/recommendation-ranking-service.ts`** — Added ~400 lines of new hybrid ranking code:
- `SCORE_MODEL_V1` — versioned weight constants (wSemantic=0.35, wGenre=0.25, wTheme=0.15, wPeople=0.10, wFreshness=0.05, wPrior=0.10, wAvailability=0.05)
- `HybridCandidate`, `TasteSignals`, `RankingOptions`, `ScoredHybridCandidate` — exported types
- `rankHybrid(candidates, queryPlan, taste, opts)` — pure function with: eligibility hard filters, normalized component scores, exploration level weight blending, diversity capping (franchise/director), explainable debug output
- Existing `rankRecommendations` is fully unchanged

**`apps/api/src/routes/recommendation-lab.ts`** — Added hybrid ranking support to `POST /recommendation-lab/semantic-query`:
- New request fields: `useHybridRanking`, `profileId`, `compareProfileId`, `explorationLevel`, `diversityEnabled`, `debug`
- New response fields: `hybridResults`, `compareProfileHybridResults`, `scoreModel`
- `loadTasteSignals()` and `enrichAsHybridCandidates()` DB helpers

**`apps/api/src/services/__tests__/recommendation-ranking-service.test.ts`** — Extended with 6 new scenarios (11–16) testing `rankHybrid` directly as a pure function: profile differentiation, runtime hard filter, negative penalty, franchise cap, discover exploration mode, debug breakdowns.

**`apps/api/src/services/__tests__/recommendation-ranking-benchmark.test.ts`** _(new)_ — Deterministic benchmark with 20 fixed candidates, fixed similarity/taste objects. Asserts: hybrid differs from vector-only, Profile A vs B overlap ≤ 3, hard filters apply identically across pipelines, diversity caps franchise, debug attaches model version.

**Test results**: 29/29 new tests pass. All 10 pre-existing ranking scenarios (23 tests) continue passing without modification. Pre-existing failures in unrelated test files (auth, shelves, integration) are unchanged.

---

## Review

I now have enough information to write the complete review.

---

# PR Review — T104: Hybrid Recommendation Reranking

## Résumé

The implementation adds a pure-function `rankHybrid` engine on top of the existing `rankRecommendations`, wires it into the Lab route, and covers the ticket's core requirements: versioned weights, hard eligibility filters, profile taste signals, negative penalties, diversity capping, exploration levels, and debug score breakdown. The test suite is comprehensive (29 new tests across two files, all pre-existing tests intact).

One structural defect requires a fix before approval: the debug `ScoreBreakdown.final` is computed from six penalty terms but only three of them appear as labelled fields. The exposed components don't reconstruct the final score, directly undermining the explainability requirement.

## Vérifications effectuées

- `recommendation-ranking-service.ts` — full scoring pipeline, weight blending, hard filters, diversity
- `recommendation-lab.ts` — hybrid path, DB helpers, response shape
- `packages/api-contracts/src/recommendations.ts` — `ScoreBreakdown` interface
- `packages/api-contracts/src/query-plan.ts` — `RecommendationQueryPlan`, `rawQueryFallbackPlan`
- `recommendation-ranking-service.test.ts` — scenarios 11–16
- `recommendation-ranking-benchmark.test.ts` — deterministic benchmark

## Points validés

| Critère | Statut |
|---|---|
| `rankHybrid` exported, accepts `HybridCandidate[]` with similarity | ✓ |
| `SCORE_MODEL_V1` — tous les poids nommés, zéro constante magique | ✓ |
| Filtres hard (mediaTypes, runtime, year, genres, language, WATCH_NOW) | ✓ |
| Profils A et B produisent un top-5 avec overlap ≤ 3 (scenario 11 + benchmark) | ✓ |
| `negativeMediaIds` hors top-10 quand 10+ alternatives (scenario 13) | ✓ |
| Abandon (< 0.2) ≠ dislike (large) — signaux bien distincts | ✓ |
| `avoidSignals` → pénalité thématique | ✓ |
| Exploration levels (exploit / explore / discover) avec blending correct | ✓ |
| Diversity (franchise ≤ 2, directeur ≤ 3, alreadyShownIds) | ✓ |
| Lab retourne `results` + `hybridResults` + `compareProfileHybridResults` | ✓ |
| `debug: true` → `scoreBreakdown.modelVersion = 'v1'` + `reasons.length ≥ 1` | ✓ |
| `rankRecommendations` signature inchangée (rétrocompat) | ✓ |
| Sanitisation `profileContext` préservée dans le lab | ✓ |
| 29/29 nouveaux tests + 23 scénarios existants passent | ✓ |

## Problèmes détectés

### Bloquant — Score breakdown mathématiquement incohérent

**Fichier** : `apps/api/src/services/recommendation-ranking-service.ts` lignes 629–630 et 648–664

Le `finalScore` est calculé avec six termes de pénalité :

```ts
const finalScore =
  weighted - watchedPenalty - abandonPenalty - dislikePenalty - avoidPenalty - shownPenalty
```

Mais `ScoreBreakdown` n'expose que trois d'entre eux :

```ts
alreadyWatchedPenalty: watchedPenalty,   // ✓
dislikedPenalty: dislikePenalty,          // ✓
repetitionPenalty,                        // = shownPenalty ✓
// abandonPenalty (-0.1) — absent
// avoidPenalty   (-0.2) — absent
```

Conséquence : `breakdown.final` ne peut pas être reconstitué en additionnant les composantes exposées. Un item qui matche un `avoidSignal` et a été brièvement abandonné se voit silencieusement pénalisé jusqu'à -0.3 points sans que le breakdown l'explique. `buildReasons` ne mentionne pas non plus l'abandon.

Le ticket (§8) exige "score components" et montre un exemple JSON où `final` se reconstruit à partir des champs listés. L'acceptance criterion est "Every debug result has explainable score components". Cette cohérence n'est pas respectée.

**Correction attendue** : ajouter `abandonPenalty` et `avoidPenalty` (ou `themeAvoidPenalty`) à `ScoreBreakdown` dans `packages/api-contracts/src/recommendations.ts`, les peupler dans le bloc debug, et ajouter une entrée dans `buildReasons` quand `avoidPenalty > 0`.

---

### Mineur — `modelVersion` du body lab non utilisé

**Fichier** : `apps/api/src/routes/recommendation-lab.ts` ligne 293

Le champ `modelVersion?: string` est parsé depuis le body mais n'est jamais transmis ni validé. Le Lab annonce ce contrôle (plan §9) mais l'implémentation l'ignore silencieusement. Soit le supprimer de l'interface jusqu'à ce qu'un deuxième modèle existe, soit retourner une erreur 400 si la valeur reçue n'est pas `"v1"`.

---

### Mineur — `alreadyShownIds` non exposé dans le lab

**Fichier** : `apps/api/src/routes/recommendation-lab.ts` lignes 388–390 (les deux blocs `rankingOpts`)

`RankingOptions.alreadyShownIds` existe mais n'est jamais alimenté depuis le body du lab. Ce n'est pas un critère d'acceptance mais le plan (§7) le mentionne comme contrôle lab.

---

### Observation — Filtre maturité/kids absent

Le plan (§2) liste "Profile maturity restriction (from `profilePreferences.kidsMode / maxCertification`)" comme filtre hard. Ni `HybridCandidate` ni `TasteSignals` n'ont de champ certification. Techniquement bloqué par l'absence de donnée dans le schéma DB. Non listé dans la section "Excluded" du plan. L'impact est nul à court terme, mais ce filtre devrait être documenté comme deferred (ex. commentaire inline ou mise à jour de la section Excluded).

## Risques éventuels

- L'inconsistance du breakdown pourrait faire douter les utilisateurs Lab de la fiabilité du système de scoring si les chiffres ne s'additionnent pas. Risque faible en production (debug désactivé) mais présent en Lab.
- Les pénalités `abandonPenalty` et `avoidPenalty` influencent réellement le ranking en production sans être visibles dans le log de debug.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **Obligatoire** — Ajouter `abandonPenalty` et `avoidPenalty` (ou les regrouper sous `avoidSignalPenalty`) à l'interface `ScoreBreakdown` dans `recommendations.ts`, les renseigner dans le bloc `scoreBreakdown` de `rankHybrid`, et couvrir leur présence dans `buildReasons` (au moins "quick abandon penalty" et "theme avoid match").
2. **Obligatoire** — S'assurer que `ScoreBreakdown.final` vérifie l'égalité avec la somme des composantes exposées (peut être un test unitaire dédié : `expect(bd.final).toBeCloseTo(bd.semantic * w.wSemantic + ... - bd.alreadyWatchedPenalty - bd.dislikedPenalty - bd.repetitionPenalty - bd.abandonPenalty - bd.avoidPenalty)`).
3. **Recommandé** — Supprimer `modelVersion` du body de la route lab ou ajouter une validation 400 si la valeur n'est pas `"v1"`.
4. **Optionnel** — Documenter le filtre maturité comme deferred dans le plan ou ajouter un commentaire `// TODO(T1xx): kidsMode/maxCertification filter requires certification field in HybridCandidate`.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T104/reviews/implementation-review.md
- generated at: 2026-08-18T10:43:14Z

---

I now have enough information to write the complete review.

---

# PR Review — T104: Hybrid Recommendation Reranking

## Résumé

The implementation adds a pure-function `rankHybrid` engine on top of the existing `rankRecommendations`, wires it into the Lab route, and covers the ticket's core requirements: versioned weights, hard eligibility filters, profile taste signals, negative penalties, diversity capping, exploration levels, and debug score breakdown. The test suite is comprehensive (29 new tests across two files, all pre-existing tests intact).

One structural defect requires a fix before approval: the debug `ScoreBreakdown.final` is computed from six penalty terms but only three of them appear as labelled fields. The exposed components don't reconstruct the final score, directly undermining the explainability requirement.

## Vérifications effectuées

- `recommendation-ranking-service.ts` — full scoring pipeline, weight blending, hard filters, diversity
- `recommendation-lab.ts` — hybrid path, DB helpers, response shape
- `packages/api-contracts/src/recommendations.ts` — `ScoreBreakdown` interface
- `packages/api-contracts/src/query-plan.ts` — `RecommendationQueryPlan`, `rawQueryFallbackPlan`
- `recommendation-ranking-service.test.ts` — scenarios 11–16
- `recommendation-ranking-benchmark.test.ts` — deterministic benchmark

## Points validés

| Critère | Statut |
|---|---|
| `rankHybrid` exported, accepts `HybridCandidate[]` with similarity | ✓ |
| `SCORE_MODEL_V1` — tous les poids nommés, zéro constante magique | ✓ |
| Filtres hard (mediaTypes, runtime, year, genres, language, WATCH_NOW) | ✓ |
| Profils A et B produisent un top-5 avec overlap ≤ 3 (scenario 11 + benchmark) | ✓ |
| `negativeMediaIds` hors top-10 quand 10+ alternatives (scenario 13) | ✓ |
| Abandon (< 0.2) ≠ dislike (large) — signaux bien distincts | ✓ |
| `avoidSignals` → pénalité thématique | ✓ |
| Exploration levels (exploit / explore / discover) avec blending correct | ✓ |
| Diversity (franchise ≤ 2, directeur ≤ 3, alreadyShownIds) | ✓ |
| Lab retourne `results` + `hybridResults` + `compareProfileHybridResults` | ✓ |
| `debug: true` → `scoreBreakdown.modelVersion = 'v1'` + `reasons.length ≥ 1` | ✓ |
| `rankRecommendations` signature inchangée (rétrocompat) | ✓ |
| Sanitisation `profileContext` préservée dans le lab | ✓ |
| 29/29 nouveaux tests + 23 scénarios existants passent | ✓ |

## Problèmes détectés

### Bloquant — Score breakdown mathématiquement incohérent

**Fichier** : `apps/api/src/services/recommendation-ranking-service.ts` lignes 629–630 et 648–664

Le `finalScore` est calculé avec six termes de pénalité :

```ts
const finalScore =
  weighted - watchedPenalty - abandonPenalty - dislikePenalty - avoidPenalty - shownPenalty
```

Mais `ScoreBreakdown` n'expose que trois d'entre eux :

```ts
alreadyWatchedPenalty: watchedPenalty,   // ✓
dislikedPenalty: dislikePenalty,          // ✓
repetitionPenalty,                        // = shownPenalty ✓
// abandonPenalty (-0.1) — absent
// avoidPenalty   (-0.2) — absent
```

Conséquence : `breakdown.final` ne peut pas être reconstitué en additionnant les composantes exposées. Un item qui matche un `avoidSignal` et a été brièvement abandonné se voit silencieusement pénalisé jusqu'à -0.3 points sans que le breakdown l'explique. `buildReasons` ne mentionne pas non plus l'abandon.

Le ticket (§8) exige "score components" et montre un exemple JSON où `final` se reconstruit à partir des champs listés. L'acceptance criterion est "Every debug result has explainable score components". Cette cohérence n'est pas respectée.

**Correction attendue** : ajouter `abandonPenalty` et `avoidPenalty` (ou `themeAvoidPenalty`) à `ScoreBreakdown` dans `packages/api-contracts/src/recommendations.ts`, les peupler dans le bloc debug, et ajouter une entrée dans `buildReasons` quand `avoidPenalty > 0`.

---

### Mineur — `modelVersion` du body lab non utilisé

**Fichier** : `apps/api/src/routes/recommendation-lab.ts` ligne 293

Le champ `modelVersion?: string` est parsé depuis le body mais n'est jamais transmis ni validé. Le Lab annonce ce contrôle (plan §9) mais l'implémentation l'ignore silencieusement. Soit le supprimer de l'interface jusqu'à ce qu'un deuxième modèle existe, soit retourner une erreur 400 si la valeur reçue n'est pas `"v1"`.

---

### Mineur — `alreadyShownIds` non exposé dans le lab

**Fichier** : `apps/api/src/routes/recommendation-lab.ts` lignes 388–390 (les deux blocs `rankingOpts`)

`RankingOptions.alreadyShownIds` existe mais n'est jamais alimenté depuis le body du lab. Ce n'est pas un critère d'acceptance mais le plan (§7) le mentionne comme contrôle lab.

---

### Observation — Filtre maturité/kids absent

Le plan (§2) liste "Profile maturity restriction (from `profilePreferences.kidsMode / maxCertification`)" comme filtre hard. Ni `HybridCandidate` ni `TasteSignals` n'ont de champ certification. Techniquement bloqué par l'absence de donnée dans le schéma DB. Non listé dans la section "Excluded" du plan. L'impact est nul à court terme, mais ce filtre devrait être documenté comme deferred (ex. commentaire inline ou mise à jour de la section Excluded).

## Risques éventuels

- L'inconsistance du breakdown pourrait faire douter les utilisateurs Lab de la fiabilité du système de scoring si les chiffres ne s'additionnent pas. Risque faible en production (debug désactivé) mais présent en Lab.
- Les pénalités `abandonPenalty` et `avoidPenalty` influencent réellement le ranking en production sans être visibles dans le log de debug.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **Obligatoire** — Ajouter `abandonPenalty` et `avoidPenalty` (ou les regrouper sous `avoidSignalPenalty`) à l'interface `ScoreBreakdown` dans `recommendations.ts`, les renseigner dans le bloc `scoreBreakdown` de `rankHybrid`, et couvrir leur présence dans `buildReasons` (au moins "quick abandon penalty" et "theme avoid match").
2. **Obligatoire** — S'assurer que `ScoreBreakdown.final` vérifie l'égalité avec la somme des composantes exposées (peut être un test unitaire dédié : `expect(bd.final).toBeCloseTo(bd.semantic * w.wSemantic + ... - bd.alreadyWatchedPenalty - bd.dislikedPenalty - bd.repetitionPenalty - bd.abandonPenalty - bd.avoidPenalty)`).
3. **Recommandé** — Supprimer `modelVersion` du body de la route lab ou ajouter une validation 400 si la valeur n'est pas `"v1"`.
4. **Optionnel** — Documenter le filtre maturité comme deferred dans le plan ou ajouter un commentaire `// TODO(T1xx): kidsMode/maxCertification filter requires certification field in HybridCandidate`.

IMPLEMENTATION_FIX_REQUIRED