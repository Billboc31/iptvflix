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

Both ranking test files pass:
- `recommendation-ranking-service.test.ts` — 23 tests ✓
- `recommendation-ranking-benchmark.test.ts` — **7 tests** ✓ (was 6, now 7 with the new math consistency test)

All pre-existing failures are in unrelated test files (auth, shelves, integration, title-matching) — unchanged from before.

Here's a summary of all changes made:

**`packages/api-contracts/src/recommendations.ts`**
- Added `abandonPenalty: number` and `avoidPenalty: number` to `ScoreBreakdown` interface.

**`apps/api/src/services/recommendation-ranking-service.ts`**
- Added `abandonPenalty` and `avoidPenalty` to the `buildReasons` component parameter.
- Added `"quick abandon penalty"` and `"theme avoid match"` reason strings when those penalties are non-zero.
- Populated `abandonPenalty` and `avoidPenalty` in the debug `scoreBreakdown` object so `final` is now fully reconstructible from the exposed fields.

**`apps/api/src/services/__tests__/recommendation-ranking-benchmark.test.ts`**
- Imported `SCORE_MODEL_V1`.
- Added `"scoreBreakdown.final is mathematically reconstructible from its component fields"` test that verifies `bd.final ≈ weighted_sum - all_penalties` for every result in a debug run.

**`apps/api/src/routes/recommendation-lab.ts`**
- Removed unused `modelVersion?: string` from the body parser (silent no-op removed).
- Added `alreadyShownIds?: string[]` body field with string-array sanitisation, wired into both `rankingOpts` blocks.

---

## Review

I have a thorough picture of the implementation. Writing the review now.

---

# PR Review — T104 Hybrid Recommendation Reranking

## Résumé

L'architecture pure-function du scoring hybride est solide : `SCORE_MODEL_V1` versionné, filtres hard appliqués avant le scoring, signaux négatifs différenciés, exploration levels documentés, debug breakdown complet. Les tests unitaires et le benchmark sont bien écrits.

Cependant, la fonction `enrichAsHybridCandidates` — chemin de production dans la route Lab — retourne `null`/`[]` pour la majorité des champs enrichis (`collectionId`, `directors`, `keywords`, `durationMinutes`, `originalLanguage`, `completionRatio`). Cela rend structurellement non-fonctionnels en production plusieurs critères d'acceptance : les hard filters runtime/langue, la people affinity, la theme affinity par keywords, le capping diversity collection/director, et les pénalités watched/abandonné.

Les tests passent uniquement parce qu'ils utilisent des fixtures manuellement construites avec tous les champs renseignés.

---

## Vérifications effectuées

- Lecture complète de `recommendation-ranking-service.ts` (690 lignes)
- Lecture complète de `recommendation-lab.ts` (494 lignes) avec focus sur `enrichAsHybridCandidates`
- Lecture des contrats `recommendations.ts` et `query-plan.ts`
- Lecture du benchmark (`recommendation-ranking-benchmark.test.ts`) et des tests unitaires (`recommendation-ranking-service.test.ts`)
- Vérification de la correspondance formules score / `ScoreBreakdown`
- Vérification des acceptance criteria du ticket

---

## Points validés

**Score model et pondération**
- `SCORE_MODEL_V1` est une constante versionnée, aucun magic number dispersé dans le code. ✓
- Le calcul final est cohérent avec le breakdown : la formule est vérifiée mathématiquement par le test de reconstruction (`scoreBreakdown.final` reconstructible depuis les composants). ✓

**Filtres hard**
- `passesHardFilters()` s'exécute avant le scoring. Aucun soft-score ne peut faire passer un item qui viole une contrainte explicite. ✓
- Les filtres couvrent : media type, runtime, release year, includeGenres/excludeGenres, audioLanguages, WATCH_NOW. ✓

**Signaux négatifs**
- Dislike (−1.5), abandon (−0.1), avoid keyword (−0.2), répétition/shown (−0.15) sont des pénalités distinctes — ne confond pas "vu une fois" avec "détesté". ✓
- `negativeMediaIds` n'est pas un blacklist hard : la pénalité est soustractive, un item très sémantiquement pertinent peut encore apparaître. Comportement cohérent avec le ticket ("Do not permanently blacklist"). ✓

