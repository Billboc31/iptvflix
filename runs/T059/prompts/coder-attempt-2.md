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


# T059 — Redesign web browsing with top navigation, immersive hero and shelf-first media pages

**Source**: GitHub Issue #121

## Description

## Objective

Redesign the IPTVFlix web browsing experience into a premium streaming-style interface centered on a horizontal top navigation, an immersive featured-media Hero, compact contextual controls and shelf-first discovery pages for Movies and Series.

## Visual reference

Use the repository reference image as the primary structural inspiration for this ticket:

![Streaming Movies page UX reference](../blob/main/docs/design/reference-streaming-movies-page.jpg?raw=1)

Repository path: `docs/design/reference-streaming-movies-page.jpg`

The reference is for **layout, hierarchy and interaction inspiration only**. Do not reproduce Netflix branding, logos, proprietary assets or pixel-copy its visual design. The resulting UI must retain IPTVFlix's own identity and use assets/metadata available to the project.

## Context / Problem

The current web UI relies too heavily on a left-side navigation and does not yet create the immersive browsing experience expected from a modern streaming product. IPTVFlix is evolving from an IPTV browser into a universal media discovery experience, so the UI should emphasize content first and source/provider mechanics second.

The desired UX structure is: persistent horizontal navigation at the top, search/profile actions on the right, a large cinematic featured-media area, a compact genre selector, and horizontal media shelves immediately below the Hero.

## Included

### Global navigation

- Replace the primary left sidebar navigation on the main browsing experience with a responsive horizontal top navigation.
- Provide clear primary destinations such as Home, Movies, Series, My List and relevant IPTVFlix discovery/tracking destinations already supported by the product.
- Keep search and profile/account actions accessible on the right side of the header on desktop layouts.
- Preserve responsive behavior for narrower screens without forcing the desktop navigation model onto mobile-sized layouts.

### Movies and Series browsing pages

- Make Movies and Series first-class immersive browsing pages rather than simple catalog/grid views.
- Display the page context (`Movies` / `Series`) with a compact genre/filter selector rather than a large permanent filtering panel.
- Use the shared Shelf model when available for the primary content sections instead of introducing page-specific hard-coded row implementations.
- Allow multiple horizontal shelves to follow naturally below the Hero.

### Immersive featured-media Hero

- Add a large featured-media Hero at the top of Movies and Series browsing pages.
- Use canonical Media metadata/backdrop artwork rather than provider-specific catalog objects.
- Present useful information such as title/logo when available, short synopsis and relevant metadata without overwhelming the artwork.
- Provide primary actions appropriate to the Media state, such as Play when a playable availability exists and More Info for the canonical detail page.
- Gracefully handle Media with no playable availability; the Hero must not imply that unavailable content can be played.
- Design the Hero contract so the featured Media can later be selected by personalization/recommendation logic rather than permanently hard-coded.
- Ensure text remains readable across varied backdrop images through appropriate contrast/gradient treatment.

### Shelf-first composition

- Reuse a common shelf/row presentation for sections beneath the Hero.
- Support different shelf content without creating bespoke page components for every category.
- The UI must be capable of rendering future automatic shelves such as `For You`, `Recently added to your sources`, `Because you liked…`, `Recently released`, `Available in French`, `Under 2 hours`, `New on Plex`, or `Now available from your radar` when those backend capabilities exist.
- This ticket does **not** require implementing the future recommendation/ranking engine merely to populate those examples.

### IPTVFlix identity

- Keep the visual direction cinematic, dark and content-focused while maintaining an original IPTVFlix design system.
- Provider/source information should remain secondary to the canonical Media experience unless it is relevant to playback or availability.

## Acceptance Criteria

