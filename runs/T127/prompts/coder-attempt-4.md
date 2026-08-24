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


# T127 — Build a true must-watch Hero ranker for Home

**Source**: GitHub Issue #270

## Description

## Context

#268 introduced a stable cached Home snapshot and a first hero selector. The cache works, but the hero quality is still poor: the current selector simply takes the **first candidate** that passes basic technical gates (`available`, `finalScore >= HERO_MIN_SCORE`, not disliked, title/backdrop present).

This means an obscure or weak recommendation can become the giant Home hero merely because it happens to be first in the input list and has artwork.

The Home hero should instead answer a stronger product question:

> **What is the one title this user is most likely to want to watch right now — even if they did not know it yet?**

The hero is not just "Pour toi item #1". It is the most prominent recommendation on the whole product and must have a stricter, dedicated ranking policy.

## Goal

Replace the current first-eligible-candidate behavior with a dedicated **must-watch Hero ranker** that evaluates a candidate set and selects the strongest hero-worthy title.

The Home snapshot/stability behavior from #268 must remain intact: once selected, the hero stays stable for the snapshot lifetime. This ticket is about **selection quality**, not refresh/random rotation.

## Current problem in code

The current selector effectively does:

```text
filter available + score threshold + dislike + backdrop
→ iterate candidates in input order
→ return first eligible candidate
```

This is insufficient. Hero selection must rank all eligible candidates using explicit hero-quality signals.

## Hero ranking principles

A good hero candidate should combine:

- **very strong profile fit / personalized score**;
- **strong recommendation confidence**;
- **high semantic/thematic relevance where applicable**;
- **actual availability/playability**;
- **good-quality backdrop/artwork**;
- **usable localized title and metadata**;
- **appropriate preferred language/localization where metadata allows it**;
- **reasonable quality/popularity prior** so catalog noise is not promoted over strong known titles;
- **not disliked / not explicitly rejected**;
- eventually unseen/rewatch policy once watched-state is implemented;
- enough editorial/must-watch value to justify occupying the largest visual slot.

Do not interpret popularity as "always choose blockbuster". Personal relevance remains primary, but popularity/quality/confidence should act as safeguards against obscure low-value noise.

## Dedicated Hero Score

Introduce a versioned/configurable Hero ranking formula or policy, separate from the generic shelf order.

For example, the ranker may consider:

```text
heroScore =
  personalizedRelevance
+ recommendationConfidence
+ semanticRelevance
+ quality/popularity prior
+ freshness/novelty where useful
+ metadata/artwork quality bonuses
- penalties
```

The exact formula is not prescribed, but it must be explicit, testable and observable.

The hero ranker must be allowed to choose candidate #5, #10, etc. from `Pour toi` if that candidate is clearly more hero-worthy than candidate #1.

## Candidate pool

Do not rank only one candidate.

Evaluate a reasonable pool of strong personalized candidates (for example top N from `Pour toi` / eligible Home discovery candidates) and select the best hero according to the dedicated policy.

Avoid duplicate hero + first visible `Pour toi` item when enough alternatives exist, preserving the existing cross-shelf diversity behavior.

## Quality gate

Retain hard eligibility rules before ranking:

- playable/available;
- title present;
- valid hero/backdrop image;
- not disliked;
- minimum recommendation confidence/score;
- media type supported by Home hero.

Then apply the Hero ranker among eligible candidates.

If no candidate is strong enough after ranking, return **no hero**. Do not fill the slot with a mediocre title.

## Language / localization

The current poor hero example highlights the need to consider language/display suitability.

When metadata is available:

- prefer localized/display-ready titles for the user's language;
- penalize candidates whose metadata/language presentation is clearly mismatched when equally strong alternatives exist;
- do not globally exclude foreign-language content — a foreign movie can absolutely be hero if it is a genuinely strong personalized recommendation.

The goal is to avoid accidental prominence caused by catalog ordering, not to hard-filter countries/languages.

## Observability / Recommendation Lab or debug

Expose enough debug information to understand why a hero was selected.

For the evaluated hero candidate pool, make available at least:

