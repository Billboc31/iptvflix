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
