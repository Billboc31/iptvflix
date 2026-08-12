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


# T042 — Generate personalized Shelves from seed media and recommendation intent

**Source**: GitHub Issue #83

## Description

## Objective

Allow a user to create a personalized Shelf by selecting a small set of seed Movies/Series, such as three films they like, and let IPTVFlix generate a coherent recommendation-based Shelf from those seeds.

## Context / Problem

The Shelf model already supports reusable manual/dynamic composition, and the new recommendation engine will provide ranked candidates. A key product experience is to let the user say, in effect, “build me a Shelf from these 3 films” without exposing low-level recommendation filters.

The generated Shelf must preserve a durable intent so it can be refreshed as the catalog/discovery pool evolves, rather than becoming only a frozen one-time list.

## Included

- Add a backend/domain operation that accepts a bounded set of canonical seed Media plus optional supported constraints such as media type, availability-to-me and runtime where the current model can enforce them reliably.
- Derive a recommendation intent/profile from the seed Media using existing metadata and recommendation boundaries; do not introduce provider-specific logic.
- Generate an ordered Shelf whose members reference canonical Media identities only.
- Persist enough generation metadata/intent so the Shelf can be refreshed deterministically later.
- Materialize external discovery candidates into canonical zero-Availability Media only when needed for durable Shelf membership, reusing existing identity/deduplication rules.
- Expose a lightweight web flow for selecting seed Media and creating the Shelf.
- Return concise explanation metadata describing why the Shelf was generated, without making an LLM call mandatory for runtime functionality.

## Acceptance Criteria

- [ ] A user can select at least 3 canonical Movies/Series and create a generated Shelf.
- [ ] The Shelf contains ranked recommendations derived from the seeds and current recommendation engine.
- [ ] Seed titles themselves are not duplicated as recommendations unless explicitly allowed by a documented rule.
- [ ] Shelf members are canonical Media, never provider item IDs or raw external candidates.
- [ ] External candidates are safely deduplicated/materialized when durable membership requires it.
- [ ] The generated Shelf stores enough intent/provenance to be refreshed later.
- [ ] Optional constraints are validated server-side and reuse existing availability semantics.
- [ ] Tests cover seed validation, deterministic generation, deduplication, unavailable candidates and persistence.

## Excluded / Out of scope

- Free-form natural-language Shelf prompts.
- Sharing shelves between profiles.
- Mandatory LLM generation of the Shelf.

## Dependencies

Requires #81 recommendation ranking and the existing Shelf model from #38.