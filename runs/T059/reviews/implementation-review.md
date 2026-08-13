---

# PR Review — T059

## Résumé

L'implémentation délivre l'essentiel du redesign demandé et tous les 183 tests unitaires passent. Deux problèmes bloquants ont néanmoins été identifiés, plus deux observations notables.

---

## Points validés

- `LeftNav.tsx` et `TopBar.tsx` effectivement supprimés
- `AppShell.tsx` correctement restructuré en `flex-col` avec `TopNav` en tête
- `TopNav` : comportement responsive correct (`hidden md:flex` sur le nav desktop), recherche, lien profil
- `HeroSection` : bouton "Lire" correctement conditionné (`AVAILABLE && onPlay`), dégradé de contraste, hauteur cinématographique
- `MoviesPage` / `SeriesPage` : structure Hero → GenreChips → Rayons, sans `FilterBar` ni `PosterGrid`
- `SeriesPage` : pas de `onPlay` sur le héros — choix correct (playabilité par épisode)
- Couverture tests : HeroSection (4 états dispo), TopNav (9 cas), MoviesPage (6 scénarios)
- Aucun branding Netflix introduit

---

## Problèmes détectés

### 🔴 BLOQUANT — Régressions E2E non corrigées

Le plan (item 12) requérait explicitement la mise à jour des tests E2E. Aucun fichier E2E n'a été touché.

**Régression 1 — `smoke.spec.ts`** : deux tests assertent `'Aucun film trouvé'` / `'Aucune série trouvée'` qui n'existent plus dans les pages redessinées. Quand le catalogue est vide, les `HorizontalRow` s'affichent vides sans message d'état. Ces tests E2E échoueront en CI.

**Régression 2 — `mobile-nav.spec.ts`** : le sélecteur `page.locator('nav').filter({ hasText: 'IPTVFlix' })` ne correspond plus à aucun élément (le logo est dans le `<header>`, pas dans le `<nav>`). Le test "passe" pour la mauvaise raison.

**Corrections requises** : ajouter un état vide visible dans `MoviesPage`/`SeriesPage` **ou** mettre à jour les assertions smoke ; nettoyer le sélecteur `mobile-nav.spec.ts`.

### 🟡 NOTABLE — Type `AvailabilityStatus` inline plutôt qu'importé du contrat

`HeroSection.tsx:18` déclare `'AVAILABLE' | 'UNAVAILABLE'` en littéral local au lieu d'importer `AvailabilityStatus` depuis `@iptvflix/api-contracts` comme le prévoyait le plan. Toute évolution du contrat (ex. `'COMING_SOON'`) ne sera pas capturée automatiquement.

### 🟡 NOTABLE — `SeriesPage.test.tsx` absent

`MoviesPage` a 6 scénarios de test ; `SeriesPage` n'en a aucun malgré une structure identique et un critère d'acceptation qui demande la couverture des états Hero.

### 🟢 MINEUR — Fetch inutile de `shelfBData` quand un genre est sélectionné

Dans `MoviesPage.tsx:29` et `SeriesPage.tsx:24`, le hook `shelfBData` continue à appeler l'API même quand un genre est sélectionné et que le rayon B n'est pas rendu.

---

## Décision

**IMPLEMENTATION_FIX_REQUIRED** — Les deux points bloquants (régression E2E état vide + `mobile-nav.spec.ts` non mis à jour) doivent être corrigés avant merge. Les corrections sont circonscrites et ne remettent pas en cause l'architecture.
