# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T022/reviews/implementation-review.md
- generated at: 2026-08-12T06:20:51Z

---

---

# PR Review — T022: Unified Series Season and Episode Availability

## Résumé

L'implémentation couvre l'ensemble des critères d'acceptation du ticket. Deux problèmes medium sont détectés qui nécessitent correction avant approbation.

---

## Vérifications effectuées

Lecture complète de : `packages/api-contracts/src/catalog.ts`, `apps/api/src/routes/catalog.ts`, `catalog.test.ts`, `apps/web/src/lib/api.ts`, `SeriesDetailPage.tsx`, `SeasonAccordion.tsx`, `EpisodeRow.tsx`, `handlers.ts`, `SeasonAccordion.test.tsx`, `EpisodeRow.test.tsx`.

---

## Points validés

- **Contrat** : `SeasonSummary.availableEpisodeCount` et `EpisodeResponse.watchState` ajoutés correctement, typage strict.
- **Backend `GET /series/:id`** : 6ème requête parallèle `count(distinct episodeAvailabilities.episodeId)` groupée par `seasonNumber` — SQL correct, fallback `?? 0` pour saisons sans disponibilités.
- **Backend `GET /series/:id/seasons/:sN/episodes`** : validation UUID du `profileId`, branche ternaire sans accès DB quand absent, `computeWatchState` avec seuils conformes au plan.
- **Multi-source deduplication** : variants groupés par `episodeId`, un seul row par épisode avec `variants.length ≥ 2` — AC respecté.
- **Frontend** : `SeasonAccordion` fraction `X / Y disponible(s)`, lazy-loading avec cache, pluriel correct. `EpisodeRow` `opacity-50` + aria-labels + fallback titre.
- **Tests** : 5 nouveaux cas API + 13 cas composants couvrant tous les états prévus au plan.
- **Scope** : aucun débordement sur le resolver, le write path progress, le player ou le multi-profil UI.

---

## Problèmes détectés

### [MEDIUM] Double map redondante — `apps/api/src/routes/catalog.ts` lignes 323–345

`epVariantMap` et `epRawVariantMap` sont deux maps distinctes alimentées avec **les mêmes objets** dans la même boucle. La seule différence est le typage. Une seule map suffit. C'est ~15 lignes de bruit qui violent le skill code-quality ("garder les fonctions courtes et lisibles", "éviter la magie cachée").

**Correction** : supprimer `epRawVariantMap`, passer `epVariantMap.get(e.id) ?? []` directement à `resolveVariant()`.

---

### [MEDIUM] `DEFAULT_PROFILE_ID` hardcodé — `apps/web/src/pages/SeriesDetailPage.tsx` ligne 61

```tsx
const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001'
```

Le plan demande : *"Retrieve the active profile ID from the existing profile context."* L'UUID hardcodé sera envoyé dans chaque requête épisodes. Dans un contexte mono-profil actuel c'est fonctionnel, mais c'est un écart explicite du plan qui crée une dépendance silencieuse sur le profil 1.

**Correction option A** (minimal) : ne pas passer `profileId` → `watchState: null` pour tous, comportement honnête.  
**Correction option B** (conforme au plan) : appeler `getProfile()` au mount, stocker l'`id` retourné, le passer à `SeasonAccordion`.

---

## Risques éventuels

- [MINOR] Pas de test couvrant `?profileId=not-a-uuid` → 400 (la validation existe côté backend mais n'est pas testée).

---

## Décision

REQUEST_CHANGES

---

## Actions demandées

1. **`apps/api/src/routes/catalog.ts`** — Fusionner `epVariantMap` et `epRawVariantMap` en une seule map.
2. **`apps/web/src/pages/SeriesDetailPage.tsx`** — Remplacer le `DEFAULT_PROFILE_ID` hardcodé : soit `undefined` (watchState null, safe), soit récupération via `getProfile()` au mount.
3. (Non bloquant) Ajouter un test API pour `profileId` invalide → 400.

IMPLEMENTATION_FIX_REQUIRED
