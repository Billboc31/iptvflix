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


# T007 — Build Netflix-inspired web experience from validated UI reference board

**Source**: GitHub Issue #9

## Description

## Objective

Deliver the first IPTVFlix web experience using the validated UI reference board as the primary visual specification. The implementation must establish the reusable frontend foundation that all future features will build upon.

## Context / Problem

The UI/UX direction has already been validated. AI Dev Factory should not invent the user experience.

The implementation must follow the reference board located at:

`docs/design/iptvflix-ui-reference-board.png`

The board defines the visual hierarchy, navigation, colors, spacing, layout philosophy and the main application screens.

The objective of this ticket is NOT to reproduce every future feature but to build a reusable Netflix-inspired frontend foundation faithful to the approved design.

## UI Reference

The reference board contains the following screens:

- Home
- Movie Catalog
- Series Catalog
- Movie Details
- Cinema Radar
- Search
- IPTV Source Configuration
- Onboarding
- Android TV Home (future reference)

These mockups are the primary visual reference for this ticket.

## Included

- Implement the global application shell.
- Left navigation.
- Top navigation/search area where applicable.
- Dark visual theme.
- Reusable layout system.
- Reusable cards.
- Reusable carousel/rows.
- Buttons, dialogs, forms and loading states.
- Responsive desktop web layout.
- IPTV Source configuration screens.
- Catalog browsing screens for Movies and Series.
- Synchronization status screens.
- Empty, loading and error states.
- Consume only the canonical backend API. Provider DTOs must never leak into the UI.

## Acceptance Criteria

- [ ] The implementation is visually consistent with the validated design board.
- [ ] Global navigation matches the approved UX.
- [ ] Shared UI components are reusable.
- [ ] Movies and Series use reusable poster grids and horizontal rows.
- [ ] IPTV source configuration follows the reference design.
- [ ] Synchronization workflow integrates naturally into the UI.
- [ ] Loading, empty and error states are polished.
- [ ] Frontend consumes only canonical API contracts.
- [ ] No Xtream-specific models appear inside UI components.
- [ ] Frontend tests cover the main user flows.

## Excluded

- Recommendation engine.
- Metadata enrichment.
- Netflix import.
- Cinema radar logic.
- Playback.
- Android TV implementation.

## Dependencies

