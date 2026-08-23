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


# T121 — Preserve semantic intent during SCORE_MODEL_V2 personalized reranking

**Source**: GitHub Issue #258

## Description

## Contexte

Le retrieval sémantique fonctionne maintenant correctement en production après #256/#257 :

- `Aventures à travers le temps` : **37 semanticRetrieved**, 37 post-filter, **0 fallback**, 20 final.
- autre shelf de type action/aventure : **40 semanticRetrieved**, 40 post-filter, **0 fallback**, 20 final.

Le problème restant est qualitatif : **le reranking personnalisé SCORE_MODEL_V2 semble pouvoir écraser trop fortement l’intention sémantique de la shelf**.

Principe produit attendu :

> **Le retrieval décide de quoi parle la shelf.**  
> **La personnalisation décide quels contenus pertinents pour cette shelf le profil préfère.**

La personnalisation ne doit pas transformer une shelf thématique en simple liste générale des contenus préférés du profil.

---

## Cas réel 1 — `Aventures à travers le temps`

### Raw Vector
Le retrieval sémantique est désormais cohérent et retourne notamment :

- `The Time Thief`
- `Chronovisor`
- `Time Lapse`
- `House of Time`
- `The Time Machine`
- `Timescape: Back to the Dinosaurs`
- `The Visitor from the Future`

avec 37 candidats sémantiques et aucun fallback.

### Final personnalisé
Le reranker remonte correctement plusieurs contenus temporels :

1. `Time Trap`
2. `The Time Travelers`
3. `The Time Machine`
4. `Timescape: Back to the Dinosaurs`
5. `The Visitor from the Future`

mais fait aussi remonter des contenus plus faibles vis-à-vis de l’intention, par exemple :

- `The Hobbit: An Unexpected Journey` #6
- `Journey to the Center of the Earth` #11
- `The Adventures of Tintin` #15
- `The Island of Thirty Coffins` #16
- `The Island` #20

Les raisons visibles sont surtout :

- `strong adventure genre affinity`
- `preferred language`
- `preferred era`

et la contribution de la pertinence sémantique est peu ou pas visible dans les raisons finales.

---

## Cas réel 2 — shelf action / aventure

### Raw Vector
Exemples parmi les candidats sémantiques :

- `Expend4bles`
- `Fast X`
- `The Fate of the Furious`
- `Mission: Impossible - Fallout`
- `The Expendables`
- `Deadpool`
- `Mad Max: Fury Road`
- `Pacific Rim: Uprising`
- `The Avengers`
- `Dune`
- `Avengers: Infinity War`
- `Avatar`

40 candidats sémantiques, 0 fallback.

### Final personnalisé
Le reranker produit :

1. `Top Gun: Maverick`
2. `Dune`
3. `Avengers: Infinity War`
4. `Avengers: Endgame`
5. `Mutiny`
6. `Mission: Impossible - Fallout`
7. `Deadpool & Wolverine`
8. `Mad Max: Fury Road`
9. `Fast X`
10. `Expend4bles`
...

Le résultat n’est pas absurde, mais les raisons affichées restent principalement :

- `strong adventure genre affinity`
- `preferred language`
- `preferred era`
- parfois `strong science fiction genre affinity`

Cela suggère que les préférences profil peuvent peser davantage que l’intention spécifique de la shelf.

---

## Objectif

Faire en sorte que SCORE_MODEL_V2 **préserve fortement la pertinence sémantique du concept** tout en personnalisant le classement à l’intérieur du pool pertinent.

Le moteur doit éviter ce type de dérive :

```text
ShelfConcept précis
→ bons candidats sémantiques
→ reranking profil
→ liste générique de films aimés par le profil
```

et viser :

```text
ShelfConcept précis
→ bons candidats sémantiques
→ élimination / pénalisation des candidats trop faibles sémantiquement
→ personnalisation entre candidats réellement pertinents
→ final
```

---

## Travaux demandés

### 1. Audit du SCORE_MODEL_V2

Documenter la formule réelle et les poids actuels utilisés pour :

- semantic similarity ;
- genre affinity ;
- theme/keyword affinity ;
- people affinity ;
- franchise affinity ;
- language ;
- country ;
- decade/era ;
- media type ;
- availability ;
- popularity/quality prior ;
- watched/dislike/not-interested ;
- exposure/repetition/diversity.

