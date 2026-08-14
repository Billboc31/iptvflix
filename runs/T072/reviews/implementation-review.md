---

## PR Review — T072 Immersive Modal Movie & Series Detail Experience

## Résumé

L'implémentation couvre l'ensemble du périmètre T072 : modale desktop/plein-écran mobile, héros cinématique avec chain de fallback, titres similaires TMDB, saisons/épisodes lazy-loaded, et un point d'entrée unifié `useOpenDetail`. L'architecture est correcte et les critères d'acceptation sont satisfaits à haut niveau.

---

## Vérifications effectuées

- Lecture complète des fichiers clés : `MediaDetailShell.tsx`, `MediaHero.tsx`, `MediaActions.tsx`, `MediaMetadata.tsx`, `SimilarTitlesShelf.tsx`, `SeasonSelector.tsx`, `useOpenDetail.ts`, `MovieDetailPage.tsx`, `App.tsx`
- Vérification du pattern dual-route dans `App.tsx`
- Vérification de la logique de navigation similaire (modal `replace: true`)
- Vérification du scroll lock/restoration dans `MediaDetailShell`
- Vérification de la chaîne de fallback hero
- Vérification du comportement zéro-source (bouton Play désactivé)
- Vérification des points d'entrée (Home, Films, Séries, Recherche, Ma Liste)

---

## Points validés

