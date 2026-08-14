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


# T075 — Add canonical similar-title recommendations to every Movie and Series detail

**Source**: GitHub Issue #153

## Description

## Goal
Ensure every canonical Movie and Series detail has a useful `Titres similaires` section backed by the TMDB-first catalog, independently from source availability.

This complements #150 by making similar-title data a reusable product capability rather than only a UI placeholder.

## Core behavior
For any canonical Movie or Series, expose a list of related canonical titles that can be rendered on its detail experience.

The result set MUST NOT be restricted to Xtream/Plex availability. Related titles may be:
- playable now;
- unavailable;
- upcoming;
- catalog-only.

Availability remains a separate property.

## Recommendation inputs
Reuse existing recommendation/discovery services where sensible. Combine/rank useful signals such as:
- TMDB similar/recommendations;
- genres;
- keywords;
- collections/franchises;
- cast;
- director/creator;
- language/country where useful;
- popularity/rating quality signals;
- existing IPTVFlix taste/recommendation signals when available.

Do not create a second competing recommendation architecture if current services can be extended.

## Movies and Series
Support both media types. Movie detail should return relevant Movies, and Series detail should return relevant Series by default. Cross-type recommendations may be allowed only when they are intentionally useful and clearly supported by the existing product model.

## Canonical identity
Results must be canonical catalog entities deduplicated by TMDB identity. Never expose duplicate cards because the same title has multiple Xtream variants.

Raw provider titles must not affect recommendation identity/display.

## Missing local titles
If TMDB recommendation/similar results reference a useful title not yet in the local catalog, reuse the existing TMDB enrichment/import architecture so that the canonical entity can be added locally rather than discarded.

Do this safely and avoid turning every page open into an uncontrolled large import.

## API
Provide or extend a stable API/service that #150 and other future UIs can consume, conceptually:

`GET /movies/:id/similar`
`GET /series/:id/similar`

Exact routes are implementation details; reuse existing catalog/recommendation routes if cleaner.

Support configurable result limits and sensible ranking/order.

## UX expectations
`Titres similaires` should usually contain enough titles to form a substantial horizontal shelf on desktop/mobile, not just 2–3 items when more good matches exist.

Each result should expose the same canonical card metadata used elsewhere: id, title, artwork, year/date, availability state and any other shared card fields.

Clicking a similar title is handled by #150 and should open/navigate to that canonical title inside the current detail experience.

## Performance / resilience
- Prefer local catalog queries once recommendation candidates are known.
- Cache/reuse TMDB-derived recommendation data where useful.
- Avoid repeated identical TMDB calls on every open.
- TMDB outage/rate-limit must not make the entire detail page fail.
- If remote data is unavailable, return useful local similarity candidates where possible.

## Acceptance criteria
- [ ] Every canonical Movie can return a useful similar-title list.
- [ ] Every canonical Series can return a useful similar-title list.
- [ ] Similar results are based on canonical identities and deduplicated.
- [ ] Results are not limited to titles with playable sources.
- [ ] Zero-source/upcoming titles can appear.
- [ ] Existing recommendation/discovery infrastructure is reused or extended rather than duplicated.
- [ ] Useful missing TMDB results can enrich the local canonical catalog safely.
- [ ] API/service is reusable by #150 and future shelves.
- [ ] Remote TMDB failure degrades gracefully.
- [ ] Repeated calls avoid unnecessary remote work.
- [ ] Automated tests cover Movies, Series, deduplication, zero-source results and fallback behavior.

## Dependency
Designed to feed #150 `Immersive modal Movie & Series detail experience`, where the section is rendered as `Titres similaires` on every Movie/Series detail.