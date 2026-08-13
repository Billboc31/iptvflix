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