**Exploration levels**
- exploit / explore / discover produisent des poids cohérents avec leurs intentions. ✓
- Le test scenario 15 vérifie que discover promeut un item haute qualité sur un item taste-aligned obscur. ✓

**Diversity**
- `applyDiversityFilter` implémente une stratégie MMR-like (pass first, defer rest, fill from deferred). ✓
- `maxPerCollection` et `maxPerDirector` sont configurables en options. ✓

**Explainability**
- `ScoreBreakdown` couvre tous les composants requis par le ticket (section 8), y compris `reasons[]`. ✓
- Debug breakdown généré uniquement quand `debug=true` — pas de coût en production. ✓

**Lab controls**
- `useHybridRanking`, `profileId`, `compareProfileId`, `explorationLevel`, `diversityEnabled`, `alreadyShownIds`, `debug`. ✓
- La comparaison deux profils est fonctionnelle. ✓

**Différenciation deux profils**
- La genre affinity est enrichie et fonctionne — Profile A sci-fi vs Profile B romance produisent des orderings distincts sur un même pool. ✓
- Tests scenario 11 et benchmark "top-5 overlap ≤ 3" valident le comportement. ✓

**Qualité code**
- Fonction pure sans DB access pour `rankHybrid`. ✓
- Nommage explicite, fonctions courtes et focalisées. ✓
- Sanitisation prompt-injection sur `profileContext` dans la route Lab. ✓

---

## Problèmes détectés

### [BLOQUANT] `enrichAsHybridCandidates` ne fetch pas les données nécessaires aux features clés

**Fichier** : `apps/api/src/routes/recommendation-lab.ts`, lignes 151-252

La fonction retourne des `HybridCandidate` avec les champs suivants systématiquement à leur valeur nulle/vide :

```typescript
collectionId: null,    // diversity collection capping → ne s'applique jamais
directors: [],         // people affinity → toujours 0.5 par défaut
keywords: [],          // theme affinity par keywords → toujours 0.5 par défaut
durationMinutes: null, // maxRuntimeMinutes hard filter → jamais déclenché
originalLanguage: null,// audioLanguages hard filter → jamais déclenché
completionRatio: null, // watched/abandoned penalty → jamais déclenché
popularity: null,      // qualityPrior → fallback 0.3 au lieu de valeur réelle
voteAverage: null,     // qualityPrior → fallback 0.5 au lieu de valeur réelle
```

**Impact sur les acceptance criteria :**

| Critère ticket | Statut |
|---|---|
| Hard constraints respectées (runtime, langue) | ✗ — `durationMinutes`/`originalLanguage` toujours null, filtres contournés silencieusement |
| Already-watched/recently exposed penalized | ✗ — `completionRatio` toujours null |
| Diversity prevents repetition | ✗ — `collectionId`/`directors` toujours null/vide |
| People affinity | ✗ — `directors` vide, score fixé à 0.5 pour tous |
| Theme affinity (keywords) | ✗ — seuls les genreNames matchent, pas les keywords TMDB |
| Quality prior | ✗ dégradé — popularity/voteAverage null, scores par défaut |

Les tests passent car les fixtures du benchmark et des unit tests renseignent manuellement tous ces champs. Le chemin de production (`retrievalService.retrieve()` → `enrichAsHybridCandidates()` → `rankHybrid()`) ne produit pas les mêmes conditions que les tests.

**Correction attendue** : `enrichAsHybridCandidates` doit requêter les tables nécessaires pour alimenter les champs manquants. Les données disponibles dans le schéma local :
- `movies.durationMinutes`, `movies.originalLanguage`, `movies.collectionId`
- `movieCredits` ou équivalent pour `directors`
- `movieKeywords` ou équivalent pour `keywords`
- `viewingProgress` pour `completionRatio`
- `movies.popularity`, `movies.voteAverage`

Si certaines tables n'existent pas encore, c'est un gap à documenter explicitement avec un TODO et les features correspondantes désactivées, pas un silence silencieux.

---

### [MINEUR] Poids discover mode ne somment pas à 1.0

**Fichier** : `recommendation-ranking-service.ts`, lignes 358-368

