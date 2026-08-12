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


# T035 — Extend source availability lifecycle to episode transitions

**Source**: GitHub Issue #64

## Description

## Objective

Record durable source appearance/disappearance events for Episodes now that authoritative episode synchronization exists.

## Context / Problem

Ticket #49 introduced authoritative Xtream/Plex episode synchronization and lifecycle-safe episode availability updates. Ticket #52 then wired `SOURCE_APPEARED` / `SOURCE_DISAPPEARED` into catalog sync, but only for Movies and Series.

This leaves episode arrival/removal invisible to the release lifecycle even though episodes are now first-class availability targets and series detail depends on per-episode source state.

## Included

- Extend the release lifecycle model/API as needed so Episode source transitions can be represented without abusing Movie/Series types.
- Record `SOURCE_APPEARED` on first episode availability and reappearance after `UNAVAILABLE`.
- Record `SOURCE_DISAPPEARED` when an authoritative episode snapshot removes a previously available episode source mapping.
- Preserve source identity and idempotency semantics.
- Keep metadata refreshes from generating false lifecycle events.

## Acceptance Criteria

- [ ] First authoritative episode availability records exactly one source-appearance event.
- [ ] Unchanged re-sync does not duplicate the event.
- [ ] Removal records exactly one source-disappearance event.
- [ ] Reappearance records a new appearance transition.
- [ ] Events preserve the originating source.
- [ ] Lifecycle API/domain types represent Episodes explicitly and safely.
- [ ] Automated tests cover Xtream and Plex episode transitions where practical.

## Dependencies

Builds on #49 and #52. Coordinate with #61 so source-aware idempotency semantics remain consistent.