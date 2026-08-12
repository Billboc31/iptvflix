# PR Review — T018: Add profile playback preferences and deterministic best-availability selection

## Résumé

L'implémentation couvre l'essentiel du ticket : schéma DB étendu, service resolver déterministe, routes profil, intégration dans les routes catalogue, page frontend de préférences et UI de sélection de variante. Le code est propre et bien structuré. Deux problèmes nécessitent une correction avant validation.

## Vérifications effectuées

- Lecture de tous les fichiers modifiés dans les commits `0dac4cb` et `363c958`
- Comparaison avec le plan (`runs/T018/plan.md`) étape par étape
- Vérification de l'algorithme de scoring (5-tuple) contre les critères d'acceptance
- Analyse des tests unitaires et d'intégration
- Vérification que la page de préférences n'utilise pas `navigator.language`

## Points validés

- **Schéma DB** : 4 colonnes ajoutées correctement (`preferred_audio_languages`, `preferred_subtitle_languages`, `preferred_source_ids`, `max_video_quality`), migration `0012` correcte avec defaults `'{}'` et null.
- **Contrats API** : `AvailabilityVariantResponse` étend avec `status` + `providerId`, `selectedVariantId` ajouté à `MovieDetailResponse`, `SeriesDetailResponse`, `EpisodeResponse`. Types profil corrects.
- **Resolver** (`availability-resolver.ts`) : filtre AVAILABLE → scoring 5-tuple (audioScore, subtitleScore, sourceScore, qualityScore, id) → tri ascendant → gagnant. Cap qualité correct (`Math.min(rank, cap)`). Variant null-audio inclus comme fallback, non exclu. Tiebreak lexicographique UUID. 16 tests unitaires couvrent tous les cas du plan §7 (no_available_variant, unavailable exclusion, audio preference ordering, subtitle tiebreak, source vs quality, quality cap, null metadata, tie-break determinism).
- **Profile service** : `getDefaultProfilePreferences`, `updateDefaultProfilePreferences` avec merge partiel correct. Cas `maxVideoQuality: null` géré via `'maxVideoQuality' in patch`.
- **Routes profil** : `GET /profile` et `PATCH /profile/preferences` avec validation input (arrays, valeurs quality valides). Enregistrement dans `index.ts` confirmé.
- **Intégration catalog** : `/movies/:id`, `/series/:id`, `/series/:id/seasons/:N/episodes` chargent les préférences une fois et appellent `resolveVariant()`. `selectedVariantId` inclus dans toutes les réponses détail.
- **Frontend** : `ProfileSettingsPage` lit les préférences depuis le profil DB, n'utilise pas `navigator.language`. UI de sélection variante dans `MovieDetailPage` et `SeriesDetailPage`. Variante UNAVAILABLE non sélectionnable. Nav + route `/settings/playback` en place.
- **Critères d'acceptance ticket** : 1, 2, 3, 4, 5, 6, 7 vérifiés par tests automatisés.

## Problèmes détectés

### [BLOQUANT 1] Test `ProfileSettingsPage.test.tsx` manquant

Le plan §7 exige explicitement :

> **`apps/web/src/pages/ProfileSettingsPage.test.tsx`** (new) :
> - MSW handler returns profile with `preferredAudioLanguages:["en"]`, `preferredSubtitleLanguages:["fr"]`
> - Page renders the language fields with those values regardless of `navigator.language` mock
> - Submitting triggers `PATCH /profile/preferences` with correct body

Ce fichier n'existe pas. Les autres pages ont leurs tests (`MovieDetailPage.test.tsx`, `MoviesPage.test.tsx`, etc.) — l'infrastructure MSW est en place. Le critère d'acceptance #9 ("Profile settings page renders language preference inputs without reading `navigator.language`") est donc non vérifiable automatiquement. La preuve que UI locale et préférences de lecture sont indépendantes — point clé du ticket — repose uniquement sur une revue manuelle du code.

**Correction attendue** : créer `apps/web/src/pages/ProfileSettingsPage.test.tsx` avec les trois cas listés dans le plan.

---

### [BLOQUANT 2] Régression UUID validation sur les routes détail catalog

Les anciennes routes `/movies/:id` (dans `movies.ts`) et `/series/:id` (dans `series.ts`) validaient le format UUID avant de requêter la DB :

```typescript
if (!UUID_RE.test(request.params.id)) {
  return reply.status(404).send({ error: `Movie ${request.params.id} not found` })
}
```

