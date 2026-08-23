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


# T124 — Prevent profile boosts from overpowering core shelf intent

**Source**: GitHub Issue #264

## Description

## Context

Following #260 and #262, the benchmark shelf **« Aventures à travers le temps »** is now substantially better: the top results are genuine temporal/time-travel titles such as `Time Trap`, `The Time Travelers`, `The Time Machine`, `Timescape: Back to the Dinosaurs` and `The Visitor from the Future`.

However, some candidates with weaker thematic relevance can still climb too high because profile-affinity boosts reward broad genres such as adventure/drama.

Observed examples include `The Hobbit: An Unexpected Journey`, `Hors limites` and `Journey to the Center of the Earth` ranking relatively high despite not matching the core temporal intent as strongly as genuine time-travel candidates.

## Problem

Personalization should **rank relevant candidates according to user taste**, not compensate for insufficient relevance to the shelf's defining concept.

A candidate with strong user-profile affinity but weak core thematic relevance should not overtake a substantially more relevant candidate simply because its genres/language/era match the user profile.

## Goal

Make profile boosts explicitly bounded by the candidate's relevance to the **core shelf intent**.

The solution must be generic and work for any thematic/compound shelf, not just time travel.

Conceptually:

> semantic/thematic relevance determines whether a movie belongs near the top of the shelf; personalization then orders candidates within that relevant set.

## Expected direction

Investigate the hybrid reranker and introduce a generic relevance-aware cap/gating/attenuation mechanism for personalization boosts.

Possible approaches include:
- scale maximum profile boost by semantic/core-intent relevance;
- use relative relevance to the strongest candidates as a gate;
- attenuate profile signals sharply below a thematic relevance threshold/band;
- distinguish core-intent relevance from secondary genre affinity when available.

Choose the most robust implementation based on the existing architecture rather than hardcoding thresholds or movie/shelf names solely for this benchmark.

## Acceptance criteria

- Highly relevant candidates can still be reordered meaningfully by personalization.
- Strong profile affinity cannot promote a substantially off-theme candidate above clearly stronger core-intent matches.
- On **« Aventures à travers le temps »**, genuine temporal/time-travel candidates should dominate the leading positions; generic adventure matches such as `The Hobbit: An Unexpected Journey` must not be promoted mainly by `strong adventure genre affinity`.
- Validate against at least 3 additional shelf concepts, including broader shelves where personalization should remain influential.
- Do not regress the improvements from #260/#262.
- No shelf-specific/movie-specific hardcoding.
- No manual production database modifications.
- Add regression tests demonstrating both sides: protection of precise thematic intent and preservation of useful personalization on broad shelves.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
