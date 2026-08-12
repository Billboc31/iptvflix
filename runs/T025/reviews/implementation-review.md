Now I have a complete picture. Let me write the structured review.

---

## Review — T025: Reuse canonical Series identity when syncing Plex and other providers

### Résumé

L'implémentation introduit `resolveSeriesId()` dans `catalog-sync-service.ts`, miroir exact de `resolveMovieId()`. Les normalisateurs Xtream et Plex peuplent désormais `NormalizedSeriesItem.tmdb`. Sans identifiant TMDB fiable, une nouvelle ligne canonique est créée (comportement préservé). Quatre tests d'intégration couvrent les scénarios critiques.

---

### Vérifications effectuées

- Lu le diff T025-specific (commit `4ca0689`) — seuls 3 fichiers modifiés
- Analysé `resolveSeriesId()` et sa cohérence avec `resolveMovieId()`
- Vérifié les normalisateurs Xtream et Plex
- Analysé les 4 tests d'intégration nouveaux
- Vérifié les patterns de cleanup dans les `finally` blocks
- Confirmé l'absence de logique Plex dans la couche canonique

---

### Points validés

**Correctness du `resolveSeriesId`**
- Pattern SELECT → INSERT ON CONFLICT DO NOTHING → re-SELECT : identique à `resolveMovieId`, résistant aux races concurrentes ✓
- Sans TMDB ID : INSERT inconditionnel → préserve le comportement existant pour les items non-identifiés ✓
- Aucune logique Plex à l'intérieur — provider-agnostic ✓

**Normalisation des providers**
- Xtream : `snapshot.seriesInfo?.[s.series_id]?.info.tmdb_id` — chaînes optionnelles correctes, `s.series_id` est `number`, conforme au type `Record<number, XtreamSeriesInfo>` ✓
- Plex : `extractPlexTmdbId(s.Guid)` — réutilise le helper déjà présent (introduit par T023 pour les films, Plex shows portent le même `Guid[]`) ✓

**Idempotence**
- Canonical `series` : `ON CONFLICT (tmdb_id) DO NOTHING` + re-SELECT garantit zéro doublon ✓
- `seriesAvailabilities` : upsert déjà en place, aucune modification nécessaire ✓

**Tests**
- `reuses an existing canonical series row when Xtream and Plex share the same TMDB ID` → AC #1 ✓
- `creates a new canonical series when Plex-only and no existing match` → AC #2 ✓
- `does not merge same-title series from two providers when no TMDB ID is present` → AC #4 ✓
- `does not create duplicate series or availability rows when the same Plex snapshot is synced twice` → AC #5 ✓
- Cleanup `finally` blocks corrects (ordre FK respecté, cascade testSourceId → afterEach) ✓

**Scope**
- Commit T025 touche exactement 3 fichiers : `xtream/types.ts`, `catalog-sync-service.ts`, test file ✓
- `XtreamSeriesDetail.tmdb_id?: string` — seul changement de type, non-breaking ✓

---

### Problèmes détectés

Aucun problème bloquant.

**Observation mineure (non-bloquant)** : `resolveSeriesId` ne met pas à jour le titre/poster/synopsis si un match TMDB est trouvé (la première sync "gagne"). Ce comportement est intentionnel (cohérent avec `resolveMovieId`), mais n'est pas couvert par un test. Si un titre change entre la sync Xtream et une sync Plex ultérieure, la série canonique garde le titre Xtream. Acceptable pour ce ticket, à documenter pour la couche metadata-enrichment.

---

### Risques éventuels

Aucun risque identifié. L'approche TMDB-only comme signal de merge est conservatrice et correcte : elle évite les faux positifs (même titre, séries différentes).

---

### Décision

Tous les acceptance criteria du ticket sont couverts. L'implémentation est propre, bornée au scope défini, et les tests d'intégration sont robustes.

IMPLEMENTATION_APPROVED
