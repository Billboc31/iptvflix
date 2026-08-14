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



# T072 — Immersive modal Movie & Series detail experience

**Source**: GitHub Issue #150

## Description

## Goal
Redesign Movie and Series details into a premium streaming-style immersive experience built on the canonical TMDB catalog. This issue covers the media detail itself; mobile/global navigation is handled separately.

## Desktop — modal is REQUIRED
On desktop, clicking a Movie or Series MUST open a large centered modal overlay, not a full-screen page and not a left-sidebar layout.

- Keep the browsing page visible and dimmed behind the modal.
- Roughly 75–85% viewport width with sensible max-width and visible margins.
- Clearly visible circular `×` close button at top-right.
- Escape closes the modal.
- Browser Back should close/navigate predictably.
- Lock background scrolling while open.
- Closing restores the exact originating page/shelf/filter/scroll position.
- Deep links must remain possible.

## Mobile detail
On mobile, the same media detail becomes an immersive full-screen layer because of the available width. It MUST still have a clearly visible `×` close button at top-right. Do not use a back arrow as the primary visible close action. Closing returns to the exact browsing context and scroll position.

## Hero / preview
The top is a large cinematic hero. Fallback order:
1. trailer/preview when supported and available;
2. TMDB backdrop;
3. poster/artwork;
4. graceful neutral fallback.

Video failure must never break the detail. Respect autoplay restrictions, never unexpectedly start loud audio, provide sensible mute/play controls, and clean resources on close. If preview backend data is not ready, design the contract/component for it and fall back to artwork now.

## Canonical information
Use canonical TMDB identity/metadata, never raw Xtream identity as the primary title. Render useful available metadata such as title, original title where relevant, year/date, runtime, genres, certification, rating, synopsis, status, countries/languages, director/creators, main cast, collection/franchise. Hide missing fields gracefully.

## Actions
Reuse existing IPTVFlix concepts and state: Play, Ma Liste, Like/Dislike/Not interested/follow where supported. A catalog title with zero playable sources remains fully browseable and can still be added to lists/preferences. Play must not pretend availability exists.

## Availability / variants
Show playable availability separately from media identity. Present provider, language, quality/resolution and other useful variant attributes. Multiple Xtream/Plex variants attach to the same canonical media. Reuse the existing playback/variant-selection flow.

## Movie structure
Hero → identity/actions → synopsis/metadata/cast → availability → Titres similaires.

## Series structure
Hero → identity/actions → synopsis/metadata → availability → season selector → episode list → Titres similaires.

Season selection updates episodes without leaving the detail. Support normal seasons, miniseries, specials/season 0, upcoming/missing metadata. Episode cards should show where available: number, title, still, runtime, overview, air date, playback availability and viewing progress/watched state. Do not duplicate episodes per source variant.

## Titres similaires — IMPORTANT
Both Movies and Series MUST have a substantial `Titres similaires` section. Use the canonical catalog, not only playable Xtream content. Results may include playable, unavailable and upcoming titles. Reuse existing recommendation/discovery infrastructure where sensible (TMDB similar/recommendations, genres, keywords, cast/crew, collections and IPTVFlix taste signals).

Clicking a similar title must replace/navigate the content INSIDE the current detail experience. On desktop keep the current modal open; on mobile keep the current full-screen detail layer. The close `×` always exits the whole detail experience back to the original browsing context.

## Entry points
Use one common detail-opening/routing mechanism from Home shelves, Films, Series, Search, Ma Liste, recommendations and Similar titles.

## Responsive / performance / accessibility
- Tablet adapts naturally between modal and full-screen behavior.
- Render hero quickly; lazy-load below-the-fold data/images and seasons/episodes where useful.
- Polished loading/skeleton/error/partial-metadata states.
- Keyboard navigation, focus management, visible focus states, accessible labels and Escape handling.
- Prefer reusable primitives (`MediaDetailShell`, `MediaHero`, `MediaActions`, `AvailabilityPanel`, `SimilarTitlesShelf`, plus TV-specific season/episode components) instead of duplicated giant Movie/Series implementations.

## Acceptance criteria
- [ ] Desktop Movie/Series details always open in a centered dismissible modal.
- [ ] No left sidebar is introduced.
- [ ] Background remains visible/dimmed and does not scroll.
- [ ] Visible `×` closes the modal; Escape works.
- [ ] Closing restores originating browsing context and scroll position.
- [ ] Mobile detail is full-screen but uses a visible `×`, not a back arrow as primary close UI.
- [ ] Hero uses preview when available and backdrop/poster fallback otherwise.
- [ ] Canonical TMDB metadata is used.
- [ ] Zero-source catalog items render normally.
- [ ] Availability/variants remain separate and playback works.
- [ ] Series provide seasons and rich episode lists.
- [ ] Movie and Series both provide `Titres similaires` from the canonical catalog.
- [ ] Similar-title navigation stays inside the current modal/detail layer.
- [ ] Watchlist/feedback/progress behavior is preserved.
- [ ] Deep linking and browser navigation behave predictably.
- [ ] Responsive, loading/error and accessibility behavior is tested.

## UX direction
Inspired by modern Netflix-style media detail overlays: cinematic hero, dark immersive surface, strong information hierarchy, episodes and related titles. Do not make a pixel-perfect copy; retain IPTVFlix identity and source/availability capabilities.