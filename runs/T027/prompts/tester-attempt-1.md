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


# T027 — Wire source availability lifecycle into idempotent release events

**Source**: GitHub Issue #52

## Description

## Objective

Ensure source appearance/disappearance events are actually recorded when canonical availability changes, so Follow Release can later notify users reliably without duplicating events on every synchronization.

## Context / Problem

The release lifecycle domain defines `SOURCE_APPEARED` and `SOURCE_DISAPPEARED` events, but the current catalog synchronization path updates availability status/firstSeenAt/lastSeenAt without integrating those transitions into the release-event timeline.

As a result, Follow Release can persist the user's intent but lacks durable source-arrival events needed for the core `never miss a movie again` behavior.

## Included

- Connect canonical availability state transitions to the existing release lifecycle event service.
- Record `SOURCE_APPEARED` when a Media becomes available on a configured source for the first time or reappears after being unavailable.
- Record `SOURCE_DISAPPEARED` when a previously AVAILABLE mapping becomes unavailable through an authoritative source synchronization.
- Preserve provider/source identity on the event.
- Make event creation idempotent across repeated identical synchronizations.
- Avoid producing appearance events merely because metadata was refreshed or `lastSeenAt` changed.
- Ensure zero-availability Media can later transition into `available to me` with a corresponding durable event.
- Apply the behavior consistently to Movies and, once authoritative episode synchronization exists, Episodes where the release lifecycle model supports it.

## Acceptance Criteria

- [ ] First transition from no current availability to AVAILABLE records exactly one `SOURCE_APPEARED` event for the source.
- [ ] Re-running an unchanged synchronization does not create duplicate appearance events.
- [ ] Transition from AVAILABLE to UNAVAILABLE records exactly one `SOURCE_DISAPPEARED` event.
- [ ] Reappearance after disappearance records a new `SOURCE_APPEARED` event reflecting the new transition.
- [ ] Metadata refreshes without availability-state change do not create source lifecycle events.
- [ ] Event source identity is preserved and no provider credentials/secret URLs are stored in lifecycle data.
- [ ] Follow Release timeline APIs expose these events correctly.
- [ ] Automated tests cover first appearance, unchanged resync, disappearance and reappearance.

## Excluded / Out of scope

- Sending push/email/browser notifications.
- Predicting future provider availability.
- Commercial streaming availability aggregation.

## Dependencies

Builds on the existing release lifecycle service and canonical availability synchronization. Episode events depend on authoritative episode lifecycle handling.