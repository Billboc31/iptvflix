# PR Review — T022: Unified Series Season and Episode Availability

## Résumé

L'implémentation couvre l'ensemble des critères d'acceptation du ticket : contrat API étendu (`availableEpisodeCount`, `watchState`), endpoint étendu avec agrégation des épisodes disponibles par saison et lecture du `viewingProgress` par profil, UI mise à jour (`SeasonAccordion`, `EpisodeRow`), tests API et composants créés. Deux problèmes sont détectés : une duplication de code inutile côté backend (double map) et un écart par rapport au plan concernant la résolution du `profileId`.

---

## Vérifications effectuées

- Lecture du plan et de l'output d'implémentation
- Lecture complète des fichiers modifiés :
  - `packages/api-contracts/src/catalog.ts`
  - `apps/api/src/routes/catalog.ts`
  - `apps/api/src/routes/catalog.test.ts`
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/pages/SeriesDetailPage.tsx`
  - `apps/web/src/components/detail/SeasonAccordion.tsx`
  - `apps/web/src/components/detail/EpisodeRow.tsx`
  - `apps/web/src/test/handlers.ts`
  - `apps/web/src/components/detail/SeasonAccordion.test.tsx`
  - `apps/web/src/components/detail/EpisodeRow.test.tsx`
- Vérification de la couverture des AC ticket vs implémentation
- Vérification du respect du scope (exclusions)
- Vérification de la qualité du code

---

## Points validés

### Contrat API (`packages/api-contracts/src/catalog.ts`)
- `SeasonSummary.availableEpisodeCount: number` ajouté correctement — champ non-optionnel, TypeScript garantit la conformité.
- `EpisodeResponse.watchState: 'unwatched' | 'in_progress' | 'watched' | null` ajouté — union type propre.

### Backend — `GET /series/:id`
- Sixième requête parallèle calculant `count(distinct episodeAvailabilities.episodeId)` groupé par `seasonNumber` avec filtre `status = 'AVAILABLE'`. Logique SQL correcte et efficace.
- Construction de `availEpCountMap` par `seasonNumber` (unique par série) — pas de risque de collision.
- Fallback à `0` via `?? 0` pour les saisons sans disponibilités — comportement correct.

### Backend — `GET /series/:id/seasons/:seasonNumber/episodes`
- Validation UUID du `profileId` avant toute requête (regex + 400) — correct.
- Branche ternaire : si `profileId` absent → `Promise.resolve([])`, aucun accès DB — comportement correct et efficace.
- `computeWatchState` : seuils `< 0.05 / 0.05–0.90 / ≥ 0.90` conformes au plan ; guard sur `durationSeconds === 0` défensif et justifié.
- Regroupement des variants par épisode : un seul episode row avec `variants.length ≥ 2` pour multi-sources — AC `variant deduplication` respecté.

### Frontend
- `getSeriesSeasonEpisodes(seriesId, seasonNumber, profileId?)` : paramètre optionnel passé via `toQuery()` — propre.
- `SeasonAccordion` : lazy-loading avec cache, pas de re-fetch à la réouverture — correct.
- Fraction `X / Y disponible(s)` : masquée si `episodeCount === 0`, pluriel correct en français (`> 1` → `'s'`).
- `EpisodeRow` : `opacity-50` pour UNAVAILABLE, indicateurs `aria-label` pour `watched`/`in_progress`, pas d'indicateur pour `null`/`unwatched`.

### Tests
- API : 5 nouveaux cas couvrant agrégation, watchState null, watchState per-episode, multi-provider, UNAVAILABLE — AC test validé.
- Composants : 6 tests `SeasonAccordion` + 7 tests `EpisodeRow` couvrant tous les états documentés dans le plan.
- `handlers.ts` mis à jour avec `availableEpisodeCount` et `watchState` — cohérence des mocks assurée.

### Scope
- Aucune modification du resolver, du write path `viewingProgress`, de la UI multi-profil ou du player — exclusions respectées.

---

## Problèmes détectés

### [MEDIUM] Double map redondante dans l'endpoint épisodes — `apps/api/src/routes/catalog.ts` lignes 323–345

Le code maintient deux maps distinctes (`epVariantMap` et `epRawVariantMap`) alimentées avec les mêmes objets `variant` dans la même boucle :

```typescript
const epVariantMap = new Map<string, AvailabilityVariantResponse[]>()
const epRawVariantMap = new Map<string, Array<{ id, status, ... }>>()

