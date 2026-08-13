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


# T071 — Immersive responsive Movie & Series detail experience

**Source**: GitHub Issue #148

## Description

## Context

IPTVFlix now has a TMDB-first canonical catalog and is moving toward a premium streaming/discovery UX.

The current Movie and Series detail pages are too basic compared with the new browsing experience.

We want to redesign them into a rich, immersive media detail experience inspired by modern streaming applications such as Netflix.

This ticket covers BOTH Movie and Series details because they share the same visual and architectural foundation.

IMPORTANT:

- Do NOT restore the old left sidebar.
- Keep the new top-navigation direction introduced by T059.
- This is not a pixel-perfect Netflix clone.
- Use Netflix only as UX inspiration.
- Reuse IPTVFlix's own design system/components where appropriate.

---

# Goal

When the user opens a Movie or Series from any shelf/search/list, display a premium immersive detail experience containing:

- large visual hero;
- trailer/preview when available;
- graceful backdrop/poster fallback;
- title and metadata;
- playback actions;
- user actions;
- source/variant availability;
- rich TMDB metadata;
- seasons/episodes for series;
- similar/recommended titles;
- responsive desktop/mobile behavior.

The detail experience must work even when the media has ZERO playable sources.

That is important now that the TMDB catalog exists independently from Xtream/Plex availability.

---

# 1. Desktop UX

On desktop, opening a Movie or Series should present a large immersive detail surface similar in spirit to modern streaming services.

It can be implemented as:

- a large centered modal/overlay;
- an immersive route/page;
- or another approach consistent with the existing router.

The Planner should choose the cleanest implementation.

The visual result should feel like a large cinematic media card occupying most of the viewport.

Do NOT introduce a left navigation sidebar.

The existing top-navigation architecture must remain the application's primary navigation.

---

# 2. Hero / Preview area

The upper part of the detail experience should be visually dominant.

Priority:

1. playable trailer/preview when available;
2. TMDB backdrop;
3. poster artwork as final fallback;
4. graceful neutral fallback if no artwork exists.

Example conceptual hierarchy:

    ┌──────────────────────────────────────────────┐
    │                                              │
    │             VIDEO / BACKDROP                 │
    │                                              │
    │                 ▶ preview                    │
    │                                              │
    │  Poster      TITLE                           │
    │              metadata                       │
    │              actions                        │
    └──────────────────────────────────────────────┘

Use gradients so the artwork naturally transitions into the dark detail surface.

Do not show broken/empty media containers when no preview exists.

---

# 3. Trailer / preview behavior

If a trailer or preview is available from the metadata/provider integration, the hero should be able to present it.

Requirements:

- preview must never block rendering the detail page;
- failed video loading falls back to artwork;
- provide play/pause or appropriate controls;
- provide mute/unmute if autoplay preview is implemented;
- respect browser autoplay restrictions;
- avoid unexpectedly starting loud audio;
- clean up video resources when the detail view closes/unmounts.

If preview integration is not yet available in the current backend, structure the UI/API contract so it can gracefully fall back now and support previews later without another redesign.

---

# 4. Main information

Display rich canonical catalog information where available.

Examples:

- title;
- original title where useful;
- release year/date;
- runtime;
- movie / series / miniseries type;
- genres;
- certification / age rating;
- TMDB rating;
- popularity/relevant score when appropriate;
- overview/synopsis;
- director;
- creators;
- main cast;
- production country;
- original language;
- status;
- collection/franchise where relevant.

Do not render meaningless empty labels.

Missing metadata should simply disappear gracefully.

---

# 5. Primary actions

Prominent actions should include, depending on availability:

- ▶ Lecture
- + Ma liste
- 👍 J'aime
- 👎 Je n'aime pas
- Pas intéressé / equivalent existing feedback action

Reuse existing IPTVFlix behavior/state rather than creating duplicate concepts.

If no playable source exists:

- the media detail remains fully usable;
- `Lecture` should not pretend playback is possible;
- clearly show that the title is currently unavailable;
- user must still be able to add it to their list / express preferences / follow it where supported.

---

# 6. Availability / source variants

Playable availability is secondary to canonical media identity.

Display the variants attached to the canonical Movie/Series/Episode.

Example:

    Disponibilités

    Xtream Codes     FR     4K
    Xtream Codes     FR     1080p
    Xtream Codes     VO     4K
    Plex             FR     4K