```text
mediaId/title
base personalized finalScore
semantic/profile score if available
hero quality/popularity prior
language/localization contribution
artwork/metadata eligibility
penalties
final heroScore
selected=true/false
rejectionReason when ineligible
```

This can be logs/admin/debug output; do not expose internals in normal consumer Home UI.

## Tests

Add tests proving that:

1. The first eligible candidate is **not automatically selected**.
2. A later candidate with materially stronger heroScore wins.
3. A low-quality/obscure candidate with acceptable generic finalScore loses to a stronger personalized/quality candidate.
4. A disliked/unavailable/no-backdrop candidate cannot win.
5. Foreign-language content can still win when it is genuinely the best candidate.
6. No sufficiently strong candidate => `null` / no hero.
7. Snapshot persistence still keeps the selected hero stable across Home refreshes.

## Acceptance criteria

- [ ] Hero selection no longer returns the first eligible recommendation by input order.
- [ ] A dedicated Hero ranking policy/formula exists and is versioned/configurable.
- [ ] Multiple strong candidates are evaluated before selection.
- [ ] Profile relevance remains primary, with quality/confidence/popularity/localization used as safeguards rather than arbitrary dominance.
- [ ] The hero can select a lower-ranked `Pour toi` candidate when it is clearly more must-watch-worthy.
- [ ] Poor catalog noise is materially less likely to occupy the hero.
- [ ] No acceptable candidate => no hero.
- [ ] Existing ~24h Home snapshot stability/cache behavior from #268 is preserved.
- [ ] Debug/observability explains why the chosen hero won.
- [ ] No title-specific/country-specific hardcoding and no manual production DB changes.

## Completion rule

Do not close this ticket because unit tests pass or because the selector technically returns a title.

Validate with a real populated profile/Home candidate pool and show that hero selection is based on comparative hero ranking rather than input order.

The expected product result is simple:

> Opening IPTVFlix should make the hero feel like **"I didn't know I wanted to watch this, but now I do."**

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Both blocking issues are fixed and committed:

1. **`hero-selector.ts`** — introduced a `HeroWeights` structural type (all fields `number`) for the `weights` parameter of `computeHeroScore`, replacing `typeof HERO_SCORE_WEIGHTS` which carried `as const` literal types incompatible with test-constructed objects.

2. **`home-pool-service.test.ts`** — added `qualityPrior: 0, languageAffinity: 0` to the `makeCandidates` fixture to satisfy the required fields added to `ShelfCandidateItem` by T127.

`pnpm tsc --noEmit` now shows only the two pre-existing `accountId` errors (in `commands.test.ts`/`pairing.test.ts`), and all 48 tests pass.

---

## Review

I have a thorough picture of the implementation. Let me write the structured review.

---

## PR Review — T127: Build a true must-watch Hero ranker for Home

### Résumé

L'implémentation introduit un `hero-selector.ts` dédié avec une formule de scoring explicite, intégrée dans `home-pool-service.ts`, avec persistance dans le snapshot existant. L'architecture est propre et cohérente avec le ticket. **Un problème bloquant a été détecté sur la couverture de test du requirement #5 (langue étrangère).**

---

### Vérifications effectuées

- Lecture complète de `hero-selector.ts` (143 lignes)
- Lecture complète de `hero-selector.test.ts` (470 lignes)
- Vérification de `env.ts` (HERO_MIN_SCORE, HERO_POOL_SIZE, HERO_SCORE_WEIGHTS)
- Vérification de l'intégration dans `home-pool-service.ts`
- Vérification de la persistance dans `home-snapshot-service.ts`
- Lecture des tests de stabilité snapshot dans `home-snapshot.test.ts`
- Vérification du type `ShelfCandidateItem` dans `recommendation-engine-client.ts`

---

### Points validés

**Architecture et formule**
- `computeHeroScore()` est une pure function explicite, testable isolément.
- Formule: `0.45·profileScore + 0.25·semanticScore + 0.20·qualityPrior + 0.10·languageAffinity` — poids normalisés (somme = 1.0), `profileRelevance` dominant à 45% conformément au ticket.
- Version `v1` labellisée dans `HERO_SCORE_WEIGHTS`.
- `HERO_MIN_SCORE` (0.55) et `HERO_POOL_SIZE` (15) sont env-configurables.

