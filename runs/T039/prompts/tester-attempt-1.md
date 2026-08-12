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


# T039 — Add explicit like, dislike and not-interested feedback signals

**Source**: GitHub Issue #79

## Description

## Objective

Capture explicit user preference signals that can complement watchlist/history/progress when building a reliable taste profile and recommendation engine.

## Context / Problem

IPTVFlix already stores watchlist and viewing-progress/history signals (#23), but those actions do not always mean the user liked the content. The recommendation layer needs an explicit way to distinguish positive preference, negative preference and simple lack of interest.

## Included

- Add profile-scoped explicit feedback for canonical Movies/Series with at least `LIKE`, `DISLIKE` and `NOT_INTERESTED` semantics.
- Ensure only one current explicit preference state exists per profile/media while preserving deterministic updates/removal.
- Expose canonical API operations to set, change and clear feedback.
- Add lightweight web controls on relevant media detail/card surfaces without coupling recommendation logic to the frontend.
- Keep feedback independent from Watchlist, Follow Release and viewing progress.
- Preserve enough timestamps/provenance for downstream taste/recommendation scoring.

## Acceptance Criteria

- [ ] A profile can like, dislike, mark not interested, change or clear feedback for a Movie/Series.
- [ ] Explicit feedback survives restart and references canonical Media identity only.
- [ ] Watchlist/follow/progress are not implicitly modified when feedback changes.
- [ ] Repeated identical updates are idempotent.
- [ ] API validates profile/media references server-side.
- [ ] Web UI reflects current feedback state and supports changing it.
- [ ] Tests cover all feedback transitions, profile isolation and independence from existing user-state features.

## Excluded / Out of scope

- Recommendation scoring itself.
- Star ratings or free-text reviews.
- Importing Netflix ratings/history.

## Dependencies

Builds on the existing profile and canonical Media foundations from #23.