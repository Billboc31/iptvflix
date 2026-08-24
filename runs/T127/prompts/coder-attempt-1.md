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