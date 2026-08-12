---

# PR Review — T035: Extend source availability lifecycle to episode transitions

## Résumé

L'implémentation est globalement correcte et bien architecturée. La logique de cycle de vie épisode est correctement intégrée dans `syncNormalized()`, les sept critères d'acceptation sont couverts dans le code, et les tests Xtream sont exhaustifs. Un problème bloquant a été identifié.

## Points validés

- **AC1** — `SOURCE_APPEARED` émis exactement une fois lors de la première insertion, protégé par `onConflictDoNothing()`.
- **AC2** — Re-sync d'un épisode déjà `AVAILABLE` n'émet aucun événement.
- **AC3** — `SOURCE_DISAPPEARED` émis correctement via `UPDATE … RETURNING` sur les épisodes absents du snapshot.
- **AC4** — `SOURCE_APPEARED` émis lors de la réapparition (`wasUnavailable === true`).
- **AC5** — `sourceId` propagé sur chaque événement, testé explicitement.
- **AC6** — Enum DB, type service, route API et contrat d'API tous étendus à `EPISODE`. `upsertReleaseFields` reste `MOVIE | SERIES` (correct).
- **Sécurité de périmètre** — `snapshot.episodes !== undefined` protège les syncs sans données épisode (Xtream).
- **Migration** — 0014 extension additive de l'enum, sans risque régressif.

## Problème bloquant

### P1 — Absence de test Plex pour les transitions d'épisodes

**AC7** demande explicitement : *"Automated tests cover Xtream and Plex episode transitions where practical."*

`syncPlexCatalog` normalise bien les épisodes Plex et les passe à `syncNormalized()`, mais tous les tests `syncPlexCatalog` existants passent `episodes: []`. Aucun test n'exerce le chemin avec des épisodes réels, ni ne valide l'émission de `SOURCE_APPEARED`/`SOURCE_DISAPPEARED` via Plex.

**Correction attendue** : au minimum un test d'intégration `syncPlexCatalog` couvrant première apparition + re-sync sans changement.

## Observations mineures

- **Contrainte unique manquante sur `episodeAvailabilities`** : `movieAvailabilities` et `seriesAvailabilities` ont `unique().on(t.providerId, t.providerItemId)` en plus ; `episodeAvailabilities` non. La logique de disparition filtre par `providerItemId` sans `episodeId`, ce qui serait incorrect si un provider réutilisait un ID (théorique). Suggéré : aligner avec une migration.
- **`PlexCatalogSnapshot.episodes` toujours requis** : contrairement à Xtream où `seriesInfo` est optionnel, passer `episodes: []` pour un refresh Plex déclencherait de faux `SOURCE_DISAPPEARED`. Suggéré : rendre le champ optionnel ou documenter la contrainte.

## Décision

`IMPLEMENTATION_FIX_REQUIRED` — un test Plex épisode lifecycle doit être ajouté pour satisfaire AC7.

---

IMPLEMENTATION_FIX_REQUIRED
