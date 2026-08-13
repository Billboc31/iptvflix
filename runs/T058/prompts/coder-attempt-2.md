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


# T058 — Redesign mobile navigation and Shelf browsing for a true phone-first experience

**Source**: GitHub Issue #119

## Description

## Objective

Make IPTVFlix feel intentionally designed for mobile instead of a compressed desktop layout, with special attention to Home and Shelf browsing where the current permanent left navigation consumes too much screen width.

## Context / Problem

The current responsive Web layout keeps the desktop left navigation visible on phones. This significantly reduces usable width and makes horizontal Shelf browsing feel cramped. Mobile is also a primary control surface for discovery and `Play on TV`, so Home, Shelves, details and handoff actions should be optimized for touch and narrow screens.

## Included

- Replace the permanent left sidebar on narrow/mobile viewports with a mobile-specific navigation pattern.
- Prefer a compact bottom navigation for the highest-frequency destinations (for example Home, Search, My List/Library, Activity and Profile) and provide access to secondary destinations such as Sources, Devices and Settings without crowding the primary nav.
- Preserve the existing desktop/tablet-large left navigation behavior.
- Make Home and Shelf browsing the primary responsive focus:
  - Shelves must use the full available viewport width on mobile;
  - horizontal rows should support natural touch/swipe scrolling;
  - remove desktop-only arrow controls where they reduce usable space or duplicate native touch scrolling;
  - choose mobile-appropriate poster/card widths so enough of the next card remains visible to communicate horizontal scrollability;
  - use consistent horizontal edge padding without wasting screen width;
  - prevent card titles, badges, preview controls or progress indicators from forcing row overflow/layout jumps;
  - maintain smooth scrolling with long recommendation-backed Shelf lists;
  - avoid accidental autoplay preview activation during ordinary touch scrolling.
- Ensure the Home hero scales cleanly on narrow screens: readable title/metadata, sensible image crop, actions that do not overflow, and no desktop sidebar offset.
- Review Movie/Series details for mobile ergonomics, especially Play/Resume, `Play on TV`, My List, Follow, trailers and availability/variant controls.
- Make `Play on TV` practical from a phone: actions must remain reachable without tiny targets or horizontal overflow.
- Ensure Season/Episode browsing is touch-friendly and does not inherit desktop-width assumptions.
- Respect device safe areas (bottom/home indicator and notches) for mobile navigation and fixed controls.
- Keep accessibility basics: minimum practical touch targets, keyboard behavior on larger layouts, visible focus states where applicable, and no content hidden behind fixed navigation.
- Add representative responsive tests for narrow phone widths and a larger mobile/tablet breakpoint.

## Acceptance Criteria

- [ ] On phone-sized viewports the permanent left sidebar is not visible and does not reserve horizontal space.
- [ ] Primary mobile navigation is reachable with one hand and does not cover page content.
- [ ] Desktop/large-screen navigation remains unchanged or equivalently usable.
- [ ] Home Shelves occupy the full mobile content width and scroll horizontally with native touch gestures.
- [ ] Shelf cards have intentional mobile sizing and visible continuation/peek behavior rather than looking like a squeezed desktop row.
- [ ] Scrolling a Shelf does not accidentally trigger autoplay previews.
- [ ] Multiple/long Shelves render without horizontal page overflow or broken spacing.
- [ ] Hero content and actions fit common phone widths without clipping.
- [ ] Movie/Series detail primary actions, including `Play on TV`, remain easy to reach and use on mobile.
- [ ] Season/Episode lists are readable and touch-friendly on narrow screens.
- [ ] Fixed bottom navigation respects safe-area insets and does not hide content.
- [ ] Automated frontend tests cover mobile navigation visibility, Shelf scrolling/layout, hero/action layout and representative detail/device-handoff behavior.

## Excluded / Out of scope

- Native iOS/Android phone apps.
- Redesigning the desktop visual identity.
- Replacing the existing Shelf/recommendation data model.
- New product features unrelated to responsive/mobile UX.

## Dependencies

Builds on the current Home/Shelf, autoplay-preview, rich-detail and `Play on TV` Web features. This is a focused responsive UX improvement and should preserve their existing backend contracts.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All 171 unit tests pass. Here's a summary of everything implemented:

---

## Files Modified