- [ ] Desktop browsing no longer depends on the current left sidebar for primary navigation.
- [ ] A persistent top navigation provides the main product destinations, search and profile/account access.
- [ ] Movies has an immersive Hero followed by horizontal Media shelves.
- [ ] Series has the same coherent browsing structure adapted to Series content.
- [ ] Movies/Series expose a compact genre/filter control without requiring a large filter sidebar.
- [ ] The Hero uses canonical Media data and supports Play only when an appropriate playable availability exists.
- [ ] The Hero remains useful for unavailable Media through detail/tracking-oriented actions rather than fake playback.
- [ ] Shelf rows use/reuse the common Shelf composition model when #38 is available instead of duplicating shelf business logic in the frontend.
- [ ] Layout remains usable across common desktop/tablet viewport sizes and has a defined responsive fallback for narrow screens.
- [ ] Backdrop/text contrast remains readable for different artwork.
- [ ] Existing Home, Movies, Series, Search, My List/watchlist and detail navigation remain reachable after the redesign.
- [ ] Automated frontend tests cover navigation, Hero availability states, shelf rendering and responsive-critical behavior where practical.
- [ ] The implementation does not copy Netflix logos, branding or proprietary visual assets.

## Excluded / Out of scope

- Building the recommendation/taste engine.
- Automatic personalized shelf generation/ranking beyond data already available from the backend.
- Video player implementation.
- Reproducing Netflix pixel-for-pixel.
- Android TV redesign; this ticket establishes the web browsing direction first.

## Dependencies

- Integrate with #38 (`Shelf`) when its shared shelf contract/composition layer is available.
- The top-navigation and Hero shell can be implemented independently where reasonable; do not introduce an artificial dependency on recommendation features.
- Consume the canonical Media/Availability contracts from the current domain evolution rather than introducing IPTV-specific UI models.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

**183/183 tests passing.** Here's a summary of every file changed:

---

### Files created
| File | Purpose |
|---|---|
| `components/layout/TopNav.tsx` | Sticky horizontal nav — logo, 5 primary links (md+ only), desktop search input, mobile search button, settings link |
| `components/content/GenreChips.tsx` | Scrollable pill row — "Tous" chip + one per genre, accent colour on selected |
| `components/layout/TopNav.test.tsx` | 9 unit tests: links render, nav hidden on mobile (CSS class), search submit, profile link href |

### Files modified
| File | Change |
|---|---|
| `components/layout/AppShell.tsx` | Removed `LeftNav` + `TopBar`; now `flex-col` with `<TopNav />` at top |
| `components/content/HeroSection.tsx` | Added `availabilityStatus` + `onPlay` props; "Lire" button gated behind `AVAILABLE && onPlay`; "Détails" → "Plus d'infos"; hero height `56vh` → `65vh` |
| `components/content/HeroSection.test.tsx` | +4 tests: Play renders when AVAILABLE+onPlay, not when UNAVAILABLE, not when onPlay absent, callback fires on click |
| `pages/MoviesPage.tsx` | Rewritten: cinematic Hero → GenreChips → "Disponibles" + "Tous les films" shelves (or single genre shelf when selected) |
| `pages/SeriesPage.tsx` | Same structure as MoviesPage; no `onPlay` on hero (episode-driven playability) |
| `pages/MoviesPage.test.tsx` | Replaced FilterBar/PosterGrid/pagination tests with Hero, GenreChips, shelf, Play/no-Play, genre-filter tests |

### Files deleted
- `components/layout/LeftNav.tsx`
- `components/layout/TopBar.tsx`

---

## Review

I have a complete view of the implementation. Here is my structured review.

---

# PR Review — T059: Web Browsing Redesign

## Résumé

L'implémentation livre les composants structurels demandés : `TopNav`, refonte de `AppShell`, `HeroSection` augmentée, `GenreChips`, et pages `MoviesPage`/`SeriesPage` reconstruites autour du modèle Hero + shelves. L'architecture est cohérente avec le ticket et les 183 tests unitaires passent. Cependant, deux tests E2E sont cassés (un faux-négatif et un faux-positif silencieux), et `SeriesPage` n'a aucun test unitaire malgré l'AC explicite sur la couverture.

## Vérifications effectuées

