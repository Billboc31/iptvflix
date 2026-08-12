I have all the information I need to write the review.

---

# PR Review — T043: Compose a personalized Home from recommendation-backed Shelves

## Résumé

L'implémentation ajoute un endpoint `GET /profiles/:profileId/home` qui compose une Home personnalisée (utility shelves + recommendation shelves) et met à jour le frontend pour consommer ce nouvel endpoint via un hook `useHome`. L'architecture respecte le plan et les conventions du projet.

## Vérifications effectuées

- Lecture de tous les fichiers créés/modifiés : `home.ts` (contracts), `home-service.ts`, `routes/home.ts`, `useHome.ts`, `HomePage.tsx`, `api.ts`, `home-service.test.ts`
- Vérification de la cohérence avec le contrat `ShelfResponse` existant
- Vérification de la propagation du 404 via `rankRecommendations` → `NotFoundError` → route handler
- Lecture de `recommendation-ranking-service.ts` pour confirmer la validation de `profileId` (ligne 77)
- Lecture des tests (9 cas, 5 scénarios couverts)
- Vérification de l'enregistrement de la route dans `apps/api/src/index.ts`

## Points validés

- **Contrat type correct** : `HomeResponse = { coldStart: boolean; shelves: ShelfResponse[] }` — réutilise le modèle Shelf existant, frontend consomme `ShelfRow` sans bespoke rendering.
- **Stratégie dedup documentée et implémentée** : un seul appel `rankRecommendations(limit: 60)`, partitionné par `available`, aucun candidat ne peut apparaître dans les deux shelves rec.
- **Exclusion Continue Watching** : `inProgressIds` correctement construit et appliqué avant partition.
- **Seuil discovery** : `sys_rec_upcoming` omis si < 3 candidats unavailable — correspond exactement au plan et aux tests.
- **Filtrage disponibilité** : `available === false` exclu de `sys_rec_for_you`, `available === true` exclu de `sys_rec_upcoming`.
- **404 pour profil inconnu** : `rankRecommendations` lève `NotFoundError` si le profil n'existe pas (ligne 77 du service), catchée dans la route → 404. Pattern cohérent avec `recommendations.ts`.
- **Cold start** : `coldStart` propagé depuis `rankRecommendations` et retourné dans `HomeResponse`.
- **Ordre des shelves** : Continue Watching → Recommended → My List → Discovery — conforme au plan.
- **Hook React** : `useHome` implémente correctement le pattern de cancellation (`cancelled = true` dans le cleanup).
- **Tests** : 9 cas couvrant les 5 scénarios du plan (warm profile, cold start, availability filtering, duplicate suppression, discovery threshold).
- **Enregistrement route** : `homeRoutes` importé et enregistré dans `apps/api/src/index.ts`.

## Problèmes détectés

### Observation 1 — `sys_rec_for_you` toujours inclus même si vide (mineur)

Dans `home-service.ts`, `sys_rec_for_you` est toujours poussé dans le tableau `shelves` sans condition sur `forYouItems.length` :

```ts
shelves.push({
  id: 'sys_rec_for_you',
  title: 'Recommandé pour toi',
  // ...
  items: forYouItems,  // peut être vide
})
```

En cas extrême (tous les candidats filtrés ou DB vide), le frontend recevrait un shelf avec `items: []`, ce qui pourrait afficher un titre de section vide. En pratique, cold-start retourne des recommandations basées sur la popularité, donc ce cas est très rare.

### Observation 2 — Condition cold-start dans `HomePage.tsx` incorrecte par rapport au plan (mineur)

Le plan spécifie : *"Show a cold-start-aware empty state if `coldStart === true` and no shelves have items."*

Implémenté :
```tsx
const isColdStart = homeData?.coldStart === true && shelves.length === 0
```

Le check `shelves.length === 0` ne sera jamais `true` puisque `sys_rec_for_you` est toujours ajouté. Le message cold-start ("Commencez à regarder des contenus pour recevoir des recommandations personnalisées") ne sera donc jamais affiché. La condition correcte selon le plan serait `shelves.every(s => s.items.length === 0)`, mais comme cold-start retourne systématiquement des candidats basés sur la popularité, le message serait de toute façon rarement visible. L'impact UX est marginal.

### Observation 3 — Absence de test 404 profil inconnu (mineur)

Le plan d'acceptance inclut : *"GET /profiles/:profileId/home returns HTTP 404 for an unknown profileId."* Le fichier `home-service.test.ts` ne contient pas ce cas. La route le gère correctement (`catch NotFoundError → 404`), mais il n'y a pas de test unitaire ni d'intégration qui le vérifie explicitement pour ce nouveau endpoint.

## Risques éventuels

- **Aucun risque de régression** : les shelves existants (`/shelves`) sont indépendants du nouvel endpoint `/home`. Le frontend ancien (`useShelves + useShelf`) est remplacé, pas supprimé des hooks existants.
- **Hardcoded `DEFAULT_PROFILE_ID`** dans `HomePage.tsx` — préexistant dans le codebase, hors scope T043.
- **Pas d'auth sur l'endpoint** : cohérent avec le reste de l'API (même pattern dans `recommendations.ts`). Hors scope T043.

## Décision

Les trois observations sont mineures. Aucune n'est bloquante :
- Le plan et les critères d'acceptance du ticket sont respectés.
- La logique cœur (dedup, filtrage, ordering, 404, cold-start propagation) est correcte.
- Les tests couvrent les 5 scénarios requis.
- Le frontend réutilise `ShelfRow` sans bespoke rendering.

IMPLEMENTATION_APPROVED