| File | Change |
|------|--------|
| `layout/LeftNav.tsx` | `hidden md:flex` — hidden on mobile viewports |
| `layout/AppShell.tsx` | `ml-0 md:ml-60` content offset; `pb-20 md:pb-0` clears BottomNav; adds `<BottomNav>` |
| `layout/BottomNav.tsx` | **New** — fixed bottom bar with 5 tabs, safe-area inset, `block md:hidden` |
| `content/HorizontalRow.tsx` | Arrow buttons get `hidden md:flex`; section gains `px-4 md:px-8`; scroll container gains `snap-x snap-mandatory` |
| `content/ShelfRow.tsx` | Outer `px-8` removed (HorizontalRow owns padding); card wrappers → `w-28 md:w-32 lg:w-36 snap-start` |
| `content/PosterCard.tsx` | Root div → `w-28 md:w-32 lg:w-36` |
| `content/HeroSection.tsx` | Title `text-2xl md:text-3xl lg:text-4xl`; synopsis `line-clamp-2 md:line-clamp-3`; padding `px-4 md:px-8 pb-6 md:pb-10`; actions `flex-wrap gap-2` |
| `pages/MovieDetailPage.tsx` | Content padding `px-4 py-4 md:px-8 md:py-6`; title `text-2xl md:text-4xl`; action buttons get `min-h-[44px]` |
| `pages/SeriesDetailPage.tsx` | Same responsive padding and title adjustments |
| `detail/EpisodeRow.tsx` | Action buttons get `inline-flex items-center min-h-[44px]` |
| `ui/Dialog.tsx` | `max-w-lg` → `max-w-sm` |
| `e2e/playwright.config.ts` | Added `mobile-chrome` (Pixel 5) and `mobile-safari` (iPhone 12) projects |

## Files Created

- `layout/BottomNav.tsx` — new mobile nav component
- `layout/BottomNav.test.tsx` — 6 unit tests (tabs, active state, safe-area style, `md:hidden`)
- `content/HorizontalRow.test.tsx` — 6 unit tests (arrows have `hidden`/`md:flex`, snap-x)
- `content/PosterCard.test.tsx` — +2 tests for `w-28`, `md:w-32 lg:w-36` classes
- `e2e/tests/mobile-nav.spec.ts` — sidebar hidden, BottomNav visible, tab navigation
- `e2e/tests/mobile-shelf.spec.ts` — shelf overflow, arrows hidden, no video on swipe
- `e2e/tests/mobile-detail.spec.ts` — action buttons above fold, modal fits viewport

---

## Review

I now have everything I need for a complete review. Let me write it up.

---

# Review — T058: Mobile Navigation and Shelf Browsing Redesign

## Summary

The implementation covers the plan faithfully across all 10 plan sections in 18 well-scoped files. The core mobile navigation pattern (BottomNav, LeftNav hide, AppShell responsive offsets), Shelf layout, hero responsiveness, and EpisodeRow touch targets are all correct. However, two connected issues on the Movie detail page — one a layout AC violation and one a vacuous test — are blocking.

---

## Blocking Issues

### B1 — MovieDetailPage: Play/Play on TV buttons likely below fold for enriched content (AC #10)

**File**: `apps/web/src/pages/MovieDetailPage.tsx:231-256`

The action buttons appear after: `h-[50vh]` hero (-96px overlap) → title → metadata badges → genres → synopsis (unclamped) → TrailerPlayer (label + button: ~84px) → variant selector → CastRow. For an enriched TMDB-matched movie (trailer + 1+ variant + cast), a rough stack height on a 375×667 Pixel 5 viewport:

| Element | approx. px from top |
|---|---|
| Hero bottom with -mt-24 | 237 |
| Title (text-2xl) + mb-1 | ~269 |
| Metadata badges + mb-4 | ~313 |
| Genres + mb-4 | ~357 |
| Synopsis (3 lines, unclamped) + mb-6 | ~441 |
| TrailerPlayer button area | ~525 |
| Variant selector | ~585 |
| CastRow | ~625 |
| **Action buttons start** | **~625** |

With the fixed BottomNav consuming 48–68 px at the bottom, the effective initial visible area is ~599 px. Action buttons at ~625 px are below the fold for any enriched movie.

The plan §6 explicitly warned: *"if the info block is too tall, move actions above synopsis or add a sticky footer bar for Play + Play on TV on mobile only."* No sticky footer and no reordering was implemented.