- Structure de `AppShell.tsx` — suppression de `LeftNav`/`TopBar`, adoption de `TopNav` ✓
- `TopNav.tsx` — navigation horizontale sticky, responsive `hidden md:flex`, search/settings ✓
- `TopNav.test.tsx` — 9 tests, couverture correcte ✓
- `HeroSection.tsx` — gating du bouton Play sur `availabilityStatus === 'AVAILABLE' && onPlay` ✓
- `HeroSection.test.tsx` — +4 tests couvrant les états d'availability ✓
- `GenreChips.tsx` — import correct depuis `@iptvflix/api-contracts` ✓
- `MoviesPage.tsx` — Hero + GenreChips + shelves, fallback double-fetch pour la hero ✓
- `MoviesPage.test.tsx` — 6 tests MSW, bonne couverture ✓
- `SeriesPage.tsx` — structure miroir de Movies, correct ✓
- `SeriesPage.test.tsx` — **inexistant** ✗
- `e2e/tests/smoke.spec.ts` — assertions empty-state **invalides** après refonte ✗
- `e2e/tests/mobile-nav.spec.ts` — sélecteur stale **faux-positif** ✗
- Pas de branding Netflix, identité IPTVFlix préservée ✓

## Points validés

- La sidebar gauche est correctement supprimée ; `AppShell` passe à une structure `flex-col` propre.
- `TopNav` couvre les 5 destinations primaires (Accueil, Films, Séries, Ma Liste, Nouveautés) avec search et settings à droite.
- Le fallback responsive `hidden md:flex` est correct et `BottomNav` mobile est préservé.
- Le bouton "Lire" est strictement conditionnel à `availabilityStatus === 'AVAILABLE'` **et** la présence de `onPlay` — le contenu non-disponible ne génère pas de fausse action de lecture.
- `SeriesPage` supprime intentionnellement `onPlay` (playabilité épisode-driven) — justifié.
- `HorizontalRow` est réutilisé comme shelf primitive sans duplication de logique.
- Les gradients (`from-[#0a0a0f]` latéral + `from-[#0a0a0f]` vertical) assurent un contraste lisible sur les backdrops variés.
- `GenreChips` importe correctement `GenreResponse` depuis les contrats API.

## Problèmes détectés

### Bloquants

**1. `smoke.spec.ts` — assertions empty-state invalides**
`e2e/tests/smoke.spec.ts:30,63`
```ts
await expect(page.getByText('Aucun film trouvé')).toBeVisible()
await expect(page.getByText('Aucune série trouvée')).toBeVisible()
```
Les pages réécrites ne produisent plus ces chaînes — elles affichent des `HorizontalRow` vides sans message d'état. Ces assertions **échoueront en CI E2E**. Correction requise : soit ajouter un état vide aux pages, soit mettre à jour les assertions E2E pour refléter le comportement actuel (shelves sans contenu visibles).

**2. `mobile-nav.spec.ts` — sélecteur stale, faux-positif silencieux**
`e2e/tests/mobile-nav.spec.ts:8`
```ts
const leftNav = page.locator('nav').filter({ hasText: 'IPTVFlix' })
await expect(leftNav).toBeHidden()
```
Le logo "IPTVFlix" est maintenant dans un `<header>`, pas dans un `<nav>`. Le locator ne matche plus rien, et `toBeHidden()` passe vacuously sur un élément absent — **le test valide en se trompant**. Il ne vérifie plus que la sidebar a disparu. Correction : remplacer par une assertion positive sur le `<header>` TopNav (ex. `page.getByRole('banner')`) et/ou vérifier l'absence d'un `<nav>` sidebar explicitement identifiable.

**3. `SeriesPage.test.tsx` manquant**
AC du ticket : *"Automated frontend tests cover navigation, Hero availability states, shelf rendering and responsive-critical behavior where practical."* `MoviesPage` a 6 tests couvrant hero states, genre chips, shelves et états d'erreur. `SeriesPage` n'a aucun test. La structure `SeriesPage` est différente sur un point fonctionnel clé (pas de double-fetch hero, pas de `onPlay`) qui mérite une couverture explicite.

