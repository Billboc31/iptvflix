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


# T021 — Introduce reusable manual and dynamic Shelves as the primary discovery composition model

**Source**: GitHub Issue #38

## Description

## Objective

Introduce `Shelf` as a reusable ordered grouping of canonical Media so Home and future discovery experiences can be composed consistently from system, manual and rule-driven shelves.

## Context / Problem

IPTVFlix needs a flexible presentation model for rows such as `Continue Watching`, `My List`, `New on IPTV`, `Available in French`, custom collections and future personalized recommendations. These should not each become unrelated bespoke frontend/backend implementations. A Shelf groups canonical Media; it never owns provider items directly.

## Included

- Define a Shelf model/contract with stable identity, title, type/origin, ordering and presentation hints where useful without coupling domain logic to one web layout.
- Support at least:
  - system shelves backed by existing product queries/state;
  - manual shelves whose Media membership/order is user-managed;
  - dynamic rule-based shelves using a constrained/validated filter definition over canonical catalog attributes and availability state.
- Ensure Shelf members reference canonical Media identities only.
- Provide profile-scoped CRUD for user-created shelves and membership where applicable.
- Allow useful dynamic filters supported by current data, such as media type, genre, release period, available-to-me, language/quality when variant data exists, and watch state where appropriate.
- Compose the web Home from the common Shelf rendering model while preserving existing functionality such as Continue Watching/My List.
- Keep shelf evaluation deterministic and backend-controlled; do not accept arbitrary SQL/query expressions from clients.
- Design the model so future recommendation/AI-generated shelves can supply/rank Media without changing the Shelf contract.

## Acceptance Criteria

- [ ] Home can render multiple rows through one reusable Shelf contract/component model.
- [ ] Existing `Continue Watching` and `My List` can be represented through the Shelf composition layer without losing behavior.
- [ ] A user can create a manual Shelf, add/remove canonical Media and control its order.
- [ ] A dynamic Shelf can be defined using validated supported rules and refreshes when matching catalog/availability data changes.
- [ ] Shelf membership never stores Xtream/Plex/provider item IDs as canonical members.
- [ ] Invalid/unsafe dynamic rules are rejected server-side.
- [ ] Shelf presentation hints do not embed provider-specific assumptions.
- [ ] The contract can later support AI/recommendation-generated shelves without schema replacement.
- [ ] Automated tests cover manual ordering, dynamic evaluation, profile isolation and invalid rules.

## Excluded / Out of scope

- LLM natural-language Shelf creation.
- Recommendation/taste scoring.
- Sharing shelves between users.
- Complex visual shelf editor.

## Dependencies

Follows #32. Dynamic availability/language filters can consume #33/#34 when available, but the core Shelf model and manual/system shelves can be developed independently against the existing canonical catalog.