**Logique de sélection**
- Pool de 15 candidats évalués, tri par `heroScore` descendant, sélection du meilleur (`ranked[0]`).
- Portes d'éligibilité séquentielles correctes : `available` + `finalScore >= HERO_MIN_SCORE` → dislikes → `title` + `backdropUrl`.
- Retourne `null` si aucun candidat passe — ticket requirement "no hero" respecté.
- Les candidats sans backdrop dans la DB tombent silencieusement de `enrichMap` → exclusion implicite mais correcte.

**Intégration home-pool-service.ts**
- `selectHero()` appelé avant de filtrer le rail "Pour toi" → exclusion du hero du rail pour éviter les doublons.
- Erreur de sélection du hero catchée avec `console.error`, fallback sur `null` sans crasher — robuste.

**Persistance snapshot**
- `heroMediaId` / `heroMediaType` stockés dans le schema `homeDiscoverySnapshots`.
- Chemin HIT : hero reconstruit depuis le snapshot sans re-sélection (`buildDeclaredRails` non appelé).
- Tests de stabilité vérifient deux `buildHome()` consécutifs → même `hero.mediaId`.

**Observabilité**
- Log `[HERO_RANKING]` complet avec pool size, eligible count, winner mediaId+title, heroScore formaté 3 décimales, version des poids, et tableau complet de chaque candidat avec tous les scores et le flag `selected`.
- Répond à toutes les exigences de debug du ticket.

**Tests T1–T6, T8–T9**
- T1 : candidat C (profileScore=0.9, position 3) bat A (position 1, profileScore=0.6) ✓
- T2 : candidat en position 7/10 (profileScore=0.95) bat les 6 précédents ✓
- T3 : qualityPrior élevé (0.95) bat profileScore légèrement supérieur (0.85 vs 0.80) avec qualityPrior faible (0.1) ✓
- T4 : candidat disliked avec profileScore=1.0 exclu, second candidat sélectionné ✓
- T5 : candidat unavailable exclu avant ranking ✓
- T6 : candidat sans backdrop exclu ✓
- T8 : tous les candidats sans backdrop → null ✓
- T9 : calcul arithmétique de `computeHeroScore` vérifié avec précision ✓

---

### Problèmes détectés

#### BLOQUANT — Test #7 : fixture incorrecte, requirement #5 non vérifié

**Localisation :** `hero-selector.test.ts:387–408`

**Ticket requirement #5 :** "Foreign-language content can still win when it is genuinely the best candidate."

**Ce que le test affirme tester :**
```
'test 7: foreign-language content wins when its heroScore is highest (no language hard-filter)'
```

**Ce que le test fait réellement :**

```typescript
// A = "Parasite" (présenté comme contenu étranger)
//   profileScore: 0.85, languageAffinity: 0.95  ← HIGH
// B = "Domestic Film"
//   profileScore: 0.75, languageAffinity: 0.10  ← LOW
```

Le problème : assigner `languageAffinity: 0.95` à "Parasite" (contenu supposément en langue étrangère) est sémantiquement contradictoire. Un contenu en langue étrangère *par rapport à la préférence de l'utilisateur* devrait avoir un `languageAffinity` **bas** (ex: 0.1–0.2). Avec `languageAffinity: 0.95`, le test prouve simplement que le candidat au score total le plus élevé gagne — ce qui n'a aucun rapport avec la problématique langue étrangère.

Ce qui doit être prouvé par ce test :

> Un contenu étranger (faible `languageAffinity`) peut néanmoins gagner si son score personnalisé est suffisamment fort pour compenser — i.e., qu'il n'y a pas de hard-filter par langue.