**Required fix**: Either (a) move `<div className="flex flex-wrap gap-3">` with Play/Lire sur TV above the synopsis block on mobile, or (b) add a `sticky bottom-[80px] md:static` action bar on mobile only containing at minimum Play and Play on TV. Apply the same fix to SeriesDetailPage, which currently has no Play action at all in its top-level buttons.

The synopsis should also be clamped on detail pages on mobile (e.g. `line-clamp-4 md:line-clamp-none`) to bound the height contribution.

---

### B2 — E2E mobile-detail: Play button visibility assertion is vacuous (AC #10)

**File**: `e2e/tests/mobile-detail.spec.ts:46-52`

```ts
const playButton = page.getByRole('button', { name: /lecture/i }).or(
  page.getByRole('link', { name: /lecture/i })
)
if (await playButton.isVisible()) {          // ← guard makes the whole assertion optional
  const box = await playButton.boundingBox()
  expect(box!.y + box!.height).toBeLessThan(viewportHeight)
}
```

If the Play button is scrolled below the fold, `isVisible()` returns `false`, the block is skipped, and the test **passes**. The test never actually enforces that the button is visible on load. CI cannot catch regressions for AC #10.

**Required fix**:

```ts
const playButton = page.getByRole('button', { name: /lecture/i }).or(
  page.getByRole('link', { name: /lecture/i })
)
await expect(playButton).toBeVisible({ timeout: 5_000 })
const box = await playButton.boundingBox()
expect(box!.y + box!.height).toBeLessThan(viewportHeight)
```

---

## Minor Observations

### M1 — Duplicate responsive width classes on ShelfRow wrapper + PosterCard

**Files**: `apps/web/src/components/content/ShelfRow.tsx:27`, `apps/web/src/components/content/PosterCard.tsx:59`

ShelfRow's card wrapper already carries `w-28 md:w-32 lg:w-36 snap-start` and PosterCard's root div independently declares `w-28 md:w-32 lg:w-36`. Since PosterCard is a child of the wrapper, PosterCard's width is already constrained by the parent; its own width class is redundant. Not a visual bug, but confusing. PosterCard should use `w-full` or drop the width class since width ownership lives in ShelfRow.

### M2 — Swipe simulation in mobile-shelf.spec.ts is not a swipe

**File**: `e2e/tests/mobile-shelf.spec.ts:43-44`

```ts
await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height / 2)
await page.touchscreen.tap(box.x + box.width * 0.3, box.y + box.height / 2)
```

Two taps ≠ a swipe. This exercises the preview guard in a static state, not during an actual scroll motion. The implementation is correct (`isTouch()` prevents `mouseenter`-triggered preview on coarse pointers), but the test doesn't faithfully reproduce a touch-scroll scenario. A proper swipe would use `page.mouse.move()` with `buttons: 1` or a `touchscreen` drag sequence. Not blocking given that the implementation mechanism is independently correct, but the test is a false signal.

### M3 — SeriesDetailPage Back button below 44 px touch target

**File**: `apps/web/src/pages/SeriesDetailPage.tsx:250`

```tsx
<Button variant="ghost" onClick={() => navigate(-1)}>
  ← Retour
</Button>
```

Button's `md` size (`py-2 text-sm`) renders at ~36 px height, below the 44 px minimum. MovieDetailPage correctly adds `className="min-h-[44px]"` to all its buttons. Apply the same to SeriesDetailPage's Retour, WatchlistButton row.

### M4 — E2E test files in `e2e/tests/` match `testDir: './tests'` — consistent, no issue

The plan referenced paths like `e2e/mobile-nav.spec.ts` but the playwright config specifies `testDir: './tests'` so `e2e/tests/mobile-nav.spec.ts` is correct. This is fine.

---

## What is correctly implemented

