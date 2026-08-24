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


# T128 — Build personalized Movies page with exploitation and discovery shelves

**Source**: GitHub Issue #272

## Description

## Context

IPTVFlix now has a personalized Home powered by the semantic/hybrid recommendation and shelf pipeline. The next product step is to replace the Movies page's generic/catalog-first experience with a discovery experience made primarily of **personalized movie shelves**.

The page must not simply reproduce fixed genre categories. Both the **themes chosen for the user** and the **movies ranked inside each theme** should be personalized.

A key product requirement is to balance:
- **exploitation**: themes/content we already have strong reasons to think the user likes;
- **exploration / serendipity**: themes/content outside the user's established habits where we are less certain, but have credible signals that the user could like them.

Initial target balance: roughly **75% exploitation / 25% exploration**, treated as a product policy rather than an exact per-request mathematical quota.

## Goal

Build the production **Films / Movies** page as a set of horizontal personalized movie-only shelves generated from the existing recommendation architecture.

## Shelf composition

The page should include a useful mix such as:

- **Pour toi** — strongest general movie recommendations.
- **Nouveautés pour toi** — recent/new movies personalized for the profile.
- Multiple **personalized thematic shelves** whose themes are selected/generated dynamically from the user's profile and can rotate over time.
- At least one **exploration / serendipity shelf** designed to test potentially interesting tastes outside the strongest known preferences.

Do not hardcode example themes. A user may receive concepts analogous to « Aventures à travers le temps », « SF qui fait réfléchir » or « Action sans temps mort », but theme selection must come from the generic shelf/theme pipeline.

## Dynamic themes

The themes themselves should evolve rather than permanently exposing the same categories.

- Prefer themes strongly supported by the profile for exploitation shelves.
- Maintain diversity between exploitation themes so they do not become minor variations of the same concept.
- Rotate/refresh themes according to the snapshot/freshness policy rather than on every page refresh.
- A theme should only render when the catalog contains enough relevant movie candidates to make a useful rail.

## Exploration / serendipity

Exploration must **not be pure random content**.

Implement a generic controlled-exploration strategy. Candidates/themes should be meaningfully different from the user's strongest established preferences while retaining one or more plausible positive signals (semantic adjacency, cast/director affinity, secondary genres, era/language patterns, quality prior, adjacent taste cluster, etc.).

The goal is:

> « We don't know whether you like this yet, but there is a credible reason you might. »

Avoid both extremes:
- recommending only near-duplicates of known tastes;
- throwing arbitrary unrelated catalog content at the user.

Design this so future `seen / neutral / liked / disliked` feedback can measure exploration outcomes and improve the profile.

## Movie-only constraint

Every discovery shelf on this page must enforce `movie` media type at retrieval/query level where possible. Do not retrieve mixed media and merely hide series in the frontend.

## Cross-shelf diversity

Apply the existing Home-style diversity principle across the Movies page:

- materially reduce duplicate titles across rails when enough alternatives exist;
- do not destroy thematic relevance merely to force uniqueness;
- avoid themes that are effectively duplicates of one another.

## Cache / cost control

Do not regenerate themes or perform LLM-dependent work on every Movies page refresh.

Use/reuse the Home snapshot/materialization principles where architecturally appropriate:
- page-level personalized discovery snapshot or equivalent reusable persisted result;
- reasonable freshness window (~24h initially is acceptable);
- repeated refreshes should not repeatedly consume LLM tokens;
- stale-while-revalidate where feasible;
- cheap live state may remain live.

Do not couple Movies page freshness to Home if that creates unnecessary regeneration or prevents independent evolution; reuse infrastructure, not necessarily the exact same snapshot.

## UX

- Reuse the production horizontal shelf/rail UI from Home where possible.
- Responsive web/mobile behavior.
- Consumer-facing UI only: no recommendation scores/debug explanations.
- Empty shelves disappear cleanly.
- One failing shelf must not break the whole page.
- Preserve existing movie detail/playback navigation.

## Acceptance criteria

- Movies page is primarily composed of personalized movie-only horizontal shelves.
- Both shelf themes and shelf contents are personalized.
- Multiple exploitation themes are dynamically selected/generated and are meaningfully distinct.
- At least one controlled exploration/serendipity shelf exists.
- Exploration is not pure randomness and can explain its candidate selection through existing internal diagnostics/signals.
- Product behavior targets approximately 75% known-taste exploitation / 25% exploration.
- No series leak into movie shelves.
- Cross-shelf duplicate titles and near-duplicate themes are materially reduced.
- Themes/results remain stable across ordinary refreshes and do not trigger repeated expensive/LLM generation within the freshness window.
- Existing Home and recommendation diagnostic tooling do not regress.
- Add automated tests for movie-only constraints, exploitation/exploration composition, theme diversity, cross-shelf deduplication, cache/snapshot reuse, and empty/error behavior.
- No movie/theme-specific hacks and no manual production DB changes.