Vérifier si `semanticSimilarity` est actuellement suffisamment dominante dans les shelves fondées sur un `semanticIntent`.

### 2. Introduire une protection de pertinence sémantique

Pour les recommandations issues d’un ShelfConcept / QueryPlan sémantique, ajouter une stratégie explicite telle que l’une de ces approches (ou meilleure si justifiée) :

- **semantic relevance floor** : exclure les candidats sous un seuil configurable ;
- **semantic gate** : empêcher un faible score semantic d’être compensé entièrement par les préférences profil ;
- **semantic weight floor** : poids minimal garanti de la pertinence sémantique dans le score final ;
- combinaison de ces approches.

Le seuil/poids doit être configurable/versionné, pas un magic number dispersé dans le code.

### 3. Différencier les usages

Ne pas imposer la même contrainte partout :

- ShelfConcept thématique précis → forte préservation de l’intention ;
- Home profil-only / broad discovery → davantage de liberté pour la personnalisation ;
- fallback/popularité → autre comportement adapté ;
- query utilisateur avec contrainte explicite → pertinence sémantique/hard constraints prioritaires.

Le comportement doit dépendre du type de plan/requête, pas être globalement rigide.

### 4. Score breakdown / raisons

Le Lab doit permettre de comprendre pourquoi un item est retenu.

Pour chaque résultat final en debug, exposer au minimum :

```text
semanticSimilarity
semanticContribution
profileGenreContribution
profileThemeContribution
peopleContribution
languageContribution
eraContribution
otherPositiveContributions
penalties
finalScore
```

Les reason codes doivent refléter la pertinence sémantique quand elle est déterminante, par ex. :

- `strong semantic match to time-travel intent`
- `strong profile adventure affinity`
- `preferred language`

et pas seulement les goûts du profil.

### 5. Éviter les faux positifs sauvé uniquement par le profil

Ajouter un test garantissant qu’un contenu :

- très apprécié par le profil,
- mais faiblement lié à l’intention,

ne peut pas dépasser plusieurs contenus nettement plus pertinents sémantiquement uniquement grâce à `genre/language/era`.

---

## Tests de non-régression obligatoires

### A. `Aventures à travers le temps`

Le final doit rester dominé par des contenus réellement liés au voyage temporel / temporalité / distorsion du temps.

Exemples attendus comme fortement pertinents lorsqu’ils existent dans le pool :

- `The Time Machine`
- `Timescape: Back to the Dinosaurs`
- `The Visitor from the Future`
- `Time Trap`
- `The Time Travelers`
- `Time Lapse`
- `House of Time`

Des contenus d’aventure sans lien temporel fort (`The Hobbit`, `Tintin`, etc.) ne doivent pas être propulsés très haut uniquement grâce au profil.

### B. Shelf action / aventure

Le reranking peut réordonner fortement selon le profil, mais doit conserver une cohérence évidente avec l’intention de la shelf.

### C. `SF qui fait réfléchir`

Tester qu’un blockbuster d’action apprécié du profil ne dépasse pas abusivement des œuvres plus cérébrales si son lien avec l’intention est faible.

### D. `film qui retourne le cerveau`

Même principe : la personnalisation ne doit pas réduire la shelf à des films génériques aimés du profil.

---

## Métriques / évaluation

Ajouter dans le Lab ou un rapport de benchmark :

- moyenne de `semanticSimilarity` des top 5 / top 10 / top 20 avant rerank ;
- moyenne après rerank ;
- nombre de candidats sous le semantic floor dans le final ;
- corrélation rang vectoriel vs rang final ;
- signal lorsque le reranker fait remonter un candidat de très loin malgré faible semantic score.

Le but n’est pas d’empêcher toute exploration, mais de rendre visible une dérive excessive.

---

## Acceptance criteria

