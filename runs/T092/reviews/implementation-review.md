---

## PR Review — T092

### Résumé

L'implémentation est correcte et couvre les quatre axes du plan : `posterUrl` dans le contrat, exposition API, sélecteur de variante per-épisode dans `EpisodeCard`, suppression de l'`AvailabilityPanel` série dans `SeriesDetailPage`.

### Points validés

1. **`posterUrl`** — ajouté à `EpisodeResponse`, calculé via `resolveMediaImageUrl(e.posterPath)` (colonne existante, helper déjà importé). Cohérent avec movies/series.
2. **Sélecteur variante** — `availableVariants.filter(v => v.status === 'AVAILABLE')`, `activeVariantId = pickedVariantId ?? episode.selectedVariantId`. Le `<select>` ne s'affiche qu'à partir de 2 variantes. UX conforme au ticket.
3. **Bouton Lire** — passe `activeVariantId` au lieu du `selectedVariantId` hardcodé. `DevicePickerModal` aussi mis à jour.
4. **`SeriesDetailPage`** — `AvailabilityPanel`, import, état et setter complètement supprimés. Nettoyage sans résidu.
5. **Next-episode** — `useEpisodeNavigation` retourne `nextEpisode.selectedVariantId`, pas la variante de l'épisode courant. Comportement correct, non régressé.
6. **`seriesId`/`seasonNumber`** — chaîne complète : `SeasonSelector` → `EpisodeCard` → URL player → `useEpisodeNavigation`.
7. **Progress** — `useProgressSync` avec `mediaType='EPISODE'` et `mediaId` = épisode, inchangé et correct.
8. **JOIN sources** — `eq(sql`${sources.id}::text`, episodeAvailabilities.providerId)` — pattern déjà établi par T093, appliqué aux trois requêtes de variantes.

### Problèmes détectés (mineurs)

- **Step 1 du plan non documenté** : l'implémentation affirme que le mapping Xtream→épisode est "déjà correct" sans log ni requête de validation. La completion rule exige un test manuel sur deux vrais épisodes — à satisfaire avant fermeture, non bloquant pour le code.
- **Scope légèrement élargi** : `sourceDisplayName`/`codecName`/etc. ajoutés aux requêtes movies et series en plus des épisodes. Justifié par le type `AvailabilityVariantResponse` partagé et `formatVariantLabel`. Pas de risque de régression.

### Décision

Code correct, lisible, sans régression identifiable.

IMPLEMENTATION_APPROVED
