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

# Role — Planner

## Mission

Lire un ticket et produire un plan d’implémentation court, concret, borné et actionnable.

## Tu dois

- comprendre le ticket
- proposer les étapes minimales
- lister les fichiers à créer ou modifier
- identifier les risques
- expliciter le hors scope
- produire un plan Markdown versionnable
- signaler les hypothèses nécessaires

## Tu ne dois pas

- coder
- réécrire le ticket
- anticiper les tickets suivants
- élargir le scope
- masquer les incertitudes

## Sortie attendue

Un fichier de plan conforme à `ai/templates/plan-template.md`.

## Règles

- le plan doit rester court
- le plan doit être exécutable par un Coder sans ambiguïté
- toute hypothèse doit être explicite
- toute dérive de scope doit être refusée

## Structure obligatoire

Tout plan doit contenir au minimum **les sections suivantes** (titres
Markdown niveau 2 — `##`). Les variantes anglaises sont acceptées à l'identique :

| Français (recommandé)         | English equivalent       |
|-------------------------------|--------------------------|
| `## Contexte`                 | `## Context`             |
| `## Objectif`                 | `## Objective`           |
| `## Inclus`                   | `## Included`            |
| `## Hors scope`               | `## Excluded`            |
| `## Critères d'acceptation`   | `## Acceptance criteria` |

Choisis une langue par plan, ne mélange pas FR et EN dans un même plan.

Ces titres sont obligatoires même si une section est courte : un ticket
trivial peut produire un plan court, mais la structure doit rester stable.

Ne jamais produire uniquement un résumé.
Ne jamais produire un compte rendu d’implémentation.

## Interdictions absolues

Tu ne dois jamais écrire :
- "implémentation terminée"
- "syntaxe valide"
- "changements appliqués"
- "voici ce qui a été fait"

Tu dois produire uniquement un plan futur, pas un compte rendu passé.

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

# SKILL: architecture-discipline

# Skill — Architecture Discipline

## Objectif

Préserver la cohérence architecture du projet dans le temps.

## Règles

- respecter les invariants documentés
- éviter les couplages implicites
- éviter les dépendances inutiles
- éviter les refactors transversaux non demandés
- documenter toute nouvelle règle structurante
- privilégier les changements locaux et bornés

## Refuser si

- le scope dérive
- plusieurs couches sont modifiées sans justification
- des conventions existantes sont cassées
- la mémoire projet devient incohérente

---

# SKILL: documentation

# Skill — Documentation

## Objectif

Maintenir une documentation utile, concise et alignée avec le code réel.

## Règles

- documenter les décisions importantes
- éviter les documentations vagues
- garder la mémoire projet cohérente
- expliciter les invariants architecture
- préférer Markdown simple et versionnable

## Refuser si

- la documentation diverge du comportement réel
- la mémoire contient des suppositions non validées
- des décisions importantes ne sont pas tracées

---

# TASK

The ticket follows.
# Generic Planner Task Read the ticket below and produce a detailed implementation plan.

## Artifact-only output (strict)

Your response will be written verbatim to `runs/<ticket>/plan.md`.
Rewrite the artifact itself. Do not describe the modifications.
Do not explain what changed. Do not produce a status report.

This rule applies to both initial plans and rewrites after a review.
Examples of forbidden openings: "The plan has been rewritten…",
"This plan now covers…", "Plan rewritten as a real implementation
document…", "Key points covered…", "The document now contains…",
"Plan written to `runs/…/plan.md`…", "`runs/…/plan.md` is written…".

Do not use the Write tool on `plan.md` and then print a status summary —
your stdout IS the artifact. If you do write the file, stdout must still
be the full plan (same four headings), not a report about it.

## Required output structure (strict) Your reply **MUST** be a Markdown document containing **exactly** these four level-2 headings, in this order, spelled exactly as shown:
## Objective
## Included
## Excluded
## Acceptance criteria
These headings are mandatory even for trivial tickets. A short plan is acceptable — an unstructured plan is not. - ## Objective — one or two sentences describing what the change achieves. - ## Included — concrete changes (files, functions, logic, tests). - ## Excluded — what is explicitly out of scope for this ticket. - ## Acceptance criteria — verifiable conditions a reviewer can check. ## Invalid output Your reply is **invalid** if any of the four headings above is missing, renamed, mistyped, or replaced by a synonym (e.g. ## Goal, ## Scope, ## In scope, ## Out of scope, ## Plan, ## Tasks are **not** accepted). An invalid reply will be rejected by the automated validator and the ticket will be retried. You **MUST NOT** write: - "implementation done" - "changes applied" - "here is what was done" - any past-tense report of work already performed You produce a *future* plan, not a status report. ## Minimal valid example (for a trivial ticket)
markdown
## Objective
Rename the helper `foo()` to `bar()` in `utils.py` to align with the new
naming convention. Behaviour is preserved.

## Included
- `utils.py`: rename `foo` → `bar`, update the docstring.
- `tests/test_utils.py`: update the single import and assertion.

## Excluded
- Renaming callers in other modules (tracked in a follow-up ticket).
- Any logic change inside `foo` / `bar`.

## Acceptance criteria
- `utils.py` no longer defines `foo`.
- `pytest tests/test_utils.py` passes.
- No other file references the old name.

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