- [ ] La formule/pondération V2 est auditée et documentée.
- [ ] Une protection explicite de pertinence sémantique existe pour les shelves thématiques.
- [ ] Le mécanisme est configurable/versionné.
- [ ] `semanticSimilarity` et sa contribution sont visibles dans le score breakdown.
- [ ] Les reasons expliquent à la fois intention + profil.
- [ ] Un candidat faiblement pertinent ne peut plus être sauvé uniquement par genre/langue/ère au détriment de candidats nettement plus pertinents.
- [ ] `Aventures à travers le temps` reste dominée par des contenus temporels après personnalisation.
- [ ] Les queries `SF qui fait réfléchir` et `film qui retourne le cerveau` restent fidèles à leur intention après reranking.
- [ ] Les usages profil-only / discovery restent libres d’être davantage personnalisés.
- [ ] Aucun retour au simple ranking vector-only : la personnalisation doit rester active.

## Completion rule

Ne pas fermer le ticket sur une simple modification de poids ou sur tests unitaires uniquement.

La fermeture nécessite une validation réelle dans Recommendation Lab sur plusieurs concepts, montrant :

```text
bon Raw Vector
→ reranking personnalisé
→ final toujours fidèle à l’intention
```

avec score breakdown démontrant explicitement la contribution sémantique et les contributions profil.

Le but n’est pas de rendre le final identique au Raw Vector, mais de garantir que **la personnalisation réordonne la pertinence, elle ne remplace pas l’intention**.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All done. Here is a summary of every file modified and what changed:

---

## Files modified

### `packages/api-contracts/src/query-plan.ts`
- Added `semanticProtection?: 'strict' | 'moderate' | 'none'` to `RecommendationQueryPlan`.

### `packages/api-contracts/src/recommendations.ts`
- Added `semanticContribution: number` and `profileContribution: number` to `ScoreBreakdown`.

### `apps/recommendation-engine/src/config.ts`
- Added three env-configurable exports: `SEMANTIC_FLOOR_STRICT` (default 0.40), `SEMANTIC_FLOOR_MODERATE` (default 0.28), `SEMANTIC_WEIGHT_THEMATIC` (default 0.40).

### `apps/recommendation-engine/src/services/shelf-concept-mapper.ts`
- Added `generationType?: string | null` to the input type.
- Added `resolveSemanticProtection()` that maps: `FIXED|EDITORIAL` → `'strict'`, `DISCOVERY` → `'none'`, anything else → `'moderate'`.
- The returned plan now includes `semanticProtection` set accordingly.

### `apps/recommendation-engine/src/routes/shelf-concepts.ts`
- Passes `generationType: concept.generationType` into `buildQueryPlanFromShelfConcept` at the `:id/preview` endpoint.

### `apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts`
- Exported `getBlendedWeights` (previously private).
- Added `'thematic'` to `ExplorationLevel` with boosted `wSemantic = SEMANTIC_WEIGHT_THEMATIC` and proportionally reduced profile weights.
- `runHybridReranker` now selects blend level and semantic floor dynamically based on `plan.semanticProtection`: `'strict'` → thematic + 0.40 floor, `'moderate'` → thematic + 0.28 floor, `undefined` → exploit + no floor (no regression on existing paths).
- The floor is applied in the `eligible` filter alongside `passesHardFilters`.
- `buildReasons` accepts optional `semanticIntent` and emits `'strong semantic match to <first-3-words>'` / `'semantic match to <first-3-words>'` when provided.
- `ScoreBreakdown` now includes `semanticContribution` and `profileContribution` computed from the actual weights used.

### `apps/recommendation-engine/src/pipeline/stages/__tests__/hybrid-reranker.test.ts`
- Two new describe blocks with 5 new test cases covering the semantic floor check and the "profile cannot override semantic" proof (demonstrates that without the floor, B would outscore A, but the floor excludes B).

### `apps/recommendation-engine/src/pipeline/__tests__/pipeline-regression.test.ts`
- `makeRegressionPlan` now accepts an optional `semanticProtection` parameter.
- Added `'SF qui fait réfléchir'` regression test.
- Thematic intent tests (`Aventures à travers le temps`, `film qui retourne le cerveau`, `SF qui fait réfléchir`) now run with `semanticProtection: 'moderate'` and assert: top-5 semantic scores ≥ `SEMANTIC_FLOOR_MODERATE`, at least 3/10 results where `semanticContribution > profileContribution`, and top-5 semantic score spread < 0.25.

---

## Review

I now have everything I need. Let me write the structured review.

---

## Review — T121: Preserve semantic intent during SCORE_MODEL_V2 personalized reranking

### Summary