Les nouvelles routes dans `catalog.ts` n'ont pas cette validation. En production, un identifiant non-UUID comme `"nonexistent"` provoquera une erreur Postgres (`invalid input syntax for type uuid`) → réponse 500 au lieu de 404.

Les tests dans `catalog.test.ts` (e.g. `GET /movies/nonexistent` → 404) ne détectent pas cette régression car ils mockent le client DB, qui retourne `[]` indépendamment de la valeur de l'id.

**Correction attendue** : ajouter la validation UUID dans les handlers `GET /movies/:id` et `GET /series/:id` de `catalog.ts` (réutiliser le pattern `UUID_RE` ou laisser Fastify gérer via un schéma de validation de paramètre).

---

### [MINEUR 1] QUALITY_ORDER tripliqué — déviation du plan

Le plan §5 stipule : "Remove the local `bestQuality()` / `QUALITY_ORDER` duplicates from `catalog.ts` and `catalog-service.ts`; quality ranking now lives exclusively in the resolver."

`QUALITY_ORDER` et `bestQuality()` restent dans `catalog.ts` (ligne 40-53) et dans `catalog-service.ts` (ligne 11-22). La constante est maintenant en trois exemplaires.

Note : l'usage dans `catalog.ts`/`catalog-service.ts` est différent (calcul du champ `quality` d'affichage → meilleure qualité disponible), pas du scoring de sélection. Un argument fonctionnel existe pour les garder. Mais le plan dit le contraire, et la triplication est un signal de dette.

**Correction suggérée** : exporter `QUALITY_ORDER` et une helper `bestQuality()` depuis `availability-resolver.ts` et les importer dans `catalog.ts` et `catalog-service.ts`, ou créer un fichier `quality-utils.ts`.

---

### [MINEUR 2] Deux maps épisodes pour les mêmes données (`epVariantMap` / `epRawVariantMap`)

Dans le handler épisodes de `catalog.ts` (lignes 262-284), deux `Map` sont construites en parallèle à partir des mêmes objets `variant` :
- `epVariantMap` (type `AvailabilityVariantResponse[]`) — utilisé pour `variants` dans la réponse
- `epRawVariantMap` (type inline avec les champs du resolver) — utilisé pour `resolveVariant()`

Les deux maps stockent les mêmes références d'objets. Une seule map suffirait avec un cast TypeScript approprié.

**Correction suggérée** : supprimer `epRawVariantMap`, utiliser `epVariantMap` directement pour les deux usages.

---

### [MINEUR 3] `resolveReason` peut retourner `'fallback_quality'` à tort

```typescript
if (winner.videoQuality !== null) return 'fallback_quality'
return 'tie_break'
```

Ce test vérifie si le gagnant *a* une qualité, pas s'il a *gagné* grâce à la qualité. Un gagnant ayant remporté le tiebreak UUID avec `videoQuality: '720p'` retournera `'fallback_quality'` au lieu de `'tie_break'`. Cela n'affecte pas la sélection, seulement l'explicabilité.

## Risques éventuels

- La régression UUID (BLOQUANT 2) est masquée par les mocks de test et ne sera visible qu'en production ou en test d'intégration réel.
- L'absence du test ProfileSettings (BLOQUANT 1) laisse une surface d'erreur ouverte si un développeur ultérieur tente de lier la langue UI aux préférences de lecture par inadvertance.

## Décision

IMPLEMENTATION_FIX_REQUIRED

## Actions demandées

1. **[Requis]** Créer `apps/web/src/pages/ProfileSettingsPage.test.tsx` avec :
   - Mock MSW retournant `{ preferredAudioLanguages: ["en"], preferredSubtitleLanguages: ["fr"], ... }`
   - Test : les champs langue s'affichent avec ces valeurs indépendamment de `navigator.language`
   - Test : submit déclenche `PATCH /profile/preferences` avec le bon body

2. **[Requis]** Ajouter validation UUID dans `catalog.ts` pour `GET /movies/:id` et `GET /series/:id` :
   ```typescript
   const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
   if (!UUID_RE.test(id)) return reply.status(404).send({ error: 'Movie not found' })
   ```
   Et ajouter un test dans `catalog.test.ts` qui vérifie que `/movies/not-a-uuid` retourne 404 (sans mocker le select pour ce cas).

3. **[Optionnel]** Dédupliquer `QUALITY_ORDER`/`bestQuality` — acceptable de laisser pour un ticket de refactoring dédié si le scope est contraignant.

4. **[Optionnel]** Fusionner `epVariantMap` et `epRawVariantMap` en une seule map dans le handler épisodes.

IMPLEMENTATION_FIX_REQUIRED
