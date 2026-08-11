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


# T012 — Build rich movie and series detail experiences from canonical metadata

**Source**: GitHub Issue #21

## Description

## Objective

Turn the basic catalog into useful streaming-style detail pages for Movies and Series using canonical/enriched metadata and reusable UI components consistent with the validated IPTVFlix design direction.

## Context / Problem

The current web vertical slice proves that catalog browsing works, but IPTVFlix needs rich detail views to make the catalog feel like a real streaming product and to prepare future playback, recommendations and watchlist actions.

## Included

- Add canonical API endpoints/contracts needed to retrieve complete Movie and Series details without exposing provider-specific DTOs.
- Show poster/backdrop, title, original title where relevant, synopsis, release year/date, runtime, genres, selected rating/popularity fields, availability information and external metadata state when available.
- For Series, expose seasons and episodes from the canonical model in a navigable structure.
- Display graceful fallbacks when enrichment/matching is missing or incomplete.
- Keep the detail UI visually aligned with the validated IPTVFlix design board under `docs/design/`.
- Add reusable actions/placeholders for future playback/watchlist integration only where those actions already have backend support; do not fake functionality.
- Ensure mobile/desktop web responsiveness remains acceptable.

## Acceptance Criteria

- [ ] A Movie catalog item opens a rich canonical detail page.
- [ ] A Series catalog item opens a rich detail page with navigable seasons/episodes when available.
- [ ] Enriched poster/backdrop/synopsis/genre/runtime data is displayed when present.
- [ ] Unmatched or partially enriched media still have a usable detail page using available canonical/source data.
- [ ] Provider-specific Xtream DTOs do not leak into detail components or public detail contracts.
- [ ] Loading, missing-item and metadata-error states are handled visibly.
- [ ] Detail UI remains consistent with `docs/design/iptvflix-ui-reference-board.png` and the shared web shell/components.
- [ ] Automated API/frontend tests cover representative Movie, Series and incomplete-metadata cases.

## Excluded / Out of scope

- Actual video playback.
- Recommendation rows.
- Cinema radar.
- Manual metadata correction UI.

## Dependencies

Builds on #19 and #20 for high-quality enriched/matched metadata. Basic fallback detail behavior may be developed against the canonical Batch 1 model in parallel where practical.