The implementation introduces a three-tier semantic protection model (`strict`/`moderate`/`none`), a `'thematic'` weight blend, configurable floors via env vars, enriched score breakdown, and intent-aware reason codes. The approach is architecturally sound and correctly scoped. Two issues require a fix before approval.

---

### 1. Correctness against ticket requirements

#### Formal acceptance criteria

| AC | Status | Notes |
|----|--------|-------|
| Formula/pondération V2 auditée et documentée | ✅ | Embedded in constants and `'thematic'` blend definition. Explicit audit doc excluded by plan. |
| Protection sémantique explicite pour shelves thématiques | ✅ | Floor + weight boost via `semanticProtection` on plan |
| Mécanisme configurable/versionné | ✅ | `SEMANTIC_FLOOR_STRICT`, `SEMANTIC_FLOOR_MODERATE`, `SEMANTIC_WEIGHT_THEMATIC` in `config.ts` |
| `semanticSimilarity` et sa contribution visibles | ✅ | `semantic` + `semanticContribution` in `ScoreBreakdown` |
| Reasons expliquent intention + profil | ✅ | Intent-aware `buildReasons` with `semanticIntent` from plan |
| Candidat faible ne peut être sauvé par genre/langue/ère | ✅ | Floor excludes before scoring; math proof in unit test |
| `Aventures à travers le temps` dominée par contenus temporels | ✅ | Regression test updated, `semanticProtection: 'moderate'`, 2 semantic assertions |
| `SF qui fait réfléchir` et `film qui retourne le cerveau` fidèles à l'intention | ✅ | New regression tests added |
| Usages discovery/profil-only restent libres | ✅ | `'none'` → `'exploit'` blend, no floor; pre-existing paths unchanged |
| Pas de retour au ranking vector-only | ✅ | Personalization remains active at all protection levels |

#### Section 4 requirement — score breakdown per signal

The ticket requires exposing "au minimum":
```
semanticSimilarity, semanticContribution,
profileGenreContribution, profileThemeContribution, peopleContribution,
languageContribution, eraContribution, otherPositiveContributions,
penalties, finalScore
```

Current state:
- `semantic`, `semanticContribution` ✅ (new)
- `profileContribution` (aggregate only) — individual per-signal contributions **not added**
- `genreAffinity`, `themeAffinity`, `languageAffinity`, etc. expose raw signals but not weighted contributions
- `penalties` ✅ (all individual penalty fields already existed)
- `final` (= finalScore) ✅

**Gap:** The Lab cannot compute `profileGenreContribution = genreAffinity × wGenre` without knowing which weight blend was used (`exploit` vs `thematic`), and the blend used is not surfaced in the breakdown. The raw affinities alone are insufficient for the Lab transparency goal in section 4.

#### Metrics / évaluation section

The ticket asks for:
- Avg `semanticSimilarity` top-5/10/20 before vs after rerank
- Count candidates below floor in final
- Rank correlation vectoriel vs final
- Signal when reranker promotes a far-back candidate despite weak semantic score

None of these are implemented. The plan explicitly excluded UI changes, but these are API/data-layer metrics, not UI. This section is not addressed. Flagged as deferred, not blocking.

---

### 2. Scope compliance

No drift detected. Changes confined to: API contracts, config, shelf-concept mapper, routes, hybrid-reranker, and tests. Free-text query path and semantic retrieval stage are untouched. LLM planner prompt is out of scope as documented in the plan.

---

### 3. Code quality

**Positive:**

- Floor applied before scoring, not as a penalty — semantically clean, no edge cases where profile partially rescues a below-floor candidate.
- `profileContribution` formula correctly isolates profile signals: `weighted − semanticContribution − fresh×wFreshness − prior×wPrior − avail×wAvailability`. Correct.
- `resolveSemanticProtection` in `shelf-concept-mapper.ts` is clean, exhaustive, and safe-defaults to `'moderate'` for unknown generation types.
- `getBlendedWeights` exported for testability — good.
- Config constants well-commented and env-overridable without magic numbers in scoring code.

**Weight sum observation:**

SCORE_MODEL_V2 sums to **1.10** (not 1.00 as stated in the plan). The `'thematic'` blend sums to **1.08**. Neither equals 1.0. The plan's acceptance criterion "weights sum to the same total as V2 baseline (≤ 1.0)" is doubly incorrect: V2 itself is not ≤ 1.0, and the two sums differ by 0.02. Functionally, this is not a bug since scoring is not normalized, but the plan criterion is wrong and should be struck or corrected.