Use existing source/variant information whenever possible:

- provider;
- language;
- quality;
- resolution;
- codec/HDR metadata if available;
- other useful playback attributes.

Do not expose ugly raw Xtream names as the primary media identity.

Selecting a source/variant should integrate with the existing playback flow.

If many variants exist, provide a compact default selection and a way to see all versions.

---

# 7. Movie detail

Movie detail should roughly follow:

    HERO / PREVIEW

    Movie identity + actions

    Synopsis

    Rich metadata / cast / crew

    Availability

    Similar titles / recommendations

Optional additional sections can be included if existing data supports them, but avoid turning the page into a technical metadata dump.

---

# 8. Series detail

Series uses the same visual foundation as Movie but adds the TV hierarchy.

Expected structure:

    HERO / PREVIEW

    Series identity + actions

    Synopsis / metadata

    Availability where appropriate

    Seasons
       ↓
    Episodes

    Similar titles / recommendations

---

# 9. Seasons

The user must be able to select/browse seasons clearly.

Example:

    Saison 1 ▼

    Episode 1
    Episode 2
    Episode 3
    ...

Changing the season should update the episode list without leaving the media detail experience.

Handle:

- normal seasons;
- miniseries;
- specials / season 0 where present;
- missing episode metadata;
- upcoming seasons.

---

# 10. Episode cards

Episode rows/cards should be rich enough to feel like a streaming application.

Where available show:

- episode number;
- title;
- still image;
- runtime;
- overview;
- release date;
- playback availability;
- viewing progress;
- watched state.

Example:

    1    [ episode still ]

         Tall Pines
         50 min

         Episode synopsis...

If an episode has multiple playable variants, playback should resolve through the existing source/variant model.

Do not duplicate the episode for every Xtream stream.

---

# 11. Similar titles

This is an important part of the feature.

Add a substantial:

    Titres similaires

section for BOTH Movies and Series.

Use the canonical catalog, NOT only available Xtream content.

Therefore recommendations may contain:

- playable titles;
- titles with no source;
- upcoming titles;
- catalog-only titles.

Availability should be represented independently.

Clicking a similar title opens its own immersive detail experience.

The interaction must work repeatedly without stale state/navigation bugs.

---

# 12. Recommendation source

Prefer existing recommendation/discovery infrastructure where appropriate.

Potential signals may include:

- TMDB similar/recommendations;
- genres;
- keywords;
- cast;
- director/creator;
- collection/franchise;
- IPTVFlix taste/recommendation data.

Do not introduce a second competing recommendation architecture if an existing service can be reused.

The exact algorithm is not the main scope of this ticket; the important requirement is that the detail view receives a useful canonical list of related media.

---

# 13. Desktop interaction

Desktop should feel cinematic.

Desired characteristics:

- large hero/backdrop;
- detail surface occupying most of the viewport;
- dark background;
- artwork gradients;
- clear visual hierarchy;
- horizontal similar-title shelf;
- rich but uncluttered metadata.

If implemented as an overlay/modal:

- background browsing content should remain visible but dimmed;
- Escape closes it;
- clicking the close control closes it;
- background scrolling should be handled correctly;
- focus should be handled accessibly;
- browser back navigation should behave predictably.

Deep linking to a media detail must remain possible.

---

# 14. Mobile UX

On mobile, do NOT use a small centered desktop-style modal.

The detail experience should become essentially FULL SCREEN.

Conceptually:

    ┌─────────────────────┐
    │ ←                   │
    │                     │
    │   HERO / PREVIEW    │
    │                     │
    ├─────────────────────┤
    │ poster + title      │
    │ metadata            │
    │ ▶ Lecture           │
    │ actions             │
    │                     │
    │ synopsis            │
    │                     │
    │ availability        │
    │                     │
    │ seasons             │
    │ episodes            │
    │                     │
    │ similar titles      │
    └─────────────────────┘

Use natural vertical scrolling.

The hero should use the available screen width.

Actions must be touch-friendly.

No horizontal page overflow.

---

# 15. Tablet / intermediate widths

Tablet layouts should adapt naturally between desktop and mobile.

Do not simply scale the desktop layout down.

Test portrait and landscape layouts.

---

# 16. Navigation

Media detail must be reachable consistently from:

- Home shelves;
- Films;
- Series;
- Search;
- Similar titles;
- Watchlist;
- recommendations;
- other existing media cards.