```typescript
wSemantic: 0.70,   // +0.70
wGenre: 0.02,      // +0.72
wTheme: 0.02,      // +0.74
wPeople: 0.02,     // +0.76
wFreshness: model.wFreshness, // +0.05 → 0.81
wPrior: model.wPrior * 2,     // +0.20 → 1.01
wAvailability: model.wAvailability, // +0.05 → 1.06
```

Somme ≈ 1.06. Le `weighted` peut légèrement dépasser 1.0 avant pénalités. Pas un bug bloquant mais une incohérence avec la sémantique d'un score normalisé [0,1].

---

### [MINEUR] Maturity/kids restriction absente de `QueryPlanHardFilters`

**Fichier** : `packages/api-contracts/src/query-plan.ts`

Le ticket (section 1) liste explicitement "maturity/kids restrictions" comme hard constraint. Le type `QueryPlanHardFilters` ne contient pas de champ `maxMaturityRating` ou `kidsOnly`. Ce gap n'est pas mentionné comme exclusion dans le plan.

---

### [MINEUR] `alreadyShownIds` non borné en taille dans la route Lab

**Fichier** : `recommendation-lab.ts`, lignes 324-327

```typescript
const alreadyShownIds = Array.isArray(body?.alreadyShownIds)
  ? (body.alreadyShownIds as unknown[]).filter((x): x is string => typeof x === 'string')
  : []
```

Filtrage du type mais pas de cap sur la taille du tableau. Un appelant malveillant peut envoyer un array de 10 000 IDs. Suggère `slice(0, 500)` ou équivalent.

---

## Risques éventuels

- **Faux positifs dans les tests** : le benchmark démontre que les hard filters fonctionnent, les profiles divergent, la diversity cap opère — mais uniquement sur fixtures manuelles. L'intégration réelle en Lab API ne satisferait pas ces mêmes assertions sans l'enrichissement corrigé.
- **Confusion outil de debug** : un utilisateur Lab qui active `debug:true` verra `peopleAffinity: 0.5` ou `themeAffinity: 0.5` sans comprendre que c'est la valeur par défaut due à des données manquantes, pas un score calculé.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[Bloquant]** Compléter `enrichAsHybridCandidates` pour fetcher `durationMinutes`, `originalLanguage`, `collectionId`, `directors`, `keywords`, `popularity`, `voteAverage`, et `completionRatio` depuis la DB. Si certaines tables (crédits, keywords) n'existent pas encore, documenter explicitement les features désactivées avec un commentaire TODO et laisser les défauts actuels en place de manière intentionnelle (pas silencieuse).

2. **[Mineur]** Normaliser les poids du mode `discover` pour que leur somme soit ≤ 1.0.

3. **[Mineur]** Ajouter un `slice(0, N)` sur `alreadyShownIds` dans la route Lab.

4. **[Optionnel — hors scope blocant]** Documenter l'absence de maturity/kids restriction dans le plan comme exclusion intentionnelle ou créer un champ placeholder dans `QueryPlanHardFilters`.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T104/reviews/implementation-review.md
- generated at: 2026-08-18T10:52:19Z

---

I have a thorough picture of the implementation. Writing the review now.

---

# PR Review — T104 Hybrid Recommendation Reranking

## Résumé

L'architecture pure-function du scoring hybride est solide : `SCORE_MODEL_V1` versionné, filtres hard appliqués avant le scoring, signaux négatifs différenciés, exploration levels documentés, debug breakdown complet. Les tests unitaires et le benchmark sont bien écrits.

Cependant, la fonction `enrichAsHybridCandidates` — chemin de production dans la route Lab — retourne `null`/`[]` pour la majorité des champs enrichis (`collectionId`, `directors`, `keywords`, `durationMinutes`, `originalLanguage`, `completionRatio`). Cela rend structurellement non-fonctionnels en production plusieurs critères d'acceptance : les hard filters runtime/langue, la people affinity, la theme affinity par keywords, le capping diversity collection/director, et les pénalités watched/abandonné.

Les tests passent uniquement parce qu'ils utilisent des fixtures manuellement construites avec tous les champs renseignés.

---

## Vérifications effectuées

- Lecture complète de `recommendation-ranking-service.ts` (690 lignes)
- Lecture complète de `recommendation-lab.ts` (494 lignes) avec focus sur `enrichAsHybridCandidates`
- Lecture des contrats `recommendations.ts` et `query-plan.ts`
- Lecture du benchmark (`recommendation-ranking-benchmark.test.ts`) et des tests unitaires (`recommendation-ranking-service.test.ts`)
- Vérification de la correspondance formules score / `ScoreBreakdown`
- Vérification des acceptance criteria du ticket

