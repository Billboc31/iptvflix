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

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

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

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

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