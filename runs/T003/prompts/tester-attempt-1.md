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


# T003 — Define canonical media catalog domain

**Source**: GitHub Issue #4

## Description

## Objective
Define the canonical IPTVFlix media domain independently from Xtream Codes, M3U, or any future provider so all clients and backend features operate on one normalized catalog model.

## Context / Problem
IPTV providers expose inconsistent structures, titles, identifiers, categories, and metadata. If provider-specific models leak into the core domain, the web UI, Android TV client, recommendations, radar, and synchronization logic will become tightly coupled to individual source formats.

## Included
- Define the canonical entities and persistence model needed for the first catalog vertical slice, including at minimum:
  - Movie.
  - Series.
  - Season.
  - Episode.
  - Genre/category representation where relevant.
  - External identifiers/metadata references.
  - Source availability linking canonical media to provider items.
- Availability must support provider/source identity, provider item identity, and lifecycle information including `firstSeenAt` and `lastSeenAt`.
- Model the domain so a canonical media item can later be available from more than one IPTV source.
- Keep provider payloads outside the canonical domain.
- Add migrations and tests for important constraints and relationships.

## Acceptance Criteria
- [ ] Movies, series, seasons, and episodes have clear canonical representations.
- [ ] Provider-specific identifiers are represented through source availability/mapping rather than being the canonical primary identity.
- [ ] Availability records persist `firstSeenAt` and `lastSeenAt` without losing the original first-seen timestamp on later synchronization.
- [ ] The model can represent one canonical item on multiple sources.
- [ ] Database constraints prevent invalid or obviously duplicate source mappings where appropriate.
- [ ] Schema/migrations and representative domain tests are included.
- [ ] No Xtream- or M3U-specific DTO becomes the core catalog model.

## Excluded / Out of scope
- Full metadata enrichment/matching algorithm.
- Recommendation scoring.
- Cinema radar logic.
- Frontend catalog screens.

## Dependencies
Requires #3 for the persistence foundation. The detailed provider adapters can be developed independently against this canonical boundary once its contracts are established.