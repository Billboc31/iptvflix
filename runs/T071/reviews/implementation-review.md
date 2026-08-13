I have all the information needed for the review. Let me write it.

---

# PR Review — T071 Immersive responsive Movie & Series detail experience

## Résumé

L'implémentation respecte l'architecture définie dans le plan : pages route-based, shell partagé, 7 nouveaux composants, tests unitaires complets. La structure globale est solide. Un bug fonctionnel bloquant est identifié sur la gestion du Season 0 (Spéciaux), plusieurs lacunes mineures sur la couverture de métadonnées et la présentation des disponibilités.

---

## Vérifications effectuées

- Lecture de tous les composants créés (`MediaHero`, `MediaMetadata`, `MediaActions`, `AvailabilityPanel`, `SimilarTitlesShelf`, `SeasonSelector`, `EpisodeCard`)
- Lecture des pages modifiées (`MovieDetailPage.tsx`, `SeriesDetailPage.tsx`)
- Lecture de toutes les suites de tests (6 nouvelles + 2 mises à jour)
- Vérification des handlers MSW et des fixtures
- Audit des `useEffect` pour des problèmes de lifecycle

---

## Points validés

- **Architecture** : Route-based propre, pas de modal, deep links fonctionnels, back navigation correcte.
- **Hero** : Priorité backdrop → poster → gradient dark, fallback silencieux sur `onError`, pas de container vide exposé. Le bouton bande-annonce est absent quand `trailerKey` est null. L'iframe YouTube s'affiche correctement au clic.
- **Zero sources** : `availabilityStatus: 'UNAVAILABLE'` → bouton play désactivé + label "Non disponible", watchlist/feedback toujours actifs. Validé par test.
- **SimilarTitlesShelf** : skeleton loading, état vide et erreur retournent null gracieusement. Les titres catalog-only (0 sources) apparaissent bien avec badge "Indisponible". Navigation récursive vers `/movies/:id` et `/series/:id` couverte par test.
- **SeasonSelector** : cache local des episodes par saison (ne re-fetch pas). Dropdown accessible avec `<label>` `sr-only`. Changement de saison sans quitter la page. Couvert par test.
- **EpisodeCard** : numéro, titre, synopsis, runtime, date, état "Vu" / "En cours", play button désactivé si `UNAVAILABLE`. Touch target ≥ 44px.
- **API** : `getSimilarMovies`, `getSimilarSeries` ajoutés proprement dans `api.ts`. Handlers MSW cohérents.
- **Responsive** : Hero full-width via `clamp(300px, 56.25vw, 70vh)` + `w-full`. Poster sidebar `hidden md:block`. Actions `flex-wrap` + `min-h-[44px]`. Layout vertical scrollable sur mobile.
- **Pas de sidebar** : aucune réintroduction, top-nav préservée.
- **Enrichment badges** : `unmatched` → "Données manquantes", `partial` → "Données partielles", `matched` → rien. Validé.
- **Résultats tests** : 238 pass, 5 failures pré-existantes confirmées non introduites.

---

## Problèmes détectés

### 🔴 BLOQUANT — Season 0 (Spéciaux) ne charge jamais ses épisodes

**Fichier** : `apps/web/src/components/detail/SeasonSelector.tsx:23`

```ts
if (seasons.length === 0 || selectedSeason === 0) return
```

**Ce qui se passe** : l'état initial est `seasons[0].seasonNumber`. Si la première saison de la série est la saison 0 (Spéciaux / Hors-saison), `selectedSeason` démarre à `0`, et le guard du `useEffect` retourne immédiatement → les épisodes ne sont jamais chargés. L'utilisateur voit le dropdown avec "Spéciaux" sélectionné mais aucun épisode.

Le guard `seasons.length === 0` est par ailleurs redondant car le composant a déjà un early return au-dessus si `seasons.length === 0`.

**Le ticket exige explicitement** (section 9) : *"Handle: specials / season 0 where present"*.

**Fix** : supprimer la condition `selectedSeason === 0` du guard :

```ts
// Avant
if (seasons.length === 0 || selectedSeason === 0) return

// Après
if (episodeCache.has(selectedSeason)) return   // le seul guard nécessaire
```

La vérification `seasons.length === 0` est déjà couverte par l'early return JSX ci-dessus.

---

### 🟡 Mineur — Provider absent de `AvailabilityPanel`

**Fichier** : `apps/web/src/components/detail/AvailabilityPanel.tsx:13-19`

Le ticket donne comme exemple de rendu :
```
Xtream Codes     FR     4K
```

`variantLabel` affiche uniquement `FR · 4K`. Le `providerId` est disponible dans `AvailabilityVariantResponse` mais ignoré. Le résultat est moins informatif qu'attendu, surtout quand plusieurs providers existent.

Suggestion : ajouter le `providerId` (ou un label de provider mappé) en premier élément de `parts`.

---

### 🟡 Mineur — Still image des épisodes non implémentée

**Fichier** : `apps/web/src/components/detail/EpisodeCard.tsx:33-35`

Le plan décrit "lazy still image". L'implémentation affiche un placeholder `🎬`. Si `EpisodeResponse` expose un champ `stillUrl`, il devrait être utilisé. Si ce champ n'existe pas dans le contrat API actuel, noter que c'est à implémenter plus tard.

---

### 🟡 Mineur — Métadonnées incomplètes dans `MediaMetadata`

**Fichier** : `apps/web/src/components/detail/MediaMetadata.tsx`

Le ticket (section 4) liste : production country, original language, collection/franchise. Ni `MediaMetadata` ni les pages ne les rendent. Acceptable si ces champs ne sont pas encore exposés dans `MovieDetailResponse` / `SeriesDetailResponse`, mais mérite une note dans l'implémentation pour suivi.

---

### 🟡 Observation — Race condition potentielle dans `SimilarTitlesShelf`

**Fichier** : `apps/web/src/components/detail/SimilarTitlesShelf.tsx:24-34`

Si `mediaId` change avant la résolution du fetch (ex. navigation rapide via les titres similaires), les résultats de la requête précédente peuvent s'appliquer au nouvel état. Risque faible en pratique (route-based → remount), mais recommande un flag "stale" ou `AbortController`.

---

### 🔵 Style — `const fetch` shadow la globale

**Fichier** : `apps/web/src/components/detail/SimilarTitlesShelf.tsx:27`

```ts
const fetch = mediaType === 'MOVIE' ? ...
```

Renommer en `promise` ou `fetchPromise` pour éviter la shadow de `window.fetch`.

---

## Risques éventuels

- Le bug Season 0 peut affecter des séries populaires (ex. Breaking Bad, Stranger Things qui ont des épisodes spéciaux). Risque utilisateur direct et visible.
- L'absence du provider dans `AvailabilityPanel` peut être confuse quand le même titre est disponible en Xtream et Plex simultanément.

---

## Décision

L'implémentation est correcte dans son ensemble et couvre la très grande majorité du périmètre du ticket. Un seul point bloquant : le bug Season 0 qui viole une exigence explicite de la spec.

IMPLEMENTATION_FIX_REQUIRED
