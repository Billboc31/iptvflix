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

# Role — Reviewer

## Mission

Vérifier qu’une implémentation respecte :
- le ticket
- le plan
- les conventions
- l’architecture
- les contraintes sécurité/qualité

## Tu dois

- détecter les dérives de scope
- détecter les violations architecture
- vérifier les impacts potentiels
- vérifier la cohérence mémoire/documentation
- proposer des corrections concrètes

## Tu ne dois pas

- réécrire complètement le code
- introduire un nouveau scope
- accepter des comportements implicites dangereux

## Sortie attendue

Une review structurée conforme à `ai/templates/pr-review-template.md`.

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

# Generic Review Task

Read the ticket below and review the implementation produced for it.

The review must cover:
- correctness relative to the ticket requirements
- scope compliance
- code quality and safety
- blocking issues vs minor observations

The ticket follows.


# T114 — Use full ProfileTaste and interaction signals in recommendation ranking

**Source**: GitHub Issue #241

## Description

## Context

IPTVFlix already persists rich per-profile behavior and builds a rich `ProfileTaste`, but the standalone recommendation-engine currently consumes only a subset of it (primarily genre scores, positive/negative media IDs and signal count).

Existing taste data includes useful signals such as:
- person/credit scores;
- keyword/theme scores;
- franchise/collection scores;
- language scores;
- country scores;
- decade scores;
- movie/series preference;
- completion rate;
- positive/negative media IDs;
- explicit feedback;
- progress/completion/watchlist history;
- profile interaction history and exposure.

## Goal

Make the standalone recommendation-engine actually use the full persisted profile behavior for planning and ranking, so user actions influence future shelves end-to-end.

## Required work

- Extend the engine taste-loading contract/schema to load the full `profile_taste` payload.
- Feed useful compact signals to the LLM Query Planner, including:
  - top genres;
  - top keywords/themes;
  - liked people/directors/actors where available;
  - franchises/collections;
  - languages/countries;
  - preferred decades;
  - movie vs series preference;
  - meaningful negative signals.
- Replace the current empty `likedPeople` planner context with real ranked people data.
- Extend hybrid reranking to use appropriate signals from:
  - genre affinity;
  - keyword/theme affinity;
  - people affinity;
  - franchise affinity;
  - language/country preference;
  - decade preference;
  - media type preference;
  - explicit positive/negative media history;
  - completion behavior;
  - exposure/repetition penalties.
- Keep weights versioned and observable in score breakdown/provenance.
- Explicit negative feedback (`DISLIKE`, `NOT_INTERESTED`) must have a stronger negative effect than merely skipping/exposure.
- Continue Watching/progress itself should not naively make every partially watched title a strong positive signal; preserve existing weighting semantics or improve them deliberately.
- Ensure episode viewing contributes to the parent series taste as intended.
- Keep all learning isolated per Profile, never per Account globally unless explicitly designed later.

## Interaction persistence audit

Audit all user-facing actions and document which canonical event/state is persisted and whether it feeds taste/ranking. At minimum cover:
- play started;
- meaningful watch progress;
- completed;
- resume;
- like;
- dislike;
- not interested;
- add/remove My List;
- search;
- shelf impression/exposure;
- item click/open detail;
- play from shelf;
- dismiss/remove from Continue Watching where applicable.

Do not invent positive taste from UI actions that do not semantically mean preference; classify each signal explicitly.

## Acceptance criteria

- [ ] Full ProfileTaste is readable by standalone recommendation-engine.
- [ ] Query Planner receives real people/theme/preference context rather than only top genres.
- [ ] Hybrid ranker consumes multiple rich taste dimensions with versioned weights.
- [ ] Explicit dislikes/not-interested materially suppress related titles.
- [ ] Profile A and Profile B with different histories produce materially different rankings for the same semantic query.
- [ ] Episode history affects the parent series taste correctly.
- [ ] Interaction persistence audit exists and gaps are fixed or tracked.
- [ ] Score breakdown explains which profile signals affected a result.
- [ ] No profile data leaks between profiles/accounts.

## Completion rule

Use at least two real profiles with different interaction histories and run the same semantic query through the live engine. Demonstrate and document materially different ranking/order and the score breakdown that caused it.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