Use a common detail routing/opening mechanism rather than implementing separate behavior in every shelf.

---

# 17. Canonical catalog compatibility

This feature must respect the new TMDB-first architecture.

A canonical media entity can exist with:

    sources = []

This must NOT be treated as an error.

Example:

    Upcoming movie
    ├── rich TMDB metadata
    ├── artwork
    ├── similar titles
    ├── can be added to Ma Liste
    └── no playback availability yet

When Xtream/Plex later provides a matching variant, the SAME detail page automatically exposes the new availability.

---

# 18. Performance

The detail experience must remain fast even with the large TMDB catalog.

Consider:

- lazy loading below-the-fold sections;
- lazy image loading;
- image sizing;
- avoiding unnecessary metadata requests;
- caching existing catalog responses;
- efficient episode loading;
- loading seasons/episodes on demand where appropriate.

Opening a detail view should not require loading every season/episode before rendering the hero.

---

# 19. Loading / error states

Provide polished states for:

- initial detail loading;
- artwork loading;
- unavailable preview;
- metadata partially missing;
- availability loading;
- episodes loading;
- similar titles loading;
- API error.

Avoid large blank sections or raw technical errors.

Skeletons/placeholders are preferred where appropriate.

---

# 20. Accessibility

Include:

- keyboard navigation;
- visible focus states;
- accessible action labels;
- accessible close/back controls;
- sensible semantic structure;
- Escape-to-close on desktop overlay if applicable;
- focus management if a modal/dialog implementation is chosen.

---

# 21. Reusable architecture

Avoid two giant duplicated `MovieDetail` and `SeriesDetail` implementations.

Prefer shared primitives/components such as conceptually:

    MediaDetailShell
    MediaHero
    MediaMetadata
    MediaActions
    AvailabilityPanel
    SimilarTitlesShelf

with TV-specific components such as:

    SeasonSelector
    EpisodeList
    EpisodeCard

Exact component names are implementation details.

The Planner should inspect the existing web architecture before deciding the final decomposition.

---

# 22. Existing functionality

Do not regress:

- playback;
- variant selection;
- watchlist;
- feedback;
- viewing progress;
- series hierarchy;
- top navigation;
- responsive browsing;
- canonical catalog behavior.

Reuse existing APIs/components/services when sensible.

---

# Acceptance criteria

- [ ] Movies open in a new immersive detail experience.
- [ ] Series open in the same visual system with TV-specific content.
- [ ] No left navigation/sidebar is reintroduced.
- [ ] Desktop uses a large cinematic detail surface.
- [ ] Mobile uses an essentially full-screen detail experience.
- [ ] Hero displays preview/video when supported.
- [ ] Hero falls back gracefully to TMDB backdrop/poster.
- [ ] Missing preview never breaks the detail page.
- [ ] Canonical title and metadata are displayed rather than raw Xtream identity.
- [ ] Media with zero sources can still be opened and browsed normally.
- [ ] Playback availability/variants are clearly represented separately.
- [ ] Existing playback flow remains functional.
- [ ] Watchlist and feedback actions remain functional.
- [ ] Series expose season selection.
- [ ] Series expose rich episode lists.
- [ ] Episode playback resolves through existing availability/variant data.
- [ ] Both Movie and Series details contain `Titres similaires`.
- [ ] Similar titles come from the canonical catalog and are not restricted to currently playable titles.
- [ ] Clicking a similar title opens its detail experience correctly.
- [ ] Desktop browser back/close behavior works correctly.
- [ ] Mobile back behavior works correctly.
- [ ] Detail routes remain deep-linkable.
- [ ] Loading/error/partial metadata states are polished.
- [ ] Responsive behavior is covered by tests.
- [ ] Relevant components/services have automated tests.
- [ ] Existing T059 top-navigation direction is preserved.

---

# UX reference

<img width="1536" height="1024" alt="Image" src="https://github.com/user-attachments/assets/83a7234d-91f5-4740-8866-1ab20b7b1ae3" />

Use the attached Netflix desktop media-detail screenshot as UX inspiration for:

- immersive hero treatment;
- information hierarchy;
- episode presentation;
- dark overlay/detail surface;
- related-title discovery.

Do NOT implement a pixel-perfect copy.

IPTVFlix should retain its own identity and its source/availability capabilities.