- `LeftNav`: `hidden md:flex` correctly removes sidebar on mobile — clean, correct.
- `AppShell`: `ml-0 md:ml-60` and `pb-20 md:pb-0` — correctly removes offset and clears BottomNav.
- `BottomNav`: safe-area inset, `min-h-[48px]`, active state, `block md:hidden` — correct per plan.
- `HorizontalRow`: arrows hidden with `hidden md:flex`, `snap-x snap-mandatory`, `px-4 md:px-8` — correct.
- `PosterCard`: `w-28 md:w-32 lg:w-36` + `isTouch()` guard preserved — correct.
- `HeroSection`: responsive title `text-2xl md:text-3xl lg:text-4xl`, `line-clamp-2 md:line-clamp-3`, `flex-wrap gap-2` — correct.
- `EpisodeRow`: `min-h-[44px]` on both Lire and TV buttons — correct.
- `Dialog`: reduced to `max-w-sm` (24rem), fits 375 px with `p-4` wrapper margin — correct.
- `Playwright config`: Pixel 5 + iPhone 12 projects correctly added.
- `BottomNav.test.tsx`: 6 tests covering tabs, active state, safe-area, responsive class — solid.
- `HorizontalRow.test.tsx`: 6 tests covering hidden class, md:flex, snap-x — solid.
- Scope is well bounded: 18 files, no backend changes, no data model changes.

---

## Verdict

Two connected issues: the MovieDetailPage action buttons are structurally below the initial mobile viewport for any enriched movie, and the E2E test designed to catch this is vacuous. Together they mean AC #10 is unmet and CI will not surface regressions. The remaining observations are minor and do not block functional correctness independently.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T058/reviews/implementation-review.md
- generated at: 2026-08-13T06:19:22Z

---

I now have everything I need for a complete review. Let me write it up.

---

# Review — T058: Mobile Navigation and Shelf Browsing Redesign

## Summary

The implementation covers the plan faithfully across all 10 plan sections in 18 well-scoped files. The core mobile navigation pattern (BottomNav, LeftNav hide, AppShell responsive offsets), Shelf layout, hero responsiveness, and EpisodeRow touch targets are all correct. However, two connected issues on the Movie detail page — one a layout AC violation and one a vacuous test — are blocking.

---

## Blocking Issues

### B1 — MovieDetailPage: Play/Play on TV buttons likely below fold for enriched content (AC #10)

**File**: `apps/web/src/pages/MovieDetailPage.tsx:231-256`

The action buttons appear after: `h-[50vh]` hero (-96px overlap) → title → metadata badges → genres → synopsis (unclamped) → TrailerPlayer (label + button: ~84px) → variant selector → CastRow. For an enriched TMDB-matched movie (trailer + 1+ variant + cast), a rough stack height on a 375×667 Pixel 5 viewport:

| Element | approx. px from top |
|---|---|
| Hero bottom with -mt-24 | 237 |
| Title (text-2xl) + mb-1 | ~269 |
| Metadata badges + mb-4 | ~313 |
| Genres + mb-4 | ~357 |
| Synopsis (3 lines, unclamped) + mb-6 | ~441 |
| TrailerPlayer button area | ~525 |
| Variant selector | ~585 |
| CastRow | ~625 |
| **Action buttons start** | **~625** |

With the fixed BottomNav consuming 48–68 px at the bottom, the effective initial visible area is ~599 px. Action buttons at ~625 px are below the fold for any enriched movie.

The plan §6 explicitly warned: *"if the info block is too tall, move actions above synopsis or add a sticky footer bar for Play + Play on TV on mobile only."* No sticky footer and no reordering was implemented.

**Required fix**: Either (a) move `<div className="flex flex-wrap gap-3">` with Play/Lire sur TV above the synopsis block on mobile, or (b) add a `sticky bottom-[80px] md:static` action bar on mobile only containing at minimum Play and Play on TV. Apply the same fix to SeriesDetailPage, which currently has no Play action at all in its top-level buttons.

The synopsis should also be clamped on detail pages on mobile (e.g. `line-clamp-4 md:line-clamp-none`) to bound the height contribution.

---

### B2 — E2E mobile-detail: Play button visibility assertion is vacuous (AC #10)

**File**: `e2e/tests/mobile-detail.spec.ts:46-52`

```ts
const playButton = page.getByRole('button', { name: /lecture/i }).or(
  page.getByRole('link', { name: /lecture/i })
)
if (await playButton.isVisible()) {          // ← guard makes the whole assertion optional
  const box = await playButton.boundingBox()
  expect(box!.y + box!.height).toBeLessThan(viewportHeight)
}
```

If the Play button is scrolled below the fold, `isVisible()` returns `false`, the block is skipped, and the test **passes**. The test never actually enforces that the button is visible on load. CI cannot catch regressions for AC #10.