**Intent truncation:**

```typescript
semanticIntent.trim().split(/\s+/).slice(0, 3).join(' ')
```

For `'Aventures à travers le temps'` (5 words), reason will read: `"strong semantic match to Aventures à travers"`. This truncates the intent and can be misleading. Minor UX issue for the Lab; not blocking.

---

### 4. Tests — BLOCKING ISSUE

#### Unit tests (hybrid-reranker.test.ts)

The "semantic floor protection" tests verify **constant values, not filter behavior**:

```typescript
// These are mathematical assertions on numbers, not tests of filter logic
expect(0.20 >= SEMANTIC_FLOOR_MODERATE).toBe(false)
expect(0.27 >= SEMANTIC_FLOOR_MODERATE).toBe(false)
expect(SEMANTIC_FLOOR_MODERATE >= SEMANTIC_FLOOR_MODERATE).toBe(true)
expect(0.35 >= SEMANTIC_FLOOR_MODERATE).toBe(true)
```

None of these tests call any filtering function. They would pass even if the floor filter was completely removed from `runHybridReranker`. The plan explicitly required:

> "a candidate with `similarity = 0.20` is excluded before scoring regardless of genre/language affinity"

That property is not tested. The "profile cannot override semantic" test is better — it computes hypothetical scores and proves the math — but it still doesn't call `runHybridReranker` or the filter lambda.

The actual filter is:
```typescript
const eligible = enriched.filter(
  (c) => passesHardFilters(c, plan) && (semanticFloor === 0 || (c.similarity ?? 0) >= semanticFloor),
)
```

There is no test that verifies:
1. `plan.semanticProtection = 'moderate'` causes `semanticFloor = SEMANTIC_FLOOR_MODERATE`
2. The filter excludes candidates with `similarity < semanticFloor`

**Required fix:** Add at minimum one test that verifies the filter wiring. Options:
- Extract the floor-filter predicate to a named/exported function and unit-test it with controlled inputs, OR
- Test `runHybridReranker` with a mocked DB, injecting candidates with known `similarity` values and asserting exclusion

#### Regression tests (pipeline-regression.test.ts)

These are acceptable — they're correctly skipped when `OPENAI_API_KEY` is absent, consistent with the existing pattern, and assertions are meaningful (floor check on top-5, semantic dominance check on top-10). The "film qui retourne le cerveau" spread assertion (`maxSemantic - minSemantic < 0.25`) is pragmatic.

---

### 5. Blocking issues

**BLOCKER 1 — Unit tests verify constants, not filter behavior**

The floor protection tests do not test that `runHybridReranker` (or the filter predicate) actually excludes candidates below the floor. A test that removes the floor filter from the code would still pass all current unit tests. The plan required behavioral verification of exclusion.

**BLOCKER 2 — Individual profile signal contributions absent from ScoreBreakdown**

Section 4 of the ticket requires per-signal weighted contributions (`profileGenreContribution`, `languageContribution`, etc.) "au minimum". Only aggregate `profileContribution` is added. Since the blend weights (`wGenre`, `wLanguage`, etc.) vary between `'exploit'` and `'thematic'` and are not exposed in the breakdown, the Lab cannot derive per-signal contributions from the raw affinity values alone. The Lab transparency goal of section 4 is only partially met.

---

### 6. Minor observations (non-blocking)

- Plan criterion "weights sum to V2 baseline (≤ 1.0)" is incorrect: V2 = 1.10, thematic = 1.08. Not a functional issue but the plan text is wrong.
- Intent truncated to 3 words in reason strings — may misrepresent longer intents.
- Metrics/évaluation section (avg semanticSimilarity before/after, rank correlation) not addressed — defer to a follow-up ticket.
- Completion Rule requires Lab validation on real concepts showing `bon Raw Vector → reranking → final fidèle à l'intention` with score breakdown. Implementation provides the data; human Lab validation remains required before closing.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T121/reviews/implementation-review.md
- generated at: 2026-08-23T13:20:40Z

---

I now have everything I need. Let me write the structured review.

---

