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


# T050 — Add secure Web playback flow from selected Availability

**Source**: GitHub Issue #99

## Description

## Objective

Allow a user to start actual Movie/Episode playback from the Web app using the backend-selected Availability while keeping provider-specific playback details and credentials contained as safely as possible.

## Context / Problem

IPTVFlix can now normalize multiple source/language/quality variants and deterministically select the preferred Availability, but actual playback was intentionally deferred. A hosted Web test should support the complete flow from Media detail/recommendation to Play.

Xtream/M3U playback references may contain sensitive source credentials. The implementation must not simply expose stored provider secrets through generic catalog APIs or logs.

## Included

- Add a backend playback-resolution boundary that accepts canonical Movie/Episode identity (and optional explicit availability choice) and revalidates the requested Availability server-side.
- Reuse the existing profile best-availability resolver for default playback selection.
- Resolve provider-specific playback information inside the provider/availability layer for Xtream and any already-supported provider where practical.
- Define an explicit playback descriptor/session contract for clients; avoid adding raw credentials to general Media/Availability DTOs.
- Add a Web player experience with play/resume, basic loading/error states and manual variant selection when alternatives exist.
- Integrate viewing-progress updates with the existing profile progress/Continue Watching model.
- Ensure unavailable/stale/disabled-source variants cannot be launched.
- Avoid logging credential-bearing playback URLs/tokens.
- Design the contract so Android TV/Media3 can consume the same backend playback resolution later.

## Acceptance Criteria

- [ ] Clicking Play on a playable Movie resolves and starts the profile-preferred currently available variant.
- [ ] A playable Episode can be launched from the Series/Episode experience.
- [ ] The user can explicitly choose another valid availability/variant when alternatives exist.
- [ ] Disabled, stale or unavailable variants are rejected server-side even if the client submits their ids.
- [ ] Provider secrets are not added to general catalog/detail responses or logs.
- [ ] Playback progress updates the existing Continue Watching state and resume starts from stored progress where supported.
- [ ] Playback-resolution failures produce a usable UI error rather than exposing provider internals.
- [ ] Tests cover preferred selection, explicit variant, invalid/stale availability, progress and secret redaction.

## Excluded / Out of scope

- DRM-protected commercial streaming providers.
- Adaptive transcoding infrastructure.
- Full Android TV player implementation.
- Live TV.

## Dependencies

Requires the existing Availability resolver and should depend on #95 for a public hosted deployment so playback/source endpoints are not anonymously exposed.