---

## Points validés

**Score model et pondération**
- `SCORE_MODEL_V1` est une constante versionnée, aucun magic number dispersé dans le code. ✓
- Le calcul final est cohérent avec le breakdown : la formule est vérifiée mathématiquement par le test de reconstruction (`scoreBreakdown.final` reconstructible depuis les composants). ✓

**Filtres hard**
- `passesHardFilters()` s'exécute avant le scoring. Aucun soft-score ne peut faire passer un item qui viole une contrainte explicite. ✓
- Les filtres couvrent : media type, runtime, release year, includeGenres/excludeGenres, audioLanguages, WATCH_NOW. ✓

**Signaux négatifs**
- Dislike (−1.5), abandon (−0.1), avoid keyword (−0.2), répétition/shown (−0.15) sont des pénalités distinctes — ne confond pas "vu une fois" avec "détesté". ✓
- `negativeMediaIds` n'est pas un blacklist hard : la pénalité est soustractive, un item très sémantiquement pertinent peut encore apparaître. Comportement cohérent avec le ticket ("Do not permanently blacklist"). ✓

**Exploration levels**
- exploit / explore / discover produisent des poids cohérents avec leurs intentions. ✓
- Le test scenario 15 vérifie que discover promeut un item haute qualité sur un item taste-aligned obscur. ✓

**Diversity**
- `applyDiversityFilter` implémente une stratégie MMR-like (pass first, defer rest, fill from deferred). ✓
- `maxPerCollection` et `maxPerDirector` sont configurables en options. ✓

**Explainability**
- `ScoreBreakdown` couvre tous les composants requis par le ticket (section 8), y compris `reasons[]`. ✓
- Debug breakdown généré uniquement quand `debug=true` — pas de coût en production. ✓

**Lab controls**
- `useHybridRanking`, `profileId`, `compareProfileId`, `explorationLevel`, `diversityEnabled`, `alreadyShownIds`, `debug`. ✓
- La comparaison deux profils est fonctionnelle. ✓

**Différenciation deux profils**
- La genre affinity est enrichie et fonctionne — Profile A sci-fi vs Profile B romance produisent des orderings distincts sur un même pool. ✓
- Tests scenario 11 et benchmark "top-5 overlap ≤ 3" valident le comportement. ✓

**Qualité code**
- Fonction pure sans DB access pour `rankHybrid`. ✓
- Nommage explicite, fonctions courtes et focalisées. ✓
- Sanitisation prompt-injection sur `profileContext` dans la route Lab. ✓

---

## Problèmes détectés

### [BLOQUANT] `enrichAsHybridCandidates` ne fetch pas les données nécessaires aux features clés

**Fichier** : `apps/api/src/routes/recommendation-lab.ts`, lignes 151-252

La fonction retourne des `HybridCandidate` avec les champs suivants systématiquement à leur valeur nulle/vide :

```typescript
collectionId: null,    // diversity collection capping → ne s'applique jamais
directors: [],         // people affinity → toujours 0.5 par défaut
keywords: [],          // theme affinity par keywords → toujours 0.5 par défaut
durationMinutes: null, // maxRuntimeMinutes hard filter → jamais déclenché
originalLanguage: null,// audioLanguages hard filter → jamais déclenché
completionRatio: null, // watched/abandoned penalty → jamais déclenché
popularity: null,      // qualityPrior → fallback 0.3 au lieu de valeur réelle
voteAverage: null,     // qualityPrior → fallback 0.5 au lieu de valeur réelle
```

**Impact sur les acceptance criteria :**

| Critère ticket | Statut |
|---|---|
| Hard constraints respectées (runtime, langue) | ✗ — `durationMinutes`/`originalLanguage` toujours null, filtres contournés silencieusement |
| Already-watched/recently exposed penalized | ✗ — `completionRatio` toujours null |
| Diversity prevents repetition | ✗ — `collectionId`/`directors` toujours null/vide |
| People affinity | ✗ — `directors` vide, score fixé à 0.5 pour tous |
| Theme affinity (keywords) | ✗ — seuls les genreNames matchent, pas les keywords TMDB |
| Quality prior | ✗ dégradé — popularity/voteAverage null, scores par défaut |