## Review — T121: Preserve semantic intent during SCORE_MODEL_V2 personalized reranking

### Summary

The implementation introduces a three-tier semantic protection model (`strict`/`moderate`/`none`), a `'thematic'` weight blend, configurable floors via env vars, enriched score breakdown, and intent-aware reason codes. The approach is architecturally sound and correctly scoped. Two issues require a fix before approval.

---

### 1. Correctness against ticket requirements

#### Formal acceptance criteria

| AC | Status | Notes |
|----|--------|-------|
| Formula/pondération V2 auditée et documentée | ✅ | Embedded in constants and `'thematic'` blend definition. Explicit audit doc excluded by plan. |
| Protection sémantique explicite pour shelves thématiques | ✅ | Floor + weight boost via `semanticProtection` on plan |
| Mécanisme configurable/versionné | ✅ | `SEMANTIC_FLOOR_STRICT`, `SEMANTIC_FLOOR_MODERATE`, `SEMANTIC_WEIGHT_THEMATIC` in `config.ts` |
| `semanticSimilarity` et sa contribution visibles | ✅ | `semantic` + `semanticContribution` in `ScoreBreakdown` |
| Reasons expliquent intention + profil | ✅ | Intent-aware `buildReasons` with `semanticIntent` from plan |
| Candidat faible ne peut être sauvé par genre/langue/ère | ✅ | Floor excludes before scoring; math proof in unit test |
| `Aventures à travers le temps` dominée par contenus temporels | ✅ | Regression test updated, `semanticProtection: 'moderate'`, 2 semantic assertions |
| `SF qui fait réfléchir` et `film qui retourne le cerveau` fidèles à l'intention | ✅ | New regression tests added |
| Usages discovery/profil-only restent libres | ✅ | `'none'` → `'exploit'` blend, no floor; pre-existing paths unchanged |
| Pas de retour au ranking vector-only | ✅ | Personalization remains active at all protection levels |

#### Section 4 requirement — score breakdown per signal

The ticket requires exposing "au minimum":
```
semanticSimilarity, semanticContribution,
profileGenreContribution, profileThemeContribution, peopleContribution,
languageContribution, eraContribution, otherPositiveContributions,
penalties, finalScore
```

Current state:
- `semantic`, `semanticContribution` ✅ (new)
- `profileContribution` (aggregate only) — individual per-signal contributions **not added**
- `genreAffinity`, `themeAffinity`, `languageAffinity`, etc. expose raw signals but not weighted contributions
- `penalties` ✅ (all individual penalty fields already existed)
- `final` (= finalScore) ✅

**Gap:** The Lab cannot compute `profileGenreContribution = genreAffinity × wGenre` without knowing which weight blend was used (`exploit` vs `thematic`), and the blend used is not surfaced in the breakdown. The raw affinities alone are insufficient for the Lab transparency goal in section 4.

#### Metrics / évaluation section

The ticket asks for:
- Avg `semanticSimilarity` top-5/10/20 before vs after rerank
- Count candidates below floor in final
- Rank correlation vectoriel vs final
- Signal when reranker promotes a far-back candidate despite weak semantic score

None of these are implemented. The plan explicitly excluded UI changes, but these are API/data-layer metrics, not UI. This section is not addressed. Flagged as deferred, not blocking.

---

### 2. Scope compliance

No drift detected. Changes confined to: API contracts, config, shelf-concept mapper, routes, hybrid-reranker, and tests. Free-text query path and semantic retrieval stage are untouched. LLM planner prompt is out of scope as documented in the plan.

---

### 3. Code quality

**Positive:**

- Floor applied before scoring, not as a penalty — semantically clean, no edge cases where profile partially rescues a below-floor candidate.
- `profileContribution` formula correctly isolates profile signals: `weighted − semanticContribution − fresh×wFreshness − prior×wPrior − avail×wAvailability`. Correct.
- `resolveSemanticProtection` in `shelf-concept-mapper.ts` is clean, exhaustive, and safe-defaults to `'moderate'` for unknown generation types.
- `getBlendedWeights` exported for testability — good.
- Config constants well-commented and env-overridable without magic numbers in scoring code.

**Weight sum observation:**

