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


# T052 — Surface followed-media arrivals and newly available items in the Web app

**Source**: GitHub Issue #101

## Description

## Objective

Turn the existing follow-release and source availability lifecycle into a visible user feature so IPTVFlix clearly shows when a followed/upcoming Movie or Series becomes available on one of the user's sources.

## Context / Problem

IPTVFlix already tracks followed media and source appearance/disappearance events. Once automatic synchronization is added, these transitions can happen in the background. The user needs a clear product surface for “this thing I wanted is now available to me” instead of requiring manual catalog searching.

## Included

- Build a profile-scoped arrival/activity surface based on existing durable release/source lifecycle events rather than re-detecting availability in the frontend.
- Highlight followed media that transitioned to available on a configured source.
- Include enough context to understand what arrived and where, without duplicating provider-specific catalog cards.
- Add read/dismiss semantics so the same arrival does not behave like a permanent unread alert.
- Surface recent arrivals on Home and/or a dedicated activity/radar area consistent with the existing design.
- Link arrival items to canonical detail/play actions.
- Preserve events across restarts and avoid duplicate notifications for repeated idempotent syncs.
- Keep future push/email/mobile delivery as an extension point; this ticket is the in-product Web experience.

## Acceptance Criteria

- [ ] When a followed Media transitions from not available to available on a configured source, one user-visible arrival item is created/exposed.
- [ ] Repeated syncs with no new transition do not create duplicate arrival items.
- [ ] Reappearance after a genuine disappearance can produce a new meaningful arrival according to documented semantics.
- [ ] Arrival items identify the canonical Media and relevant source without duplicating the Media identity.
- [ ] Users can mark arrivals read/dismissed and that state persists.
- [ ] Recent unread arrivals are discoverable from the Web UI and link to the Media detail/play flow.
- [ ] Non-followed source appearances do not flood the followed-arrivals inbox unless explicitly presented in a separate “new on your sources” surface.
- [ ] Automated tests cover first arrival, duplicate sync, read/dismiss and disappearance/reappearance.

## Excluded / Out of scope

- Native mobile push notifications.
- Email/SMS notifications.
- Browser push permissions/service workers.

## Dependencies

Consumes the existing follow-release/source lifecycle model. Benefits from #100 automatic synchronization; can implement the event/read model in parallel and become fully useful once scheduling is active.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