Les tests passent car les fixtures du benchmark et des unit tests renseignent manuellement tous ces champs. Le chemin de production (`retrievalService.retrieve()` → `enrichAsHybridCandidates()` → `rankHybrid()`) ne produit pas les mêmes conditions que les tests.

**Correction attendue** : `enrichAsHybridCandidates` doit requêter les tables nécessaires pour alimenter les champs manquants. Les données disponibles dans le schéma local :
- `movies.durationMinutes`, `movies.originalLanguage`, `movies.collectionId`
- `movieCredits` ou équivalent pour `directors`
- `movieKeywords` ou équivalent pour `keywords`
- `viewingProgress` pour `completionRatio`
- `movies.popularity`, `movies.voteAverage`

Si certaines tables n'existent pas encore, c'est un gap à documenter explicitement avec un TODO et les features correspondantes désactivées, pas un silence silencieux.

---

### [MINEUR] Poids discover mode ne somment pas à 1.0

**Fichier** : `recommendation-ranking-service.ts`, lignes 358-368

```typescript
wSemantic: 0.70,   // +0.70
wGenre: 0.02,      // +0.72
wTheme: 0.02,      // +0.74
wPeople: 0.02,     // +0.76
wFreshness: model.wFreshness, // +0.05 → 0.81
wPrior: model.wPrior * 2,     // +0.20 → 1.01
wAvailability: model.wAvailability, // +0.05 → 1.06
```

Somme ≈ 1.06. Le `weighted` peut légèrement dépasser 1.0 avant pénalités. Pas un bug bloquant mais une incohérence avec la sémantique d'un score normalisé [0,1].

---

### [MINEUR] Maturity/kids restriction absente de `QueryPlanHardFilters`

**Fichier** : `packages/api-contracts/src/query-plan.ts`

Le ticket (section 1) liste explicitement "maturity/kids restrictions" comme hard constraint. Le type `QueryPlanHardFilters` ne contient pas de champ `maxMaturityRating` ou `kidsOnly`. Ce gap n'est pas mentionné comme exclusion dans le plan.

---

### [MINEUR] `alreadyShownIds` non borné en taille dans la route Lab

**Fichier** : `recommendation-lab.ts`, lignes 324-327

```typescript
const alreadyShownIds = Array.isArray(body?.alreadyShownIds)
  ? (body.alreadyShownIds as unknown[]).filter((x): x is string => typeof x === 'string')
  : []
```

Filtrage du type mais pas de cap sur la taille du tableau. Un appelant malveillant peut envoyer un array de 10 000 IDs. Suggère `slice(0, 500)` ou équivalent.

---

## Risques éventuels

- **Faux positifs dans les tests** : le benchmark démontre que les hard filters fonctionnent, les profiles divergent, la diversity cap opère — mais uniquement sur fixtures manuelles. L'intégration réelle en Lab API ne satisferait pas ces mêmes assertions sans l'enrichissement corrigé.
- **Confusion outil de debug** : un utilisateur Lab qui active `debug:true` verra `peopleAffinity: 0.5` ou `themeAffinity: 0.5` sans comprendre que c'est la valeur par défaut due à des données manquantes, pas un score calculé.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[Bloquant]** Compléter `enrichAsHybridCandidates` pour fetcher `durationMinutes`, `originalLanguage`, `collectionId`, `directors`, `keywords`, `popularity`, `voteAverage`, et `completionRatio` depuis la DB. Si certaines tables (crédits, keywords) n'existent pas encore, documenter explicitement les features désactivées avec un commentaire TODO et laisser les défauts actuels en place de manière intentionnelle (pas silencieuse).

2. **[Mineur]** Normaliser les poids du mode `discover` pour que leur somme soit ≤ 1.0.

3. **[Mineur]** Ajouter un `slice(0, N)` sur `alreadyShownIds` dans la route Lab.

4. **[Optionnel — hors scope blocant]** Documenter l'absence de maturity/kids restriction dans le plan comme exclusion intentionnelle ou créer un champ placeholder dans `QueryPlanHardFilters`.

IMPLEMENTATION_FIX_REQUIRED