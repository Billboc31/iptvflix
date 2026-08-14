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

# Role — Reviewer

## Mission

Vérifier qu’une implémentation respecte :
- le ticket
- le plan
- les conventions
- l’architecture
- les contraintes sécurité/qualité

## Tu dois

- détecter les dérives de scope
- détecter les violations architecture
- vérifier les impacts potentiels
- vérifier la cohérence mémoire/documentation
- proposer des corrections concrètes

## Tu ne dois pas

- réécrire complètement le code
- introduire un nouveau scope
- accepter des comportements implicites dangereux

## Sortie attendue

Une review structurée conforme à `ai/templates/pr-review-template.md`.

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

# Generic Review Task

Read the ticket below and review the implementation produced for it.

The review must cover:
- correctness relative to the ticket requirements
- scope compliance
- code quality and safety
- blocking issues vs minor observations

The ticket follows.


# T076 — Replace Home featured card with a full-width cinematic preview hero

**Source**: GitHub Issue #154

## Description

## Goal
Transform the featured Movie/Series currently shown at the top of Home into a true premium streaming-style cinematic Hero. The selected featured title should visually own the top of the page, similar in spirit to Netflix, instead of looking like a normal card/banner.

## Desktop hero
Directly below/behind the existing top navigation, render a large full-width hero using most of the initial viewport width and a substantial height. The artwork/video should extend across the whole hero area rather than being constrained to a small poster card.

The hero should naturally blend into the shelves below using dark gradients/fades rather than ending as a hard rectangular card.

Conceptually:

```text
TOP NAV
┌─────────────────────────────────────────────────────┐
│                                                     │
│            PREVIEW VIDEO / BACKDROP                 │
│                                                     │
│   TITLE                                             │
│   short description                                 │
│   ▶ Lecture     ⓘ Plus d'infos                      │
│                                                     │
└─────────────────────────────────────────────────────┘
             gradient into page

Continue watching / recommendations / shelves...
```

## Media priority
Hero visual priority:
1. trailer/preview video when supported and available;
2. canonical TMDB backdrop;
3. poster/jacket artwork adapted gracefully;
4. neutral fallback.

Never show a broken/empty video frame when preview is unavailable.

## Preview behavior
When preview video support exists, allow the hero to transition/play it in a polished streaming-style way. Preview should be muted by default if autoplayed, respect browser autoplay restrictions, provide mute/unmute and appropriate controls, clean up on unmount/navigation, and fall back to artwork on any failure.

If the backend does not yet expose a usable preview, implement the Hero so artwork works perfectly now and the preview contract can be plugged in without redesigning the component.

## Hero content
Overlay useful information over the visual using gradients for readability:
- canonical title/logo/title text;
- concise synopsis/description;
- optional relevant metadata where visually useful;
- `▶ Lecture` when playable;
- `ⓘ Plus d'infos` always available for catalog content.

Avoid dumping technical metadata into the Hero.

## Integration with canonical catalog
The Home featured title comes from the canonical TMDB-first catalog and does NOT require an Xtream/Plex source to be featured.

If no playable variant exists, do not show a misleading playable `Lecture` action. `Plus d'infos` remains available.

## Integration with #150
`Plus d'infos` MUST open the common immersive Movie/Series detail experience from #150:
- desktop → centered dismissible modal;
- mobile → full-screen detail layer;
- closing returns to Home at the same browsing position.

Do not create a separate bespoke detail implementation for the Hero.

## Featured-title selection
Reuse/extend existing Home recommendation/featured logic rather than hardcoding a media ID. The hero should be able to feature either a Movie or Series. Prefer a useful/personalized/popular canonical title with good hero artwork. Avoid repeatedly selecting titles without usable artwork when alternatives exist.

The architecture should allow the featured title to evolve/rotate in future without rewriting the component.

## Mobile
Mobile must also have a strong cinematic Hero at the TOP of Home, not a tiny banner/card.

Adapt composition to the narrow viewport rather than simply shrinking desktop:
- use a mobile-friendly crop/position of backdrop or poster;
- substantial top-of-screen visual area;
- readable gradient/text;
- touch-friendly actions;
- no horizontal page overflow;
- preserve the new top mobile navigation from #151.

The hero may use poster-oriented artwork more prominently when landscape backdrop cropping would be poor.

## Shelves transition
The first Home shelf should visually flow out of the Hero. Use appropriate bottom gradient/spacing so Hero + shelves feel like one continuous streaming home screen.

Do not let the Hero consume so much vertical space that content discovery becomes awkward, especially on small mobile screens.

## Performance
- Render a static artwork quickly; do not block Home on preview loading.
- Lazy/deferred video loading where appropriate.
- Use correctly sized TMDB artwork.
- Avoid layout shift when preview becomes available.
- Cancel/cleanup media requests when leaving Home.
- Hero failure must never prevent shelves from rendering.

## Accessibility
- Actions keyboard accessible.
- Text maintains readable contrast over artwork.
- Video controls have accessible labels.
- Respect reduced-motion preferences where appropriate; do not force animated preview for users requesting reduced motion.

## Acceptance criteria
- [ ] Home featured content is a large cinematic full-width Hero rather than a normal media card.
- [ ] Desktop Hero occupies the visual top of Home beneath/with the existing top navigation.
- [ ] Hero uses preview video when supported/available.
- [ ] TMDB backdrop is the primary static fallback and poster/jacket is a graceful secondary fallback.
- [ ] Preview failure never breaks Home.
- [ ] Autoplay preview is muted by default and respects browser/reduced-motion constraints.
- [ ] Hero displays canonical media identity, not raw Xtream naming.
- [ ] Zero-source canonical titles can still be featured without a fake Play action.
- [ ] `Lecture` uses existing playback/variant selection when a source exists.
- [ ] `Plus d'infos` opens the shared #150 detail experience.
- [ ] Hero can feature Movies or Series.
- [ ] Featured selection is not hardcoded to one media ID.
- [ ] Mobile gets an adapted large top Hero, not a small banner.
- [ ] #151 top mobile navigation is preserved.
- [ ] Hero blends visually into the first shelves with gradients.
- [ ] Shelves still load/render if Hero media or preview fails.
- [ ] Responsive/performance/accessibility behavior has appropriate tests.

## UX direction
Use modern Netflix-like Home hero treatment as inspiration: the selected title's preview/backdrop fills the top of the screen and content/actions overlay it, then the artwork fades naturally into the recommendation shelves. Do not make a pixel-perfect copy; keep IPTVFlix's own identity and canonical/source architecture.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