for (const { episodeId, ...variant } of epVariantRaws) {
  // identique dans les deux maps
  epVariantMap.set(episodeId, ...)
  epRawVariantMap.set(episodeId, ...)
}
```

La seule différence est le typage — les données stockées sont identiques. `epVariantMap` est ensuite utilisé pour `variants:` et `epRawVariantMap` pour `resolveVariant()`. Une seule map suffit.

**Impact** : code inutilement complexe, ~15 lignes de bruit, violation du skill code-quality ("garder des fonctions courtes et lisibles", "éviter la magie cachée").

**Correction attendue** : supprimer `epRawVariantMap`, utiliser `epVariantMap` pour les deux usages.

---

### [MEDIUM] `DEFAULT_PROFILE_ID` hardcodé — `apps/web/src/pages/SeriesDetailPage.tsx` ligne 61

```tsx
const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001'
```

Le plan demande explicitement : *"Retrieve the active profile ID from the existing profile context."* L'implémentation contourne cela avec une constante hardcodée.

**Impact réel limité** : le codebase est actuellement mono-profil (pas de React context de profil, le backend utilise déjà `getDefaultProfilePreferences()` sans contexte profil). L'UUID correspond au profil seedé standard, visible dans `handlers.ts` et les tests existants. Ce n'est pas une régression fonctionnelle dans l'état actuel.

**Problème** : la constante est envoyée à chaque requête épisodes, ce qui lierait silencieusement tous les utilisateurs au profil 1 si le système devenait multi-utilisateurs. Le plan avait identifié ce risque et demandé l'intégration avec le contexte existant.

**Correction attendue** : si aucun React context de profil n'existe, passer `undefined` est le comportement safe (watchState null pour tous) plutôt qu'un UUID hardcodé. Si le profil est accessible via `getProfile()` (disponible dans `api.ts`), le récupérer au mount de la page et l'utiliser.

---

## Risques éventuels

### [MINOR] Pas de test pour `400 Invalid profileId`
Le backend rejette correctement un profileId non-UUID avec 400, mais aucun test ne couvre ce cas. Faible risque de régression.

### [MINOR] `availabilityCount` dans `EpisodeResponse` est redondant avec `availabilityStatus`
Hérité du travail existant (T018), pas introduit par ce ticket. Pas un blocant.

---

## Décision

REQUEST_CHANGES

Les deux problèmes medium doivent être corrigés avant approbation :
1. Fusionner `epVariantMap` et `epRawVariantMap` en une seule map.
2. Remplacer le `DEFAULT_PROFILE_ID` hardcodé par `undefined` (comportement watchState null, safe et honnête) ou par la vraie récupération depuis l'API profil.

---

## Actions demandées

1. **`apps/api/src/routes/catalog.ts`** — Supprimer `epRawVariantMap`. Utiliser uniquement `epVariantMap` pour `resolveVariant()` et pour `variants:` dans la réponse.

2. **`apps/web/src/pages/SeriesDetailPage.tsx`** — Remplacer la constante `DEFAULT_PROFILE_ID` hardcodée par :
   - Option A (minimal) : ne pas passer de `profileId` → `watchState` sera `null`, comportement honnête.
   - Option B (conforme au plan) : appeler `getProfile()` au mount, stocker le `profileId` retourné dans le state, le passer à `SeasonAccordion`.

3. (Optionnel, non bloquant) Ajouter un test API couvrant le cas `?profileId=not-a-uuid` → 400.