**Fixture correcte :**
```typescript
// A = "Parasite" (langue étrangère pour l'utilisateur)
//   profileScore: 0.92, languageAffinity: 0.10, semanticScore: 0.8, qualityPrior: 0.9
//   heroScore = 0.45*0.92 + 0.25*0.8 + 0.20*0.9 + 0.10*0.10 = 0.414 + 0.20 + 0.18 + 0.01 = 0.804  ← winner
// B = "Film domestique" (langue de l'utilisateur)
//   profileScore: 0.65, languageAffinity: 0.90, semanticScore: 0.6, qualityPrior: 0.5
//   heroScore = 0.45*0.65 + 0.25*0.6 + 0.20*0.5 + 0.10*0.90 = 0.2925 + 0.15 + 0.10 + 0.09 = 0.6325
```

Avec cette fixture, A gagne **malgré** un `languageAffinity` bas (0.10), ce qui prouve réellement l'absence de hard-filter. **Le test actuel ne prouve pas ce qu'il dit.**

---

#### OBSERVATION — HERO_SCORE_WEIGHTS non individuellement configurables via env

**Localisation :** `env.ts:144–150`

```typescript
export const HERO_SCORE_WEIGHTS = {
  version: 'v1',
  profileRelevance: 0.45,
  semanticConfidence: 0.25,
  qualityPrior: 0.20,
  languageAffinity: 0.10,
} as const
```

Les poids individuels sont hardcodés (non lisibles depuis des env vars). Seuls `HERO_MIN_SCORE` et `HERO_POOL_SIZE` sont env-configurables. Le ticket demande "versioned/configurable" — le versioning est satisfait (`v1`), mais la configurabilité des poids individuels nécessite un déploiement. Acceptable pour v1, mais la promesse "configurable" est partiellement tenue.

Non-bloquant : une décision de ne pas env-ifier les poids est défendable pour éviter la complexité opérationnelle, et cela peut être adressé en follow-up.

---

#### OBSERVATION — Pas de test explicite pour le gate "media type"

Le ticket liste "media type supported by Home hero" comme gate d'éligibilité. L'implémentation le gère implicitement (les types non supportés comme `'EPISODE'` ne seront pas trouvés dans les tables `movies` ou `series`, donc exclus de `enrichMap`). Aucun test ne couvre explicitement ce scénario.

Non-bloquant pour cette itération, mais recommandé pour compléter la suite de tests.

---

### Risques éventuels

- **Aucun risque de sécurité identifié** : le logging `[HERO_RANKING]` n'expose pas de données sensibles (mediaId, titre, scores numériques).
- **Aucun hardcoding pays/titre** détecté — conforme au ticket.
- **Snapshot stability** : comportement 24h préservé, tests dédiés passent.
- **Dislike fetch failure** : si la requête DB de dislike lève une exception, `selectHero()` rejetterait. L'appelant (`home-pool-service.ts`) le catch avec `console.error` et continue avec `hero = null`. Comportement acceptable.

---

### Décision

L'implémentation core est solide et couvre correctement les requirements 1–4, 6–9. Le requirement #5 (langue étrangère) est couvert par la logique mais le test #7 ne le vérifie pas réellement : la fixture donne une forte `languageAffinity` au candidat "étranger", invalidant le scénario de test. Ce test doit être corrigé avant approbation.

**Action demandée :**

Corriger `hero-selector.test.ts:387–408` pour utiliser une fixture où le candidat "étranger" a un `languageAffinity` faible (≤ 0.2) et gagne grâce à son `profileScore` élevé, prouvant que la langue n'agit pas comme hard-filter.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T127/reviews/implementation-review.md
- generated at: 2026-08-24T09:52:47Z

---

I have a thorough picture of the implementation. Let me write the structured review.

---

## PR Review — T127: Build a true must-watch Hero ranker for Home

### Résumé

L'implémentation introduit un `hero-selector.ts` dédié avec une formule de scoring explicite, intégrée dans `home-pool-service.ts`, avec persistance dans le snapshot existant. L'architecture est propre et cohérente avec le ticket. **Un problème bloquant a été détecté sur la couverture de test du requirement #5 (langue étrangère).**

---

### Vérifications effectuées

