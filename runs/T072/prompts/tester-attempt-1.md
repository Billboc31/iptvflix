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