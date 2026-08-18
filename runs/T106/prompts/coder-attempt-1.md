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


# T106 — Persist ShelfConcept/ShelfInstance history and item-level feedback for recommendation learning

**Source**: GitHub Issue #209

## Description

## Context
#203 captures profile interaction events and #208 generates personalized shelf concepts. To improve shelf quality over time we must persist exactly which shelves were generated, which items were actually shown, what scores/models produced them, and how the Profile reacted.

A shelf title string alone is not enough. We need durable recommendation exposure/history so future concept generation and ranking can distinguish:
- bad shelf concept;
- good concept but weak item selection;
- good selection shown too low on Home;
- repeatedly ignored content;
- content opened/played/completed from a specific shelf.

## Goal
Create the durable recommendation-history layer linking concept -> generated shelf instance -> item positions/scores -> real profile feedback.

## 1. Reuse existing event groundwork
Reuse #203 interaction/event architecture. Do not create a second disconnected analytics universe.

The recommendation-history models should provide stable IDs referenced by events such as `SHELF_IMPRESSION`, `SHELF_ITEM_OPENED`, `PLAY_STARTED`, etc.

## 2. ShelfConcept vs ShelfInstance
Keep the semantic concept separate from each concrete rendering/generation.

Example:
```text
ShelfConcept
  "SF qui fait réfléchir"
       ↓
ShelfInstance #A on Aug 18
ShelfInstance #B on Aug 24 with newer ranking/profile
```

A `ShelfInstance` should persist enough context such as:
- id;
- profileId;
- shelfConceptId;
- title rendered;
- semantic/query intent snapshot or query-plan reference/version;
- generationType/exploration class;
- generationReason(s);
- createdAt;
- firstDisplayedAt;
- lastDisplayedAt if reused;
- Home/session/cursor batch identity;
- vertical position when displayed;
- recommendation model/ranker version;
- query planner/prompt/model version;
- embedding model/index version;
- candidate count;
- final item count;
- latency/cache status;
- expiration/staleness metadata.

## 3. Shelf item snapshot
Persist concrete ordered items for every generated/displayed ShelfInstance.

Suggested:
```text
ShelfInstanceItem
- shelfInstanceId
- mediaType
- mediaId
- rankPosition
- semanticScore
- profileScore
- finalScore
- diversityAdjustment
- availabilityScore/status snapshot
- reasonCodes
- wasEligibleAtGeneration
```

Do not copy entire TMDB rows into snapshots.

The purpose is to reconstruct why item X was ranked #3 at that moment even if ranking weights/catalog state later change.

## 4. Exposure / visibility
Distinguish `generated` from `actually presented` and `actually visible`.

Track meaningful visibility semantics:
- shelf returned to client;
- shelf reached/visible past a threshold;
- item rendered;
- item meaningfully visible;
- item opened;
- item played.

Do not emit events for every scroll pixel.

Define sensible thresholds, e.g. shelf/item visible for N ms / percentage of viewport, configurable where needed.

## 5. Outcome attribution
Attribute downstream behavior back to the originating ShelfInstance/Item when possible:
- detail opened;
- trailer preview;
- play started;
- meaningful playback milestone;
- completion;
- My List added;
- like/dislike;
- quick abandon.

If user later accesses the same media through search/details independently, do not incorrectly attribute that later action to the shelf forever. Use session/referrer attribution windows.

## 6. Shelf performance aggregates
Create recomputable aggregate metrics per Profile + Concept and optionally globally:
- impressions;
- reached/visible rate;
- item open rate;
- play-through rate;
- meaningful watch rate;
- completion-after-play rate;
- My List add rate;
- quick-abandon rate;
- average rank position clicked;
- repeated-ignore count;
- freshness/novelty performance.

Keep raw durable history so metrics can be recomputed when definitions change.

## 7. Concept fatigue / suppression
Provide deterministic data for #208 to know that a concept has been overused or ignored.

Examples:
- same/near-identical concept shown 5 times in 2 weeks;
- zero interactions across repeated visible impressions;
- repeated item overlap;
- concept recently performed very well and can be refreshed with new items;
- concept performed poorly and should cool down.

Persist cooldown/suppression decisions with reason/version rather than deleting history.

## 8. Content exposure memory
For each Profile maintain efficient ability to answer:
- which media has been shown recently on Home;
- how many times;
- in which concepts;
- whether ignored/opened/played;
- last exposure time.

This supports #207 `recentExposurePenalty` and prevents the same 20 titles appearing in every shelf.

## 9. Recommendation session / Home session
Introduce a stable session/batch identity for one Home browsing session or cursor chain so global de-duplication can reason across shelves in the same session.

Example:
```text
RecommendationHomeSession
- id
- profileId
- startedAt
- expiresAt
- modelVersion
- seenMediaIds / derived exposure refs
- cursor state/reference
```

Do not store giant unbounded arrays if normalized relations/queries are cleaner.

## 10. Experiment/version readiness
Persist experiment/model versions so future A/B evaluation can compare ranking/query strategies.

At minimum make it possible to answer:
`Did reranker v3 outperform v2 for similar shelf concepts?`

No full experiment platform is required yet.

## 11. Admin/Lab diagnostics
In Recommendation Lab allow inspection of:
- recent shelves for a selected Profile;
- concept + generated items;
- all per-item scores;
- which items were actually visible/opened/played;
- resulting shelf performance;
- concept cooldown/fatigue status;
- model/query/embedding versions.

## 12. Retention
Shelf history is valuable but can grow.

Define retention/compaction:
- keep high-level Concept/Instance/outcome data long-term enough to learn;
- preserve high-value outcomes;
- compact low-value raw visibility telemetry after aggregation when safe;
- indexes for profile/time/concept/media.

Do not delete recent exposure memory needed by ranking.

## Acceptance criteria
- [ ] ShelfConcept and concrete ShelfInstance are distinguishable and linked.
- [ ] Every generated shelf can persist ordered item snapshots + scores/reasons.
- [ ] Generated vs displayed vs visible are distinguishable.
- [ ] Item clicks/plays/outcomes can be attributed to originating shelf within defined rules.
- [ ] Profile-level shelf performance can be recomputed from history.
- [ ] Recent content exposure is efficiently queryable for reranking/deduplication.
- [ ] Concept fatigue/cooldown can be derived and supplied to #208.
- [ ] Recommendation Home/session identity supports cross-shelf deduplication.
- [ ] Model/query/embedding versions are stored for reproducibility.
- [ ] Lab can inspect real shelf history and score/outcome traces.
- [ ] Data growth/retention strategy exists.

## Completion rule
Do not close because tables exist. Generate and display several real shelves for a test Profile, interact with different items, and prove the Lab/history can reconstruct: which concept was shown, item ordering/scores, visibility, which item was opened/played, and the resulting profile-level performance/exposure state.