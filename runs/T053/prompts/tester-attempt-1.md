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


# T053 — Enrich Movie and Series detail pages with complete metadata and integrated trailers

**Source**: GitHub Issue #102

## Description

## Objective

Make Movie and Series detail pages feel like complete streaming-product experiences by surfacing all useful canonical/external metadata and integrating official trailers when available.

## Context / Problem

IPTVFlix already has canonical Media details, TMDB enrichment, Series → Season → Episode structure, availability variants, watchlist/follow/progress and recommendation foundations. The current detail experience should now become the central place where a user can understand a title before playing it.

The goal is Netflix-like information density without provider-specific leakage: one canonical Movie/Series page, rich metadata, source availability and trailer/media extras.

## Included

- Expand canonical detail API/contracts and UI to surface all useful metadata already available or cheaply obtainable through the configured metadata provider, including where available:
  - canonical/original title;
  - synopsis;
  - poster and backdrop;
  - release/theatrical/digital dates and current release state;
  - runtime;
  - genres;
  - cast and key crew/director;
  - certification/age rating where supported;
  - ratings/popularity fields where permitted;
  - production countries/languages where useful;
  - Series status, seasons, episodes, air dates and episode summaries;
  - source availabilities, languages, subtitles and quality variants;
  - watchlist/follow/progress/feedback state;
  - recommendation context/actions already supported by the product.
- Retrieve/persist video/trailer metadata through the external metadata boundary rather than hard-coding YouTube search URLs in the frontend.
- Prefer official trailer/teaser entries when metadata provider evidence supports them.
- Add an integrated YouTube trailer experience in the detail hero/modal when a valid YouTube video key exists.
- Use privacy-conscious embedding where practical and do not load/embed a player when no trailer exists.
- Keep graceful fallbacks for media with incomplete external metadata.
- Preserve one canonical Media identity independent of provider/source availability.

## Acceptance Criteria

- [ ] Movie detail shows rich metadata and availability information without provider DTO leakage.
- [ ] Series detail shows rich Series metadata plus navigable Season/Episode information.
- [ ] Cast/crew and other supported metadata appear when available and fail gracefully when absent.
- [ ] An official/relevant trailer can be played inline or in a dedicated overlay when a YouTube trailer is known.
- [ ] Trailer/video references come from the metadata layer and are persisted/refreshed using the existing enrichment principles.
- [ ] No fake trailer is shown when metadata is ambiguous or unavailable.
- [ ] Play/Resume, My List, Follow and variant/source actions integrate coherently with existing backend support.
- [ ] Responsive Web behavior remains usable on desktop/mobile.
- [ ] Automated API/frontend tests cover rich Movie, rich Series, trailer-present and trailer-absent cases.

## Excluded / Out of scope

- Automatic preview playback on browsing cards/Home hero (separate ticket).
- Hosting/copying trailer video files.
- DRM/commercial-provider trailer extraction.
- Android TV-specific UI.

## Dependencies

Builds on the existing TMDB/external metadata enrichment and current detail APIs. Should integrate with #99 for the real Play action but can be developed largely in parallel.