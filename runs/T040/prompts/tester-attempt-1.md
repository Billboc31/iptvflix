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


# T040 — Build a durable profile taste model from viewing and feedback signals

**Source**: GitHub Issue #80

## Description

## Objective

Derive a reusable, explainable taste profile for each IPTVFlix profile from durable user signals so recommendation features do not have to reinterpret raw history on every request.

## Context / Problem

IPTVFlix already has watchlist/history/progress and will gain explicit feedback. Recommendations need a stable profile-level representation of preferences across genres, recurring metadata attributes and strongly positive/negative media signals.

The taste model should be deterministic and explainable first; do not introduce an opaque LLM dependency as the core scoring mechanism.

## Included

- Define a profile-scoped taste representation derived from available signals such as completed/started viewing, watchlist, likes/dislikes/not-interested and relevant canonical metadata.
- Weight explicit negative/positive feedback more strongly than weak behavioral signals where appropriate.
- Derive useful preferences from metadata currently available in the canonical/external model (for example genres and other reliable attributes the repository already exposes).
- Store or cache derived taste state with a clear rebuild/update strategy.
- Make derivation idempotent and deterministic for the same source signals.
- Expose a concise API/debug representation explaining the strongest inferred preferences/signals without leaking internal provider DTOs.
- Handle cold-start profiles with little/no history cleanly.

## Acceptance Criteria

- [ ] A taste profile can be generated from existing profile interaction data.
- [ ] Explicit likes/dislikes materially affect derived taste in the expected direction.
- [ ] Weak signals such as watchlist/incomplete viewing do not automatically imply the same strength as a Like.
- [ ] Rebuilding from unchanged inputs produces equivalent taste output.
- [ ] Cold-start profiles return a valid empty/minimal taste state rather than failing.
- [ ] Taste state references canonical/external metadata concepts rather than source-specific items.
- [ ] Tests cover positive, negative, mixed, sparse and repeated rebuild scenarios.

## Excluded / Out of scope

- Final recommendation candidate ranking.
- LLM-generated natural-language taste descriptions as a required runtime dependency.
- Netflix account scraping/import.

## Dependencies

Uses the existing user-state foundation (#23) and explicit feedback from #79.