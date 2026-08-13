# PR Review — T059 Redesign web browsing with top navigation, immersive hero and shelf-first media pages

## Résumé

L'implémentation délivre l'essentiel du redesign : suppression du `LeftNav`, nouveau `TopNav` horizontal, `HeroSection` étendue, `GenreChips`, et les pages `MoviesPage`/`SeriesPage` entièrement restructurées. 183/183 tests unitaires passent. Cependant, **deux problèmes bloquants** sont identifiés : les tests E2E ne sont pas mis à jour alors que le plan le requiert explicitement, et les pages redessinées suppriment les messages d'état vide qui font l'objet d'assertions dans la suite smoke. Un problème mineur de conformité au contrat de type est aussi noté.

---

## Vérifications effectuées

- Lecture de tous les fichiers modifiés/créés (`TopNav.tsx`, `AppShell.tsx`, `HeroSection.tsx`, `GenreChips.tsx`, `MoviesPage.tsx`, `SeriesPage.tsx`, `TopNav.test.tsx`, `HeroSection.test.tsx`, `MoviesPage.test.tsx`)
- Vérification de la suppression effective de `LeftNav.tsx` et `TopBar.tsx`
- Lecture des tests E2E existants (`smoke.spec.ts`, `mobile-nav.spec.ts`)
- Vérification du diff `git diff main --name-only` : aucun fichier E2E modifié
- Vérification du type `AvailabilityStatus` dans `@iptvflix/api-contracts`

---

## Points validés

- ✅ `LeftNav.tsx` et `TopBar.tsx` effectivement supprimés du dépôt
- ✅ `AppShell.tsx` : full-width `flex-col`, `TopNav` en tête, `BottomNav` préservé
- ✅ `TopNav` : logo, 5 destinations primaires, recherche desktop, bouton recherche mobile, lien paramètres — comportement responsive correct (`hidden md:flex`)
- ✅ `HeroSection` : bouton "Lire" uniquement si `availabilityStatus === 'AVAILABLE'` **et** `onPlay` fourni ; graceful fallback sans bouton Play pour contenu indisponible
- ✅ `MoviesPage` : Hero → GenreChips → rayons shelf — `FilterBar` et `PosterGrid` absents
- ✅ `SeriesPage` : même structure ; pas de `onPlay` sur le héros (playabilité par épisode — choix correct)
- ✅ `GenreChips` : chip "Tous" en premier, accent sur sélection, scrollable horizontal
- ✅ `HeroSection.test.tsx` : 4 cas de disponibilité couverts (AVAILABLE+onPlay, UNAVAILABLE+onPlay, AVAILABLE sans onPlay, fire callback)
- ✅ `TopNav.test.tsx` : 9 tests couvrant liens, navigation cachée mobile, soumission recherche, lien profil
- ✅ `MoviesPage.test.tsx` : Hero, GenreChips, rayons par défaut, Play/no-Play, filtre par genre, état d'erreur
- ✅ Aucun branding Netflix introduit
- ✅ `HeroSection` utilise des métadonnées Media canoniques (title, synopsis, backdropUrl) — pas d'objets catalogue IPTV spécifiques

---

## Problèmes détectés

### 🔴 BLOQUANT — E2E smoke tests : régressions non corrigées

**Fichiers concernés** : `e2e/tests/smoke.spec.ts`, `e2e/tests/mobile-nav.spec.ts`

Le plan (item 12) exigeait explicitement la mise à jour des tests E2E. Ces fichiers **n'ont pas été modifiés** (confirmé par `git diff main`).

**Régression 1** — `smoke.spec.ts` : deux tests assertent sur des messages d'état vide qui n'existent plus :

```ts
// smoke.spec.ts : ligne 31
await expect(page.getByText('Aucun film trouvé')).toBeVisible()
// smoke.spec.ts : ligne 33
await expect(page.getByText('Aucune série trouvée')).toBeVisible()
```

