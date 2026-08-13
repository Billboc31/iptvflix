I have a clear picture of the full implementation. Let me write the final review.

---

# PR Review — T067: Attach Xtream availability to canonical catalog entities

## Résumé

Il s'agit d'une seconde review post-corrections. Les deux blocages identifiés lors du premier passage ont été corrigés correctement : `CanonicalResolver` est maintenant câblé dans tous les chemins de production, et `resolveEpisodeId` ne mute plus les champs canoniques. La recommandation sur les tests d'intégration de `resolveEpisodeCanonical` a aussi été honorée. L'implémentation est conforme au ticket et au plan.

---

## Vérifications effectuées

- `sync-runs-service.ts` — `createOptionalCanonicalResolver()` et injection dans les trois appels sync
- `episode-backfill-service.ts` — instanciation et passage de `canonicalResolver`
- `catalog-sync-service.ts:319–386` — `resolveEpisodeId` : absence du bloc UPDATE sur épisodes existants
- `catalog-sync-service.ts:660–848` — chemins de résolution film/série avec `canonicalResolver`
- `canonical-resolver.ts` — logique complète des trois méthodes
- `availabilities.ts` — colonnes provider-only dans les trois tables
- `sync-runs.ts` — colonnes `resolvedCount`, `ambiguousCount`, `unresolvedCount`
- `0031_t067_availability_variants.sql` — migration cohérente avec le schéma
- `canonical-resolver.test.ts` — couverture unitaire + intégration

---

## Points validés

- **Fix bloquant #1 résolu** — `createOptionalCanonicalResolver()` instancie `CanonicalResolver(new MetadataEnrichmentService(db, TmdbClient))` et le passe aux trois branches (Xtream / Plex / M3U) dans `sync-runs-service.ts:257–280` et dans `episode-backfill-service.ts:153–159`. Le resolver n'est plus du dead code.
- **Fix bloquant #2 résolu** — `resolveEpisodeId` (lignes 360–361) retourne désormais `existingEpisode.id` sans aucune mutation. Les champs `title`, `synopsis`, `airDate`, `durationMinutes` ne sont plus écrasés sur les épisodes existants.
- **Recommandation honorée** — `canonical-resolver.test.ts` contient deux tests d'intégration DB réels pour `resolveEpisodeCanonical` : création de saison/épisode et idempotence avec vérification qu'un second appel ne réécrit pas le titre.
- **Chemins de résolution film/série** — la logique TMDB ID → `canonicalResolver.resolve*` → fallback local est correcte et s'applique de façon symétrique aux films et aux séries.
- **Séparation canonical/provider** — aucune donnée provider (titre brut, synopsis Xtream) n'est écrite dans `movies` / `series` via le chemin `CanonicalResolver`. Le fallback `importMovieFallback` crée uniquement un placeholder `[TMDB #X]` sans champ provider.
- **Schéma et migration** — `containerExtension` ajouté à `movie_availabilities` et `series_availabilities` ; `rawTitle`, `audioLanguage`, `subtitleLanguage`, `videoQuality` présents dans les trois tables ; migration 0031 cohérente.
- **Compteurs syncRuns** — `resolved_count`, `ambiguous_count`, `unresolved_count` dans le schéma, la migration, et écrits via `persistSyncRunProgress`.
- **Idempotence** — `onConflictDoNothing` partout sur les insertions canonical et availability.
- **Tests** — 706/710 passent, les 4 échecs restants sont des défaillances préexistantes dans `vertical-slice.test.ts` non liées à T067.

---

## Problèmes détectés

### 🟡 OBSERVATION (maintenu) — `resolveEpisodeCanonical` hors contexte transactionnel

`canonical-resolver.ts:99–157` utilise le pool global `db` alors qu'il est appelé à l'intérieur d'un `db.transaction()` dans `catalog-sync-service.ts:1046–1059`. En cas d'échec de la transaction parente après création de saison/épisode, des enregistrements orphelins peuvent subsister. Inoffensif fonctionnellement (ils seront rattachés au prochain sync), mais toujours architecturalement incohérent avec `resolveEpisodeId(tx, ...)` qui respecte le contexte transactionnel. Aucune action bloquante requise.

---

## Risques éventuels

Aucun nouveau risque introduit par les corrections. L'observation sur la transaction était déjà identifiée et non bloquante.

---

## Décision

- **APPROVED**
- ~~REQUEST_CHANGES~~

## Actions demandées

Aucune. L'observation sur la transaction est un point d'amélioration future, pas un blocage.

IMPLEMENTATION_APPROVED
