# PR Review — T076: Replace Home featured card with full-width cinematic hero

## Résumé

L'implémentation livre un Hero cinématique pleine largeur conforme au ticket et au plan. 5 fichiers modifiés/créés : `useFeaturedMedia.ts` (nouveau hook), `useFeaturedMedia.test.ts` (6 tests), `HeroSection.tsx` (refonte), `HeroSection.test.tsx` (+22 lignes), `HomePage.tsx` (intégration). Toutes les fonctionnalités critiques du ticket sont présentes et correctes.

## Vérifications effectuées

- Lecture du plan (`runs/T076/plan.md`) vs implémentation réelle fichier par fichier
- Vérification de chaque critère d'acceptation du plan
- Lecture de tous les fichiers modifiés (hook, composant, page, tests)
- Vérification de la cohérence des prop types et des conditions de rendu
- Analyse de la logique de cleanup preview (ref pattern)
- Vérification de l'intégration avec `useOpenDetail` (#150)
- Vérification de l'absence de hardcoding d'ID de média

## Points validés

**Sizing et layout**
- ✅ Hauteur `h-[60vh] md:h-[85vh] min-h-80` — conforme au plan (ancienne valeur `h-[65vh]` supprimée)
- ✅ Desktop : backdrop pleine largeur `object-cover`
- ✅ Mobile : `posterUrl` en portrait avec `object-top`, fallback sur `backdropUrl`
- ✅ Gradient bottom `h-2/3` — blend fluide vers les shelves
- ✅ Gradient top `h-32` — transition avec la nav sticky
- ✅ `mt-2` sur arrivals/shelves — gap visuel ≤ 8 px respecté

**Sélection du média featured**
- ✅ `useFeaturedMedia` : appels parallèles `useMovies` + `useSeries` avec `pageSize: 1, sortBy: 'popularity'`
- ✅ Priorité 1 — movie avec backdrop ; Priorité 2 — series avec backdrop ; Priorité 3 — movie sans backdrop ; Priorité 4 — series sans backdrop ; Priorité 5 — null
- ✅ Pas de hardcoding d'ID : la sélection est dynamique
- ✅ `trailerKey: null` explicite pour les séries (contrainte backend acceptée)
- ✅ Type `FeaturedMedia` unifié movie/series

**Preview video**
- ✅ Auto-démarrage après 2 s via timer — sans garde `isPointerCoarse` conformément au plan
- ✅ Respect de `prefers-reduced-motion: reduce` (timer non positionné)
- ✅ Muted par défaut (`useState(true)`)
- ✅ Reset du mute à chaque changement de `mediaId` (effet séparé)
- ✅ Cleanup correct sur unmount : `clearTimeout` + `deactivate()` via `isActiveRef` (évite stale closure)
- ✅ Bouton mute visible uniquement pendant le preview actif (`{isActive && ...}`)
- ✅ Aria-labels sur mute/unmute : `'Activer le son'` / `'Couper le son'`

**Actions**
- ✅ `▶ Lire` conditionnel : `availabilityStatus === 'AVAILABLE' && onPlay` — absent si indisponible
- ✅ `onPlay` undefined pour les séries dans `HomePage` (pas de route `/player/series/:id` disponible) — correct et documenté
- ✅ `Plus d'infos` délègue à `openDetail(hero.mediaType, hero.id)` — respecte le contrat #150
- ✅ `onDetails` accepte `'movie' | 'series'` via `useOpenDetail`
- ✅ `+ Ma Liste` supprimé du hero

**Accessibilité**
- ✅ `role="region" aria-label="Contenu vedette"` sur le conteneur root
- ✅ `focus-visible:ring-2 focus-visible:ring-white` sur tous les boutons interactifs
- ✅ Images décoratives avec `alt="" aria-hidden="true"`

**Isolation et résilience**
- ✅ `hasContent = hero !== null || shelves.length > 0` — logique correcte
- ✅ Shelves conditionnées à `!homeLoading` indépendamment du hero
- ✅ Failure du hero n'empêche pas le rendu des shelves
- ✅ `isColdStart` géré correctement

**Tests**
- ✅ `useFeaturedMedia.test.ts` : 6 scénarios couvrant loading, préférence backdrop, fallback, empty, trailerKey=null series
- ✅ `HeroSection.test.tsx` : 14 tests couvrant rendu, aria, timing 2 s, reduced-motion, mute toggle, play conditionnel, watchlist absent, cleanup unmount

## Problèmes détectés

### 1. Commentaire trompeur dans HeroSection.tsx (mineur)

**Ligne 77 :**
```tsx
{/* Preview player — mounts only when active */}
{trailerKey && (
  <PreviewPlayer trailerKey={trailerKey} active={isActive} muted={muted} />
)}
```

Le commentaire indique "mounts only when active" mais la condition de montage est `trailerKey &&`, pas `isActive &&`. Le `PreviewPlayer` est en DOM dès qu'un `trailerKey` existe, avant même que le timer de 2 s ne fire. Si `PreviewPlayer` crée l'iframe YouTube sans attendre `active=true`, cela génère une requête réseau anticipée. Le comportement réel dépend des internals de `PreviewPlayer.tsx` (non modifié ici). Ce commentaire crée une ambiguïté sur la stratégie de lazy-loading.

**Correction suggérée :** Corriger le commentaire en `{/* Preview player — active prop controls playback */}` ou conditionner le montage sur `isActive` si `PreviewPlayer` ne défère pas l'iframe.

### 2. Absence de tests pour `Plus d'infos` (mineur)

Le plan liste comme critère d'acceptation :
> "`ⓘ Plus d'infos` is always present and calls `openDetail(mediaType, id)`"

`HeroSection.test.tsx` ne comporte aucun test vérifiant :
- que le bouton "Plus d'infos" est rendu lorsque `onDetails` est fourni
- que son click déclenche `onDetails`

Le code est visuellement correct (HeroSection.tsx:117-125), mais le critère n'est pas couvert par des tests automatisés.

### 3. Absence de tests pour le rendu des artworks mobile (mineur)

Le plan spécifie : "`posterUrl` is rendered as the mobile background when available ; `backdropUrl` as fallback". Aucun test ne vérifie que l'`<img>` mobile utilise `posterUrl` quand disponible, ni qu'il bascule sur `backdropUrl` en son absence.

## Risques éventuels

**Flicker de sélection featured** : Quand `moviesLoading=false` (movie disponible sans backdrop) et `seriesLoading=true`, `media` pointe temporairement vers le film. Quand la série arrive avec un backdrop, le hero switche. Ce flash visuel est limité dans la pratique (les deux fetches démarrent en parallèle et se terminent proches) et n'est pas un bug fonctionnel. Noté pour suivi.

**PreviewPlayer et chargement anticipé** : Si `PreviewPlayer` instancie l'iframe YouTube sans attendre `active=true`, l'usage de bande passante et les cookies YouTube se déclenchent dès le rendu du Hero, même avant les 2 s. Ce comportement est identique à avant T076 (l'attribut `active` existait déjà) et n'est pas une régression de ce ticket.

## Décision

L'implémentation est fonctionnellement correcte, conforme au ticket et au plan, dans les limites du scope défini. Tous les critères d'acceptation fonctionnels sont satisfaits. Les trois problèmes détectés sont mineurs : un commentaire inexact et deux gaps de couverture de tests sur des comportements dont la correction dans le code est vérifiable visuellement.

IMPLEMENTATION_APPROVED