**Required fix**:

```ts
const playButton = page.getByRole('button', { name: /lecture/i }).or(
  page.getByRole('link', { name: /lecture/i })
)
await expect(playButton).toBeVisible({ timeout: 5_000 })
const box = await playButton.boundingBox()
expect(box!.y + box!.height).toBeLessThan(viewportHeight)
```

---

## Minor Observations

### M1 — Duplicate responsive width classes on ShelfRow wrapper + PosterCard

**Files**: `apps/web/src/components/content/ShelfRow.tsx:27`, `apps/web/src/components/content/PosterCard.tsx:59`

ShelfRow's card wrapper already carries `w-28 md:w-32 lg:w-36 snap-start` and PosterCard's root div independently declares `w-28 md:w-32 lg:w-36`. Since PosterCard is a child of the wrapper, PosterCard's width is already constrained by the parent; its own width class is redundant. Not a visual bug, but confusing. PosterCard should use `w-full` or drop the width class since width ownership lives in ShelfRow.

### M2 — Swipe simulation in mobile-shelf.spec.ts is not a swipe

**File**: `e2e/tests/mobile-shelf.spec.ts:43-44`

```ts
await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height / 2)
await page.touchscreen.tap(box.x + box.width * 0.3, box.y + box.height / 2)
```

Two taps ≠ a swipe. This exercises the preview guard in a static state, not during an actual scroll motion. The implementation is correct (`isTouch()` prevents `mouseenter`-triggered preview on coarse pointers), but the test doesn't faithfully reproduce a touch-scroll scenario. A proper swipe would use `page.mouse.move()` with `buttons: 1` or a `touchscreen` drag sequence. Not blocking given that the implementation mechanism is independently correct, but the test is a false signal.

### M3 — SeriesDetailPage Back button below 44 px touch target

**File**: `apps/web/src/pages/SeriesDetailPage.tsx:250`

```tsx
<Button variant="ghost" onClick={() => navigate(-1)}>
  ← Retour
</Button>
```

Button's `md` size (`py-2 text-sm`) renders at ~36 px height, below the 44 px minimum. MovieDetailPage correctly adds `className="min-h-[44px]"` to all its buttons. Apply the same to SeriesDetailPage's Retour, WatchlistButton row.

### M4 — E2E test files in `e2e/tests/` match `testDir: './tests'` — consistent, no issue

The plan referenced paths like `e2e/mobile-nav.spec.ts` but the playwright config specifies `testDir: './tests'` so `e2e/tests/mobile-nav.spec.ts` is correct. This is fine.

---

## What is correctly implemented

- `LeftNav`: `hidden md:flex` correctly removes sidebar on mobile — clean, correct.
- `AppShell`: `ml-0 md:ml-60` and `pb-20 md:pb-0` — correctly removes offset and clears BottomNav.
- `BottomNav`: safe-area inset, `min-h-[48px]`, active state, `block md:hidden` — correct per plan.
- `HorizontalRow`: arrows hidden with `hidden md:flex`, `snap-x snap-mandatory`, `px-4 md:px-8` — correct.
- `PosterCard`: `w-28 md:w-32 lg:w-36` + `isTouch()` guard preserved — correct.
- `HeroSection`: responsive title `text-2xl md:text-3xl lg:text-4xl`, `line-clamp-2 md:line-clamp-3`, `flex-wrap gap-2` — correct.
- `EpisodeRow`: `min-h-[44px]` on both Lire and TV buttons — correct.
- `Dialog`: reduced to `max-w-sm` (24rem), fits 375 px with `p-4` wrapper margin — correct.
- `Playwright config`: Pixel 5 + iPhone 12 projects correctly added.
- `BottomNav.test.tsx`: 6 tests covering tabs, active state, safe-area, responsive class — solid.
- `HorizontalRow.test.tsx`: 6 tests covering hidden class, md:flex, snap-x — solid.
- Scope is well bounded: 18 files, no backend changes, no data model changes.

---

## Verdict

Two connected issues: the MovieDetailPage action buttons are structurally below the initial mobile viewport for any enriched movie, and the E2E test designed to catch this is vacuous. Together they mean AC #10 is unmet and CI will not surface regressions. The remaining observations are minor and do not block functional correctness independently.

IMPLEMENTATION_FIX_REQUIRED