### Notable (à corriger)

**4. `AvailabilityStatus` inline dans `HeroSection.tsx:18`**
```ts
availabilityStatus?: 'AVAILABLE' | 'UNAVAILABLE'
```
Le plan spécifiait explicitement d'importer `AvailabilityStatus` depuis `@iptvflix/api-contracts`. Si le contrat ajoute `'COMING_SOON'` ou autre valeur, la Hero ne le reflétera pas sans mise à jour manuelle. Correction : `import type { AvailabilityStatus } from '@iptvflix/api-contracts'`.

**5. Asymétrie hero fallback Movies vs Series**
`MoviesPage` effectue deux appels parallèles (`availability: 'AVAILABLE'` puis fallback sans filtre) pour présenter un film disponible en priorité. `SeriesPage` n'a qu'un seul appel sans filtre `availability`, risquant de featured une série indisponible quand des disponibles existent. À aligner si la cohérence fonctionnelle est attendue.

### Mineur

**6. `shelfBData` fetchée inconditionnellement** (`MoviesPage.tsx:29`, `SeriesPage.tsx:24`)
Le hook "Tous les films"/"Toutes les séries" s'exécute même quand un genre est sélectionné et que cette shelf n'est pas rendue. Ajouter `enabled: !selectedGenreId` élimine la requête gaspillée.

**7. Icônes emoji dans TopNav**
`🔍` et `⚙️` sont cohérents avec `BottomNav` mais pas avec une stratégie d'icônes SVG. Acceptable pour ce ticket, point à traiter si une librairie d'icônes est adoptée.

## Risques éventuels

- Les tests E2E cassés masquent une régression réelle (pages sans empty-state) et un test devenu inutile (mobile-nav). Sans correction, CI E2E ne peut pas jouer son rôle de garde-fou pour les refactos suivants.
- L'absence de tests `SeriesPage` laisse les comportements spécifiques séries (pas de Play, hero fallback simple) sans filet.

## Décision

REQUEST_CHANGES — Les deux problèmes E2E (faux-négatif sur empty-state, faux-positif sur mobile-nav) et l'absence de `SeriesPage.test.tsx` doivent être corrigés avant merge. Les autres points sont des améliorations ciblées sans bloquer la livraison si adressées dans le même patch.

## Actions demandées

1. **`e2e/tests/smoke.spec.ts`** — Ajouter un état vide aux pages Movies/Series **ou** mettre à jour les assertions pour refléter le comportement réel (shelves vides sans message).
2. **`e2e/tests/mobile-nav.spec.ts`** — Corriger le sélecteur stale pour vérifier positivement la présence du `TopNav` header et l'absence de la sidebar.
3. **`apps/web/src/pages/SeriesPage.test.tsx`** — Créer avec au minimum : hero rendu, bouton Lire absent (Series), genre chips, shelves par défaut, héro absent si API vide.
4. **`apps/web/src/components/content/HeroSection.tsx:18`** — Remplacer le literal union par `import type { AvailabilityStatus } from '@iptvflix/api-contracts'`.
5. *(Recommandé)* **`SeriesPage.tsx`** — Aligner la stratégie hero avec `MoviesPage` (double-fetch available-first + fallback).
6. *(Optionnel)* **`MoviesPage.tsx:29`, `SeriesPage.tsx:24`** — Ajouter `enabled: !selectedGenreId` sur le hook shelfB.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T059/reviews/implementation-review.md
- generated at: 2026-08-13T08:09:46Z

---

I have a complete view of the implementation. Here is my structured review.

---

# PR Review — T059: Web Browsing Redesign

## Résumé