Requires the canonical catalog synchronization pipeline (#7).

This ticket supersedes the original UI ticket by providing a much more detailed UX specification.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Implementation complete. Here's a summary of what was delivered:

---

## T007 — Implementation Summary

**55 files changed, 4017 insertions** committed as `feat(T007): build Netflix-inspired web frontend foundation`.

### Files Created/Modified

**`packages/api-contracts/src/`**
- `catalog.ts` — `MovieResponse`, `SeriesResponse`, `PaginatedList<T>`, `MovieFilters`, `SeriesFilters`, `AvailabilityStatus`
- `sync.ts` — `SyncRunResponse`, `SyncRunStatus`, `TriggerSyncBody`
- `index.ts` — re-exports both new modules

**`apps/web/`** — new dependencies (react-router-dom, tailwindcss v4, vitest, msw, @testing-library/*), Tailwind config, vitest config

**`src/lib/api.ts`** — typed fetch wrapper with `ApiError`, 12 exported functions covering movies, series, sources, search, sync

**`src/hooks/`** — `useApi`, `useMovies`, `useSeries`, `useSources` (optimistic CRUD), `useSync` (3s auto-poll), `useDebounce`

**`src/components/layout/`** — `AppShell` (fixed 240px nav + scrollable content), `LeftNav` (8 nav items, active highlight), `TopBar` (search → `/search?q=`)

**`src/components/ui/`** — `Button` (3 variants, loading), `Badge`, `Dialog`, `Skeleton`, `Spinner`, `EmptyState`, `ErrorState`, `Toast` (context)

**`src/components/content/`** — `PosterCard` (hover overlay, quality badge), `HeroSection` (gradient backdrop), `HorizontalRow` (arrow scroll), `PosterGrid` (5/3/2 columns), `FilterBar`

**`src/components/sources/`** — `SourceCard` (enable toggle, actions), `SourceForm` (create/update/test-connection), `SyncStatusBanner`, `SyncRunList`

**`src/pages/`** — `HomePage`, `MoviesPage`, `SeriesPage`, `MovieDetailPage`, `SeriesDetailPage`, `SearchPage` (300ms debounce), `SourcesPage`, `OnboardingPage` (3-step wizard)

**`src/App.tsx`** — `BrowserRouter` with 8 routes; `/onboarding` outside `AppShell`

**Tests** — 26/26 passing; 7 test files covering Button, Dialog, PosterCard, SourceForm, SourcesPage, MoviesPage, SearchPage with MSW handlers

**Verifications:** `tsc --noEmit` exits 0 on both packages; `vitest run` exits 0.

---

## Review

Now I have everything I need to write the review. Let me produce the structured report.

---

# PR Review — T007: Build Netflix-inspired web experience

## Résumé

L'implémentation livre une base frontend solide et typée (React 18 + TypeScript + Tailwind CSS v4). La structure de composants, le shell applicatif, les hooks, les pages et les contrats API répondent globalement au scope du ticket. Les tests passent (26/26), le compilateur TypeScript ne signale aucune erreur, et aucun DTO Xtream ne fuite dans les composants UI. Deux problèmes bloquants identifiés, plusieurs points mineurs.

---

## Vérifications effectuées

| Vérification | Statut |
|---|---|
| `vitest run` — 26/26 tests | ✅ |
| `tsc --noEmit` — 0 erreur | ✅ |
| Respect des contrats API canoniques | ✅ |
| Aucune fuite de DTO Xtream dans `apps/web/src/` | ✅ |
| Coverage des pages requises (8 routes) | ✅ |
| États loading/empty/error présents | ✅ |
| Scope exclu absent du code | ✅ (playback, TMDB, recommendation, Android TV) |
| Cohérence visuelle avec le design board | Partielle (voir problèmes) |

---

## Points validés

- **Architecture** : découpage clair `ui/content/sources/layout`, hooks isolés, client API unique en `lib/api.ts`.
- **Contrats API** : `catalog.ts`, `sync.ts`, `sources.ts` dans `packages/api-contracts` — aucun type Xtream dans les pages ou composants.
- **Thème** : palette dark (`#0a0a0f`, `#111118`, `#e50914`) fidèle au board de référence.
- **Composants réutilisables** : `PosterCard`, `HeroSection`, `HorizontalRow`, `PosterGrid`, `FilterBar`, `Button`, `Dialog`, `Toast`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`.
- **Navigation active** : `NavLink` avec `border-r border-[#e50914]` signale la route courante.
- **Sync auto-poll** : `useSync` relance toutes les 3 s tant qu'un run est `PENDING | RUNNING`.
- **Onboarding wizard** : 3 étapes structurées, source créée avant de passer à l'étape 2.
- **MSW mocking** : handlers cohérents couvrant tous les endpoints testés.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Liens nav menant à un écran vide

**Fichier** : `apps/web/src/components/layout/LeftNav.tsx:9-18`

Trois entrées de nav pointent vers des routes non déclarées dans `App.tsx` :

```
{ label: 'Radar Cinéma', to: '/radar', icon: '🎭' }
{ label: 'Ma Liste',     to: '/list',  icon: '❤️' }
{ label: 'Historique',  to: '/history', icon: '🕐' }
```

React Router ne matche aucune `<Route>` pour ces paths → la zone de contenu reste **vide** sans erreur. Un utilisateur qui clique voit un écran noir. Les fonctionnalités sont exclues du ticket mais les liens doivent soit être désactivés visuellement, soit pointer vers une page "Fonctionnalité à venir".

**Correction attendue** : Ajouter `pointer-events-none opacity-40` sur ces items (classe conditionnelle) ou créer une route catch-all qui affiche un `EmptyState` avec un message explicite.

---

### 🔴 BLOQUANT 2 — Onboarding step 2 : fausse confirmation de sync terminé

**Fichier** : `apps/web/src/pages/OnboardingPage.tsx:26-43`

```tsx
const run = await triggerSync({ sourceId })
if (run.status === 'FAILED') {
  setSyncError(run.error ?? 'Erreur inconnue')
} else {
  setSyncDone(true)           // ← déclenché même si run.status === 'PENDING'
  setTimeout(() => setStep(3), 1500)
}
```

`triggerSync` retourne le run avec `status: 'PENDING'`. La condition `=== 'FAILED'` est fausse → `syncDone = true` et le wizard avance à l'étape 3 au bout de 1,5 s alors que la synchronisation n'est pas terminée. L'utilisateur pense que son catalogue est importé alors qu'il ne l'est pas.

**Correction attendue** : Après `triggerSync`, boucler en polling (`setInterval` ou récursif `setTimeout`) sur `listSyncRuns()` jusqu'à `status === 'DONE' | 'FAILED'`, puis progresser ou afficher l'erreur.

---

### 🟡 MODÉRÉ 1 — "Tester la connexion" inaccessible à la création

**Fichier** : `apps/web/src/components/sources/SourceForm.tsx:135`

```tsx
{initial && onTest && (
  <Button ...>Tester la connexion</Button>
)}
```

Le design board montre le bouton "Tester la connexion" dans le formulaire d'ajout d'une source. L'API `testSource(id)` exige un `id` existant — la contrainte est réelle — mais l'UX peut être résolue en affichant "Enregistrer puis tester" ou en proposant un test après sauvegarde. Actuellement, les nouveaux utilisateurs ne peuvent pas tester avant de valider leur source dans le formulaire principal (seule l'édition le permet).

---

### 🟡 MODÉRÉ 2 — Sync hardcoded sur `sources[0]`

**Fichier** : `apps/web/src/pages/SourcesPage.tsx:67`

```tsx
await triggerSync(sources[0].id)
```

Si l'utilisateur possède plusieurs sources, le bouton "Synchroniser" déclenche toujours la première. Le design board montre un contrôle de sync par source dans `SourceCard`. À corriger ou documenter explicitement comme simplification temporaire.

---

### 🟡 MODÉRÉ 3 — Filtre "Disponibilité" absent du catalogue

**Fichier** : `apps/web/src/components/content/FilterBar.tsx`

Le design board (écran "Catalogue Films") affiche quatre filtres : Genres, Années, **Disponibilité**, Qualité. Le FilterBar n'implémente que Genres, Années et Qualité (optionnel). `MovieFilters` ne contient pas de champ `availability` dans les contrats actuels, ce qui nécessiterait une extension du contrat pour l'implémenter. Point mineur en l'absence du backend correspondant mais écart visuel notable avec le board.

---

### 🔵 MINEUR 1 — Icônes emoji dans la navigation

**Fichier** : `apps/web/src/components/layout/LeftNav.tsx`

Le design board utilise des icônes vectorielles. L'implémentation utilise des emoji Unicode (`🏠`, `🎬`, `📺`, etc.). Rendu inconsistant selon l'OS (Apple Emoji vs Twemoji). Acceptable pour une fondation mais à remplacer par une bibliothèque SVG dans une itération suivante.

---

### 🔵 MINEUR 2 — Avertissements React Router v6 Future Flags

Les tests affichent des warnings `v7_startTransition` et `v7_relativeSplatPath`. Non bloquants pour cette version mais à résoudre avant la migration vers React Router v7.

---

## Risques éventuels

- **Sécurité** : aucun secret hardcodé, `VITE_API_BASE` via `.env`. Le mot de passe de source n'est jamais loggué. ✅
- **Régressions** : aucun composant existant modifié de manière destructive. Les changements dans `packages/api-contracts` sont additifs. ✅
- **Dépendances** : toutes justifiées par le ticket (react-router-dom, tailwindcss, vitest, msw). ✅

---

## Décision

Les deux points bloquants (liens nav → écran vide, confirmation de sync prématurée dans l'onboarding) produisent des comportements trompeurs pour l'utilisateur final et ne sont pas acceptables dans une fondation sur laquelle vont s'appuyer les tickets suivants.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T007/reviews/implementation-review.md
- generated at: 2026-08-11T09:48:25Z

---

Now I have everything I need to write the review. Let me produce the structured report.

---

# PR Review — T007: Build Netflix-inspired web experience

## Résumé

L'implémentation livre une base frontend solide et typée (React 18 + TypeScript + Tailwind CSS v4). La structure de composants, le shell applicatif, les hooks, les pages et les contrats API répondent globalement au scope du ticket. Les tests passent (26/26), le compilateur TypeScript ne signale aucune erreur, et aucun DTO Xtream ne fuite dans les composants UI. Deux problèmes bloquants identifiés, plusieurs points mineurs.

---

## Vérifications effectuées

| Vérification | Statut |
|---|---|
| `vitest run` — 26/26 tests | ✅ |
| `tsc --noEmit` — 0 erreur | ✅ |
| Respect des contrats API canoniques | ✅ |
| Aucune fuite de DTO Xtream dans `apps/web/src/` | ✅ |
| Coverage des pages requises (8 routes) | ✅ |
| États loading/empty/error présents | ✅ |
| Scope exclu absent du code | ✅ (playback, TMDB, recommendation, Android TV) |
| Cohérence visuelle avec le design board | Partielle (voir problèmes) |

---

## Points validés

- **Architecture** : découpage clair `ui/content/sources/layout`, hooks isolés, client API unique en `lib/api.ts`.
- **Contrats API** : `catalog.ts`, `sync.ts`, `sources.ts` dans `packages/api-contracts` — aucun type Xtream dans les pages ou composants.
- **Thème** : palette dark (`#0a0a0f`, `#111118`, `#e50914`) fidèle au board de référence.
- **Composants réutilisables** : `PosterCard`, `HeroSection`, `HorizontalRow`, `PosterGrid`, `FilterBar`, `Button`, `Dialog`, `Toast`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`.
- **Navigation active** : `NavLink` avec `border-r border-[#e50914]` signale la route courante.
- **Sync auto-poll** : `useSync` relance toutes les 3 s tant qu'un run est `PENDING | RUNNING`.
- **Onboarding wizard** : 3 étapes structurées, source créée avant de passer à l'étape 2.
- **MSW mocking** : handlers cohérents couvrant tous les endpoints testés.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Liens nav menant à un écran vide

**Fichier** : `apps/web/src/components/layout/LeftNav.tsx:9-18`

Trois entrées de nav pointent vers des routes non déclarées dans `App.tsx` :

```
{ label: 'Radar Cinéma', to: '/radar', icon: '🎭' }
{ label: 'Ma Liste',     to: '/list',  icon: '❤️' }
{ label: 'Historique',  to: '/history', icon: '🕐' }
```

React Router ne matche aucune `<Route>` pour ces paths → la zone de contenu reste **vide** sans erreur. Un utilisateur qui clique voit un écran noir. Les fonctionnalités sont exclues du ticket mais les liens doivent soit être désactivés visuellement, soit pointer vers une page "Fonctionnalité à venir".

**Correction attendue** : Ajouter `pointer-events-none opacity-40` sur ces items (classe conditionnelle) ou créer une route catch-all qui affiche un `EmptyState` avec un message explicite.

---

### 🔴 BLOQUANT 2 — Onboarding step 2 : fausse confirmation de sync terminé

**Fichier** : `apps/web/src/pages/OnboardingPage.tsx:26-43`

```tsx
const run = await triggerSync({ sourceId })
if (run.status === 'FAILED') {
  setSyncError(run.error ?? 'Erreur inconnue')
} else {
  setSyncDone(true)           // ← déclenché même si run.status === 'PENDING'
  setTimeout(() => setStep(3), 1500)
}
```

`triggerSync` retourne le run avec `status: 'PENDING'`. La condition `=== 'FAILED'` est fausse → `syncDone = true` et le wizard avance à l'étape 3 au bout de 1,5 s alors que la synchronisation n'est pas terminée. L'utilisateur pense que son catalogue est importé alors qu'il ne l'est pas.

**Correction attendue** : Après `triggerSync`, boucler en polling (`setInterval` ou récursif `setTimeout`) sur `listSyncRuns()` jusqu'à `status === 'DONE' | 'FAILED'`, puis progresser ou afficher l'erreur.

---

### 🟡 MODÉRÉ 1 — "Tester la connexion" inaccessible à la création

**Fichier** : `apps/web/src/components/sources/SourceForm.tsx:135`

```tsx
{initial && onTest && (
  <Button ...>Tester la connexion</Button>
)}
```

Le design board montre le bouton "Tester la connexion" dans le formulaire d'ajout d'une source. L'API `testSource(id)` exige un `id` existant — la contrainte est réelle — mais l'UX peut être résolue en affichant "Enregistrer puis tester" ou en proposant un test après sauvegarde. Actuellement, les nouveaux utilisateurs ne peuvent pas tester avant de valider leur source dans le formulaire principal (seule l'édition le permet).

---

### 🟡 MODÉRÉ 2 — Sync hardcoded sur `sources[0]`

**Fichier** : `apps/web/src/pages/SourcesPage.tsx:67`

```tsx
await triggerSync(sources[0].id)
```

Si l'utilisateur possède plusieurs sources, le bouton "Synchroniser" déclenche toujours la première. Le design board montre un contrôle de sync par source dans `SourceCard`. À corriger ou documenter explicitement comme simplification temporaire.

---

### 🟡 MODÉRÉ 3 — Filtre "Disponibilité" absent du catalogue

**Fichier** : `apps/web/src/components/content/FilterBar.tsx`

Le design board (écran "Catalogue Films") affiche quatre filtres : Genres, Années, **Disponibilité**, Qualité. Le FilterBar n'implémente que Genres, Années et Qualité (optionnel). `MovieFilters` ne contient pas de champ `availability` dans les contrats actuels, ce qui nécessiterait une extension du contrat pour l'implémenter. Point mineur en l'absence du backend correspondant mais écart visuel notable avec le board.

---

### 🔵 MINEUR 1 — Icônes emoji dans la navigation

**Fichier** : `apps/web/src/components/layout/LeftNav.tsx`

Le design board utilise des icônes vectorielles. L'implémentation utilise des emoji Unicode (`🏠`, `🎬`, `📺`, etc.). Rendu inconsistant selon l'OS (Apple Emoji vs Twemoji). Acceptable pour une fondation mais à remplacer par une bibliothèque SVG dans une itération suivante.

---

### 🔵 MINEUR 2 — Avertissements React Router v6 Future Flags

Les tests affichent des warnings `v7_startTransition` et `v7_relativeSplatPath`. Non bloquants pour cette version mais à résoudre avant la migration vers React Router v7.

---

## Risques éventuels

- **Sécurité** : aucun secret hardcodé, `VITE_API_BASE` via `.env`. Le mot de passe de source n'est jamais loggué. ✅
- **Régressions** : aucun composant existant modifié de manière destructive. Les changements dans `packages/api-contracts` sont additifs. ✅
- **Dépendances** : toutes justifiées par le ticket (react-router-dom, tailwindcss, vitest, msw). ✅

---

## Décision

Les deux points bloquants (liens nav → écran vide, confirmation de sync prématurée dans l'onboarding) produisent des comportements trompeurs pour l'utilisateur final et ne sont pas acceptables dans une fondation sur laquelle vont s'appuyer les tickets suivants.

IMPLEMENTATION_FIX_REQUIRED