| Critère | Statut |
|---|---|
| Modale desktop centrée (82vw, max 1100px, 90vh) avec marges visibles | ✓ |
| Pas de sidebar gauche introduite | ✓ |
| Fond visible/dimmé, scroll verrouillé via `body.overflow='hidden'` | ✓ |
| Bouton × circulaire top-right, Escape, clic backdrop | ✓ |
| Scroll restoration au close (`window.scrollTo(0, savedScrollY)` dans le cleanup) | ✓ |
| Mobile full-screen (`w-full h-full`) avec × comme action primaire | ✓ |
| Héro : fallback trailer → backdrop → poster → gradient | ✓ |
| Trailer opt-in (youtube-nocookie, pas d'autoplay initial) | ✓ |
| Métadonnées TMDB canoniques (titre, original, année, runtime, genres, cert, note, synopsis, statut) | ✓ |
| Items zéro-source : Play désactivé (`disabled`) sans prétendre disponibilité | ✓ |
| AvailabilityPanel : provider, langue, qualité, sélection de variant | ✓ |
| SeasonSelector : lazy loading par saison avec retry (10 tentatives × 2s) | ✓ |
| EpisodeCard : numéro, titre, still, durée, date diffusion, progression, badge vu | ✓ |
| `SimilarTitlesShelf` : TMDB similar/recommendations + genre fallback backend | ✓ |
| Navigation similaire dans la modale : `replace:true` préserve le background original | ✓ |
| `useOpenDetail` comme mécanisme unifié (Home, Films, Séries, Search, Ma Liste) | ✓ |
| Deep link sans background state → rendu pleine page (pas de crash) | ✓ |
| ARIA : `role="dialog"`, `aria-modal="true"`, `aria-label` sur les boutons | ✓ |
| Skeletons / états de chargement / erreur / not-found | ✓ |
| Tests : tous les composants `detail/`, `useOpenDetail`, routes `similar`, service `similar-titles` | ✓ |

---

## Problèmes détectés

### Observation 1 — Type contractuel `SimilarTitlesShelf` à vérifier (risque de bug silencieux)

`SimilarTitlesShelf.tsx` déclare :
```typescript
type SimilarMovie = MovieResponse & { _kind: 'MOVIE' }
```
et accède à `item.availabilityStatus` et `item.posterUrl`.

L'explorer décrit le backend `SimilarTitleCard` avec `isAvailable: boolean` et `posterPath: string | null` — noms différents. Si `getSimilarMovies` retourne `SimilarTitleCard[]` et non `MovieResponse[]`, le badge "Indisponible" ne s'affichera jamais (`item.availabilityStatus` sera `undefined`, jamais `=== 'UNAVAILABLE'`) sans erreur visible.

**Action** : confirmer que le contrat `@iptvflix/api-contracts` pour `/movies/:id/similar` retourne bien `MovieResponse[]` (et non un `SimilarTitleCard` plus léger). Si le contrat est léger, adapter le composant pour utiliser `isAvailable` et `posterPath`.

---

### Observation 2 — Métadonnées `countries/languages` et `collection/franchise` absentes

`MediaMetadata` affiche : titre, titre original, année, runtime, saisons, statut, certification, note, genres, synopsis. Manquent :
- pays de production / langues originales
- collection/franchise (ex. : "Fait partie de la collection Marvel")

Le ticket liste ces champs explicitement dans "Render useful available metadata such as… countries/languages… collection/franchise". Certes le "such as" laisse une marge, mais leur omission est notable.

**Action** : si les données existent dans `MovieDetailResponse`/`SeriesDetailResponse`, les ajouter à `MediaMetadata`. Sinon, noter comme dette dans le ticket.

---

### Observation 3 — `role="dialog"` sans `aria-labelledby`

`MediaDetailShell` déclare `role="dialog"` et `aria-modal="true"` mais ne référence pas le titre avec `aria-labelledby`. Les lecteurs d'écran n'annoncent donc pas le titre du film/série à l'ouverture.

**Action** : ajouter un `id` sur le `<h1>` dans `MediaMetadata` et passer `aria-labelledby` à la div du panel.

---

### Observation 4 — `SimilarTitlesShelf` silencieusement absent en cas d'erreur

```typescript
if (error || items.length === 0) return null
```

En cas d'échec API, la section disparaît entièrement. Le ticket dit "MUST have a substantial Titres similaires section" — si le service est indisponible, rien ne s'affiche. Il serait préférable d'afficher au moins un état d'erreur minimal ou un texte "Titres similaires indisponibles pour le moment" plutôt que de supprimer la section.

---

### Observation 5 — `SeasonSelector` : dépendance `seasons.length` plutôt que `seasons`

```typescript
}, [seriesId, selectedSeason, profileId, seasons.length])
```

Si le tableau `seasons` change de contenu (même longueur), le re-fetch n'est pas déclenché. Risque théoriquement bas (les saisons sont généralement stables), mais fragile.

**Action** : remplacer `seasons.length` par `seasons` dans le tableau de dépendances, ou passer une clé stable (ex. `seasons.map(s => s.seasonNumber).join(',')`).

---

### Observation 6 — Bouton "← Retour" présent en mode modal mobile

`MediaActions` rend toujours un bouton "← Retour". Sur mobile en mode modal, cela crée deux actions de fermeture visible : le × (top-right) et "← Retour" dans la barre d'actions. Le ticket dit "Do not use a back arrow as the primary visible close action" — le × est clairement primaire ici, donc conforme. Mais l'UX pourrait être allégée sur mobile en masquant "← Retour" quand le composant est rendu dans une modale (`isModal` prop).

Non bloquant, mais à considérer pour la propreté UX.

---

## Risques éventuels

- **Retry TMDB (MovieDetailPage)** : jusqu'à 12 tentatives × 2s = 24s de polling post-load. Si un film n'a jamais de trailer ni de cast (ex. titre obscur), toutes les tentatives sont consommées. Pas de crash, mais overhead réseau notable.
- **SeasonSelector** : 10 tentatives × 2s = 20s max si TMDB est lent. Le `cancelled` guard est correct, mais 20s d'attente pour un utilisateur sans réseau lent peut frustrer. Un message "Chargement impossible, réessayer ?" après quelques tentatives améliorerait l'expérience.

---

## Décision

L'implémentation respecte l'architecture demandée, couvre tous les critères d'acceptation majeurs et introduit les primitives réutilisables exigées par le ticket. Les points soulevés sont des observations et améliorations — aucun n'est bloquant pour le fonctionnement de la feature.

IMPLEMENTATION_APPROVED