SCORE_MODEL_V2 sums to **1.10** (not 1.00 as stated in the plan). The `'thematic'` blend sums to **1.08**. Neither equals 1.0. The plan's acceptance criterion "weights sum to the same total as V2 baseline (≤ 1.0)" is doubly incorrect: V2 itself is not ≤ 1.0, and the two sums differ by 0.02. Functionally, this is not a bug since scoring is not normalized, but the plan criterion is wrong and should be struck or corrected.

**Intent truncation:**

```typescript
semanticIntent.trim().split(/\s+/).slice(0, 3).join(' ')
```

For `'Aventures à travers le temps'` (5 words), reason will read: `"strong semantic match to Aventures à travers"`. This truncates the intent and can be misleading. Minor UX issue for the Lab; not blocking.

---

### 4. Tests — BLOCKING ISSUE

#### Unit tests (hybrid-reranker.test.ts)

The "semantic floor protection" tests verify **constant values, not filter behavior**:

```typescript
// These are mathematical assertions on numbers, not tests of filter logic
expect(0.20 >= SEMANTIC_FLOOR_MODERATE).toBe(false)
expect(0.27 >= SEMANTIC_FLOOR_MODERATE).toBe(false)
expect(SEMANTIC_FLOOR_MODERATE >= SEMANTIC_FLOOR_MODERATE).toBe(true)
expect(0.35 >= SEMANTIC_FLOOR_MODERATE).toBe(true)
```

None of these tests call any filtering function. They would pass even if the floor filter was completely removed from `runHybridReranker`. The plan explicitly required:

> "a candidate with `similarity = 0.20` is excluded before scoring regardless of genre/language affinity"

That property is not tested. The "profile cannot override semantic" test is better — it computes hypothetical scores and proves the math — but it still doesn't call `runHybridReranker` or the filter lambda.

The actual filter is:
```typescript
const eligible = enriched.filter(
  (c) => passesHardFilters(c, plan) && (semanticFloor === 0 || (c.similarity ?? 0) >= semanticFloor),
)
```

There is no test that verifies:
1. `plan.semanticProtection = 'moderate'` causes `semanticFloor = SEMANTIC_FLOOR_MODERATE`
2. The filter excludes candidates with `similarity < semanticFloor`

**Required fix:** Add at minimum one test that verifies the filter wiring. Options:
- Extract the floor-filter predicate to a named/exported function and unit-test it with controlled inputs, OR
- Test `runHybridReranker` with a mocked DB, injecting candidates with known `similarity` values and asserting exclusion

#### Regression tests (pipeline-regression.test.ts)

These are acceptable — they're correctly skipped when `OPENAI_API_KEY` is absent, consistent with the existing pattern, and assertions are meaningful (floor check on top-5, semantic dominance check on top-10). The "film qui retourne le cerveau" spread assertion (`maxSemantic - minSemantic < 0.25`) is pragmatic.

---

### 5. Blocking issues

**BLOCKER 1 — Unit tests verify constants, not filter behavior**

The floor protection tests do not test that `runHybridReranker` (or the filter predicate) actually excludes candidates below the floor. A test that removes the floor filter from the code would still pass all current unit tests. The plan required behavioral verification of exclusion.

**BLOCKER 2 — Individual profile signal contributions absent from ScoreBreakdown**

Section 4 of the ticket requires per-signal weighted contributions (`profileGenreContribution`, `languageContribution`, etc.) "au minimum". Only aggregate `profileContribution` is added. Since the blend weights (`wGenre`, `wLanguage`, etc.) vary between `'exploit'` and `'thematic'` and are not exposed in the breakdown, the Lab cannot derive per-signal contributions from the raw affinity values alone. The Lab transparency goal of section 4 is only partially met.

---

### 6. Minor observations (non-blocking)

- Plan criterion "weights sum to V2 baseline (≤ 1.0)" is incorrect: V2 = 1.10, thematic = 1.08. Not a functional issue but the plan text is wrong.
- Intent truncated to 3 words in reason strings — may misrepresent longer intents.
- Metrics/évaluation section (avg semanticSimilarity before/after, rank correlation) not addressed — defer to a follow-up ticket.
- Completion Rule requires Lab validation on real concepts showing `bon Raw Vector → reranking → final fidèle à l'intention` with score breakdown. Implementation provides the data; human Lab validation remains required before closing.

---

IMPLEMENTATION_FIX_REQUIRED