Les pages redessinées (`MoviesPage`, `SeriesPage`) ne rendent plus ces messages. Quand le catalogue est vide :
- Pas de `HeroSection` (heroMovie est `undefined`)
- `GenreChips` affiche juste "Tous"
- `HorizontalRow` "Disponibles" et "Tous les films" sont vides (pas de texte d'état vide)

Ces deux tests E2E **échoueront** en environnement intégration.

Tests affectés :
- `'empty catalog — no content before any sync'`
- `'empty catalog — sync with empty source shows empty UI'`

**Régression 2** — `mobile-nav.spec.ts` : le test `'LeftNav sidebar is not visible on mobile viewport'` utilise un sélecteur `page.locator('nav').filter({ hasText: 'IPTVFlix' })` qui ne correspond plus à aucun élément (le logo IPTVFlix est dans un `NavLink` à l'intérieur du `<header>`, pas dans le `<nav>`). Le test "passe" pour la mauvaise raison (élément absent = `toBeHidden()` passe dans Playwright). Le plan demandait de nettoyer ce sélecteur et d'ajouter une assertion sur l'absence du sidebar.

**Corrections requises** :
1. Ajouter des messages d'état vide dans `MoviesPage` et `SeriesPage` quand les rayons sont vides (ex. `{!shelfALoading && !shelfAData?.items.length && <p>Aucun film trouvé</p>}`) **ou** mettre à jour les assertions E2E pour refléter la nouvelle UX sans état vide.
2. Mettre à jour `mobile-nav.spec.ts` : remplacer l'assertion obsolète par une vérification de l'absence du sélecteur sidebar et une vérification positive que le `TopNav` est présent (`page.locator('header')`).

---

### 🟡 NOTABLE — `AvailabilityStatus` : type inline au lieu du contrat partagé

**Fichier** : `apps/web/src/components/content/HeroSection.tsx:18`

```ts
// Implémentation actuelle
availabilityStatus?: 'AVAILABLE' | 'UNAVAILABLE'

// Plan prévu
availabilityStatus?: AvailabilityStatus   // from @iptvflix/api-contracts
```

Le type `AvailabilityStatus` est exporté depuis `@iptvflix/api-contracts/src/catalog.ts`. Utiliser un littéral inline crée une divergence silencieuse si la définition du contrat évolue (ex. ajout d'un statut `'COMING_SOON'`). Le ticket insiste sur la consommation des contrats canoniques.

**Correction suggérée** :
```ts
import type { AvailabilityStatus } from '@iptvflix/api-contracts'
// ...
availabilityStatus?: AvailabilityStatus
```

---

### 🟡 NOTABLE — `SeriesPage.test.tsx` absent

Le plan n'en fait pas une exigence explicite pour SeriesPage, mais le ticket (critère d'acceptation) demande que les tests couvrent le rendu Hero et les états de disponibilité. `SeriesPage` a une structure identique à `MoviesPage` mais aucun test unitaire n'est ajouté pour elle. Étant donné la symétrie avec `MoviesPage.test.tsx`, ajouter un test de base (Hero présent, shelf visible, absence de Play button) serait cohérent avec le niveau de couverture établi.

---

### 🟢 MINEUR — Fetch inutile de `shelfBData` quand un genre est sélectionné

**Fichiers** : `MoviesPage.tsx:29`, `SeriesPage.tsx:24`

```ts
// Ces hooks appellent l'API même quand selectedGenreId est défini
// et que le shelf B n'est pas affiché
const { data: shelfBData, loading: shelfBLoading } = useMovies({
  pageSize: 20,
  sortBy: 'title',
})
```

Quand un genre est sélectionné, seul le rayon genre est affiché, mais `shelfBData` continue à être fetché inutilement. L'impact est faible (requête silencieuse), mais un guard conditionnel éviterait la requête superflue.

---

## Risques éventuels

- **Tests E2E en CI** : si les E2E smoke tests tournent en CI, ce merge provoquera des échecs sur `smoke.spec.ts`. L'implémentation-output.md note 183/183 tests passants (unit tests Vitest) mais ne couvre pas les E2E Playwright.
- **Contrat de type** : le type inline `'AVAILABLE' | 'UNAVAILABLE'` dans HeroSection ne sera pas automatiquement mis à jour si `AvailabilityStatus` évolue dans les contrats.

---

## Décision

L'implémentation core est solide et conforme au ticket sur les aspects structurels (navigation, hero, genre chips, rayons). Les deux problèmes bloquants concernent l'exécution des mises à jour E2E prévues au plan et la régression sur les états vides. Ces corrections sont circonscrites et ne remettent pas en cause l'architecture.

### Actions requises (bloquantes)

1. **Corriger la régression E2E vide** : soit ajouter un état vide dans les nouvelles pages (`MoviesPage`, `SeriesPage`) visible en E2E, soit mettre à jour les assertions `smoke.spec.ts` pour correspondre à la nouvelle UX.
2. **Mettre à jour `mobile-nav.spec.ts`** : remplacer l'assertion sur l'ancien sélecteur LeftNav par une assertion propre sur la nouvelle structure (vérifier que le sidebar n'existe plus, que le `TopNav` `<header>` est présent en mobile).

### Actions suggérées (non bloquantes)

3. Importer `AvailabilityStatus` depuis `@iptvflix/api-contracts` dans `HeroSection.tsx`.
4. Ajouter un `SeriesPage.test.tsx` minimal (Hero rendu, absence Play button).

IMPLEMENTATION_FIX_REQUIRED
