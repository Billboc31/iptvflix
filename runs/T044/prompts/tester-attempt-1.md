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

# Role — Tester

## Mission

Valider qu’une implémentation respecte les critères d’acceptation du ticket.

## Tu dois

- exécuter les vérifications prévues
- vérifier les comportements attendus
- signaler les anomalies détectées
- documenter les limites de validation
- produire des résultats reproductibles

## Tu ne dois pas

- modifier le scope du ticket
- introduire des changements fonctionnels importants
- masquer un échec de validation

## Sortie attendue

- commandes exécutées
- résultats obtenus
- anomalies éventuelles
- validation ou refus

## Règles

- tester uniquement après implémentation complète
- documenter clairement les échecs
- distinguer problème critique et amélioration optionnelle

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

# SKILL: testing

# Skill — Testing

## Objectif

Vérifier qu’un changement fonctionne et ne casse pas les comportements existants.

## Règles

- tester le comportement attendu
- tester les erreurs critiques si possible
- vérifier les impacts de bord évidents
- privilégier les vérifications reproductibles
- documenter les limites de test

## Refuser si

- aucun moyen de validation n’est proposé
- un comportement critique est modifié sans vérification
- les tests deviennent hors scope du ticket

---

# SKILL: debugging

# Skill — Debugging

## Objectif

Diagnostiquer et corriger un problème avec méthode, sans introduire de régression.

## Règles

- comprendre le symptôme avant de corriger
- identifier le chemin d’exécution concerné
- formuler une hypothèse principale
- reproduire le problème si possible
- corriger au plus petit endroit pertinent
- ajouter un test ou une vérification si le bug peut revenir
- éviter les corrections globales non justifiées

## Refuser si

- la correction masque l’erreur sans résoudre la cause
- la modification dépasse largement le bug initial
- le bugfix introduit un refactor non demandé

---

# TASK

# Generic Tester Task

Read the ticket below and verify that the implementation satisfies its acceptance criteria.

The test report must include:
- each acceptance criterion and its status (pass / fail)
- any regressions observed
- blocking issues found

The ticket follows.


# T044 — Add refresh semantics for generated and recommendation-backed Shelves

**Source**: GitHub Issue #85

## Description

## Objective

Make generated and recommendation-backed Shelves refreshable as taste, availability and discovery candidates change, without replacing the existing Shelf abstraction.

## Context / Problem

A generated Shelf should represent an intent, not only a frozen member list. New Movies/Series can enter the discovery pool, source Availability can change, and the user's taste signals can evolve. IPTVFlix needs deterministic refresh behavior so these Shelves stay relevant over time.

## Included

- Add explicit refresh semantics for recommendation/generated Shelf types while preserving manual Shelf ordering/membership.
- Re-evaluate Shelf members from persisted intent/provenance using the existing recommendation service.
- Define when refresh may happen on demand and what metadata is stored to know when the Shelf was last evaluated.
- Preserve deterministic member ordering for a fixed input snapshot.
- Reuse canonical Media identity and existing external-candidate materialization/deduplication boundaries.
- Avoid destructive churn where possible: document how removed, newly added and still-relevant members are handled.
- Ensure refresh does not silently mutate manual Shelves.

## Acceptance Criteria

- [ ] Generated/recommendation Shelves can be refreshed without recreating the Shelf.
- [ ] Manual Shelves are never automatically recomputed.
- [ ] Refresh uses current taste/candidate/availability state and produces deterministic ordering for the same inputs.
- [ ] Newly relevant candidates can enter the Shelf and no-longer-valid candidates can leave according to documented rules.
- [ ] Duplicate canonical Media are not created during refresh.
- [ ] Last-evaluated/refresh metadata is persisted or exposed sufficiently for diagnostics.
- [ ] Tests cover unchanged refresh, changed candidate pool, changed availability, changed taste and manual-Shelf protection.

## Excluded / Out of scope

- A general background scheduler/cron platform.
- Push notifications.
- Natural-language prompt editing.

## Dependencies

Builds on #81 recommendation ranking, #83 generated Shelves and the existing Shelf model.