L'implémentation livre les composants structurels demandés : `TopNav`, refonte de `AppShell`, `HeroSection` augmentée, `GenreChips`, et pages `MoviesPage`/`SeriesPage` reconstruites autour du modèle Hero + shelves. L'architecture est cohérente avec le ticket et les 183 tests unitaires passent. Cependant, deux tests E2E sont cassés (un faux-négatif et un faux-positif silencieux), et `SeriesPage` n'a aucun test unitaire malgré l'AC explicite sur la couverture.

## Vérifications effectuées

- Structure de `AppShell.tsx` — suppression de `LeftNav`/`TopBar`, adoption de `TopNav` ✓
- `TopNav.tsx` — navigation horizontale sticky, responsive `hidden md:flex`, search/settings ✓
- `TopNav.test.tsx` — 9 tests, couverture correcte ✓
- `HeroSection.tsx` — gating du bouton Play sur `availabilityStatus === 'AVAILABLE' && onPlay` ✓
- `HeroSection.test.tsx` — +4 tests couvrant les états d'availability ✓
- `GenreChips.tsx` — import correct depuis `@iptvflix/api-contracts` ✓
- `MoviesPage.tsx` — Hero + GenreChips + shelves, fallback double-fetch pour la hero ✓
- `MoviesPage.test.tsx` — 6 tests MSW, bonne couverture ✓
- `SeriesPage.tsx` — structure miroir de Movies, correct ✓
- `SeriesPage.test.tsx` — **inexistant** ✗
- `e2e/tests/smoke.spec.ts` — assertions empty-state **invalides** après refonte ✗
- `e2e/tests/mobile-nav.spec.ts` — sélecteur stale **faux-positif** ✗
- Pas de branding Netflix, identité IPTVFlix préservée ✓

## Points validés

- La sidebar gauche est correctement supprimée ; `AppShell` passe à une structure `flex-col` propre.
- `TopNav` couvre les 5 destinations primaires (Accueil, Films, Séries, Ma Liste, Nouveautés) avec search et settings à droite.
- Le fallback responsive `hidden md:flex` est correct et `BottomNav` mobile est préservé.
- Le bouton "Lire" est strictement conditionnel à `availabilityStatus === 'AVAILABLE'` **et** la présence de `onPlay` — le contenu non-disponible ne génère pas de fausse action de lecture.
- `SeriesPage` supprime intentionnellement `onPlay` (playabilité épisode-driven) — justifié.
- `HorizontalRow` est réutilisé comme shelf primitive sans duplication de logique.
- Les gradients (`from-[#0a0a0f]` latéral + `from-[#0a0a0f]` vertical) assurent un contraste lisible sur les backdrops variés.
- `GenreChips` importe correctement `GenreResponse` depuis les contrats API.

## Problèmes détectés

### Bloquants

**1. `smoke.spec.ts` — assertions empty-state invalides**
`e2e/tests/smoke.spec.ts:30,63`
```ts
await expect(page.getByText('Aucun film trouvé')).toBeVisible()
await expect(page.getByText('Aucune série trouvée')).toBeVisible()
```
Les pages réécrites ne produisent plus ces chaînes — elles affichent des `HorizontalRow` vides sans message d'état. Ces assertions **échoueront en CI E2E**. Correction requise : soit ajouter un état vide aux pages, soit mettre à jour les assertions E2E pour refléter le comportement actuel (shelves sans contenu visibles).

**2. `mobile-nav.spec.ts` — sélecteur stale, faux-positif silencieux**
`e2e/tests/mobile-nav.spec.ts:8`
```ts
const leftNav = page.locator('nav').filter({ hasText: 'IPTVFlix' })
await expect(leftNav).toBeHidden()
```
Le logo "IPTVFlix" est maintenant dans un `<header>`, pas dans un `<nav>`. Le locator ne matche plus rien, et `toBeHidden()` passe vacuously sur un élément absent — **le test valide en se trompant**. Il ne vérifie plus que la sidebar a disparu. Correction : remplacer par une assertion positive sur le `<header>` TopNav (ex. `page.getByRole('banner')`) et/ou vérifier l'absence d'un `<nav>` sidebar explicitement identifiable.