- Lecture complète de `hero-selector.ts` (143 lignes)
- Lecture complète de `hero-selector.test.ts` (470 lignes)
- Vérification de `env.ts` (HERO_MIN_SCORE, HERO_POOL_SIZE, HERO_SCORE_WEIGHTS)
- Vérification de l'intégration dans `home-pool-service.ts`
- Vérification de la persistance dans `home-snapshot-service.ts`
- Lecture des tests de stabilité snapshot dans `home-snapshot.test.ts`
- Vérification du type `ShelfCandidateItem` dans `recommendation-engine-client.ts`

---

### Points validés

**Architecture et formule**
- `computeHeroScore()` est une pure function explicite, testable isolément.
- Formule: `0.45·profileScore + 0.25·semanticScore + 0.20·qualityPrior + 0.10·languageAffinity` — poids normalisés (somme = 1.0), `profileRelevance` dominant à 45% conformément au ticket.
- Version `v1` labellisée dans `HERO_SCORE_WEIGHTS`.
- `HERO_MIN_SCORE` (0.55) et `HERO_POOL_SIZE` (15) sont env-configurables.

**Logique de sélection**
- Pool de 15 candidats évalués, tri par `heroScore` descendant, sélection du meilleur (`ranked[0]`).
- Portes d'éligibilité séquentielles correctes : `available` + `finalScore >= HERO_MIN_SCORE` → dislikes → `title` + `backdropUrl`.
- Retourne `null` si aucun candidat passe — ticket requirement "no hero" respecté.
- Les candidats sans backdrop dans la DB tombent silencieusement de `enrichMap` → exclusion implicite mais correcte.

**Intégration home-pool-service.ts**
- `selectHero()` appelé avant de filtrer le rail "Pour toi" → exclusion du hero du rail pour éviter les doublons.
- Erreur de sélection du hero catchée avec `console.error`, fallback sur `null` sans crasher — robuste.

**Persistance snapshot**
- `heroMediaId` / `heroMediaType` stockés dans le schema `homeDiscoverySnapshots`.
- Chemin HIT : hero reconstruit depuis le snapshot sans re-sélection (`buildDeclaredRails` non appelé).
- Tests de stabilité vérifient deux `buildHome()` consécutifs → même `hero.mediaId`.

**Observabilité**
- Log `[HERO_RANKING]` complet avec pool size, eligible count, winner mediaId+title, heroScore formaté 3 décimales, version des poids, et tableau complet de chaque candidat avec tous les scores et le flag `selected`.
- Répond à toutes les exigences de debug du ticket.

**Tests T1–T6, T8–T9**
- T1 : candidat C (profileScore=0.9, position 3) bat A (position 1, profileScore=0.6) ✓
- T2 : candidat en position 7/10 (profileScore=0.95) bat les 6 précédents ✓
- T3 : qualityPrior élevé (0.95) bat profileScore légèrement supérieur (0.85 vs 0.80) avec qualityPrior faible (0.1) ✓
- T4 : candidat disliked avec profileScore=1.0 exclu, second candidat sélectionné ✓
- T5 : candidat unavailable exclu avant ranking ✓
- T6 : candidat sans backdrop exclu ✓
- T8 : tous les candidats sans backdrop → null ✓
- T9 : calcul arithmétique de `computeHeroScore` vérifié avec précision ✓

---

### Problèmes détectés

#### BLOQUANT — Test #7 : fixture incorrecte, requirement #5 non vérifié

**Localisation :** `hero-selector.test.ts:387–408`

**Ticket requirement #5 :** "Foreign-language content can still win when it is genuinely the best candidate."

**Ce que le test affirme tester :**
```
'test 7: foreign-language content wins when its heroScore is highest (no language hard-filter)'
```

**Ce que le test fait réellement :**

```typescript
// A = "Parasite" (présenté comme contenu étranger)
//   profileScore: 0.85, languageAffinity: 0.95  ← HIGH
// B = "Domestic Film"
//   profileScore: 0.75, languageAffinity: 0.10  ← LOW
```

Le problème : assigner `languageAffinity: 0.95` à "Parasite" (contenu supposément en langue étrangère) est sémantiquement contradictoire. Un contenu en langue étrangère *par rapport à la préférence de l'utilisateur* devrait avoir un `languageAffinity` **bas** (ex: 0.1–0.2). Avec `languageAffinity: 0.95`, le test prouve simplement que le candidat au score total le plus élevé gagne — ce qui n'a aucun rapport avec la problématique langue étrangère.