**3. `SeriesPage.test.tsx` manquant**
AC du ticket : *"Automated frontend tests cover navigation, Hero availability states, shelf rendering and responsive-critical behavior where practical."* `MoviesPage` a 6 tests couvrant hero states, genre chips, shelves et états d'erreur. `SeriesPage` n'a aucun test. La structure `SeriesPage` est différente sur un point fonctionnel clé (pas de double-fetch hero, pas de `onPlay`) qui mérite une couverture explicite.

### Notable (à corriger)

**4. `AvailabilityStatus` inline dans `HeroSection.tsx:18`**
```ts
availabilityStatus?: 'AVAILABLE' | 'UNAVAILABLE'
```
Le plan spécifiait explicitement d'importer `AvailabilityStatus` depuis `@iptvflix/api-contracts`. Si le contrat ajoute `'COMING_SOON'` ou autre valeur, la Hero ne le reflétera pas sans mise à jour manuelle. Correction : `import type { AvailabilityStatus } from '@iptvflix/api-contracts'`.

**5. Asymétrie hero fallback Movies vs Series**
`MoviesPage` effectue deux appels parallèles (`availability: 'AVAILABLE'` puis fallback sans filtre) pour présenter un film disponible en priorité. `SeriesPage` n'a qu'un seul appel sans filtre `availability`, risquant de featured une série indisponible quand des disponibles existent. À aligner si la cohérence fonctionnelle est attendue.

### Mineur

**6. `shelfBData` fetchée inconditionnellement** (`MoviesPage.tsx:29`, `SeriesPage.tsx:24`)
Le hook "Tous les films"/"Toutes les séries" s'exécute même quand un genre est sélectionné et que cette shelf n'est pas rendue. Ajouter `enabled: !selectedGenreId` élimine la requête gaspillée.

**7. Icônes emoji dans TopNav**
`🔍` et `⚙️` sont cohérents avec `BottomNav` mais pas avec une stratégie d'icônes SVG. Acceptable pour ce ticket, point à traiter si une librairie d'icônes est adoptée.

## Risques éventuels

- Les tests E2E cassés masquent une régression réelle (pages sans empty-state) et un test devenu inutile (mobile-nav). Sans correction, CI E2E ne peut pas jouer son rôle de garde-fou pour les refactos suivants.
- L'absence de tests `SeriesPage` laisse les comportements spécifiques séries (pas de Play, hero fallback simple) sans filet.

## Décision

REQUEST_CHANGES — Les deux problèmes E2E (faux-négatif sur empty-state, faux-positif sur mobile-nav) et l'absence de `SeriesPage.test.tsx` doivent être corrigés avant merge. Les autres points sont des améliorations ciblées sans bloquer la livraison si adressées dans le même patch.

## Actions demandées

1. **`e2e/tests/smoke.spec.ts`** — Ajouter un état vide aux pages Movies/Series **ou** mettre à jour les assertions pour refléter le comportement réel (shelves vides sans message).
2. **`e2e/tests/mobile-nav.spec.ts`** — Corriger le sélecteur stale pour vérifier positivement la présence du `TopNav` header et l'absence de la sidebar.
3. **`apps/web/src/pages/SeriesPage.test.tsx`** — Créer avec au minimum : hero rendu, bouton Lire absent (Series), genre chips, shelves par défaut, héro absent si API vide.
4. **`apps/web/src/components/content/HeroSection.tsx:18`** — Remplacer le literal union par `import type { AvailabilityStatus } from '@iptvflix/api-contracts'`.
5. *(Recommandé)* **`SeriesPage.tsx`** — Aligner la stratégie hero avec `MoviesPage` (double-fetch available-first + fallback).
6. *(Optionnel)* **`MoviesPage.tsx:29`, `SeriesPage.tsx:24`** — Ajouter `enabled: !selectedGenreId` sur le hook shelfB.

IMPLEMENTATION_FIX_REQUIRED