Ce qui doit être prouvé par ce test :

> Un contenu étranger (faible `languageAffinity`) peut néanmoins gagner si son score personnalisé est suffisamment fort pour compenser — i.e., qu'il n'y a pas de hard-filter par langue.

**Fixture correcte :**
```typescript
// A = "Parasite" (langue étrangère pour l'utilisateur)
//   profileScore: 0.92, languageAffinity: 0.10, semanticScore: 0.8, qualityPrior: 0.9
//   heroScore = 0.45*0.92 + 0.25*0.8 + 0.20*0.9 + 0.10*0.10 = 0.414 + 0.20 + 0.18 + 0.01 = 0.804  ← winner
// B = "Film domestique" (langue de l'utilisateur)
//   profileScore: 0.65, languageAffinity: 0.90, semanticScore: 0.6, qualityPrior: 0.5
//   heroScore = 0.45*0.65 + 0.25*0.6 + 0.20*0.5 + 0.10*0.90 = 0.2925 + 0.15 + 0.10 + 0.09 = 0.6325
```

Avec cette fixture, A gagne **malgré** un `languageAffinity` bas (0.10), ce qui prouve réellement l'absence de hard-filter. **Le test actuel ne prouve pas ce qu'il dit.**

---

#### OBSERVATION — HERO_SCORE_WEIGHTS non individuellement configurables via env

**Localisation :** `env.ts:144–150`

```typescript
export const HERO_SCORE_WEIGHTS = {
  version: 'v1',
  profileRelevance: 0.45,
  semanticConfidence: 0.25,
  qualityPrior: 0.20,
  languageAffinity: 0.10,
} as const
```

Les poids individuels sont hardcodés (non lisibles depuis des env vars). Seuls `HERO_MIN_SCORE` et `HERO_POOL_SIZE` sont env-configurables. Le ticket demande "versioned/configurable" — le versioning est satisfait (`v1`), mais la configurabilité des poids individuels nécessite un déploiement. Acceptable pour v1, mais la promesse "configurable" est partiellement tenue.

Non-bloquant : une décision de ne pas env-ifier les poids est défendable pour éviter la complexité opérationnelle, et cela peut être adressé en follow-up.

---

#### OBSERVATION — Pas de test explicite pour le gate "media type"

Le ticket liste "media type supported by Home hero" comme gate d'éligibilité. L'implémentation le gère implicitement (les types non supportés comme `'EPISODE'` ne seront pas trouvés dans les tables `movies` ou `series`, donc exclus de `enrichMap`). Aucun test ne couvre explicitement ce scénario.

Non-bloquant pour cette itération, mais recommandé pour compléter la suite de tests.

---

### Risques éventuels

- **Aucun risque de sécurité identifié** : le logging `[HERO_RANKING]` n'expose pas de données sensibles (mediaId, titre, scores numériques).
- **Aucun hardcoding pays/titre** détecté — conforme au ticket.
- **Snapshot stability** : comportement 24h préservé, tests dédiés passent.
- **Dislike fetch failure** : si la requête DB de dislike lève une exception, `selectHero()` rejetterait. L'appelant (`home-pool-service.ts`) le catch avec `console.error` et continue avec `hero = null`. Comportement acceptable.

---

### Décision

L'implémentation core est solide et couvre correctement les requirements 1–4, 6–9. Le requirement #5 (langue étrangère) est couvert par la logique mais le test #7 ne le vérifie pas réellement : la fixture donne une forte `languageAffinity` au candidat "étranger", invalidant le scénario de test. Ce test doit être corrigé avant approbation.

**Action demandée :**

Corriger `hero-selector.test.ts:387–408` pour utiliser une fixture où le candidat "étranger" a un `languageAffinity` faible (≤ 0.2) et gagne grâce à son `profileScore` élevé, prouvant que la langue n'agit pas comme hard-filter.

IMPLEMENTATION_FIX_REQUIRED