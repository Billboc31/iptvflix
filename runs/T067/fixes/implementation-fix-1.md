# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T067/reviews/implementation-review.md
- generated at: 2026-08-13T17:42:55Z

---

---

# PR Review — T067: Attach Xtream availability to canonical catalog entities

## Résumé

L'implémentation livre correctement le nouveau service `CanonicalResolver`, le schéma `availabilities` enrichi, les compteurs `syncRuns`, et une suite de tests cohérente. L'architecture de la séparation données canoniques / données provider est solide et la logique de déduplication des titres est bien conçue. Cependant, un problème bloquant interdit l'approbation : le service `CanonicalResolver` n'est jamais injecté dans le chemin de production.

---

## Vérifications effectuées

- `canonical-resolver.ts` — lecture complète
- `catalog-sync-service.ts` — lecture complète (~1 400 lignes)
- `sync-runs-service.ts` — inspection des appels à `CatalogSyncService`
- `episode-backfill-service.ts` — inspection de l'appel `syncCatalog`
- `availabilities.ts` schema + migration `0031_t067_availability_variants.sql`
- `sync-runs.ts` schema (colonnes `resolved_count`, `ambiguous_count`, `unresolved_count`)
- `canonical-resolver.test.ts` + `catalog-sync-service.test.ts` (partiel)
- `metadata-enrichment-service.ts` — signature de `importMovieByTmdbId` / `importSeriesByTmdbId`

---

## Points validés

- **Séparation canonical / provider** — aucun champ provider (titre brut, synopsis Xtream, cover) n'est écrit dans les tables canonical `movies` / `series`.
- **Schéma availability** — `containerExtension` ajouté à `movie_availabilities` et `series_availabilities`, `rawTitle` présent dans les trois tables ; colonnes provider-only uniquement.
- **Compteurs syncRuns** — `resolved_count`, `ambiguous_count`, `unresolved_count` ajoutés au schéma et à la migration, écrits correctement en fin de run.
- **Idempotence** — `onConflictDoNothing` sur toutes les insertions canonical et availability ; `firstSeenAt` préservé sur les mises à jour.
- **TMDB ID overflow** — `parseTmdbId` rejette les valeurs > `PG_INT4_MAX` ; testé en intégration.
- **Episode lifecycle** — protection des séries dont la récupération a échoué (`failedSeriesProviderIds`) ; marquage UNAVAILABLE correct.
- **Tests CanonicalResolver** — 12 cas unitaires couvrent les trois chemins (cache hit, import TMDB, prePassId MATCHED/AMBIGUOUS/null). Les 49 tests d'intégration `catalog-sync-service` passent.

---

## Problèmes détectés

### 🔴 BLOQUANT — `CanonicalResolver` jamais injecté en production

**Fichier** : `apps/api/src/services/sync-runs-service.ts:253,269,272` et `episode-backfill-service.ts:149`

Tous les appels à `CatalogSyncService.syncCatalog`, `syncPlexCatalog`, `syncM3UCatalog` passent `{ runId, matchingService }` sans `canonicalResolver` :

```ts
// sync-runs-service.ts:272 — canonicalResolver absent
await CatalogSyncService.syncCatalog(source.id, snapshot, { runId, matchingService })
```

Conséquence directe : en production, `syncNormalized` utilise systématiquement les chemins de repli :

- **Films / séries** → `importMovieFallback` / `importSeriesFallback` : crée un enregistrement canonical avec le titre placeholder `[TMDB #X]` **sans appeler TMDB** au lieu d'appeler `MetadataEnrichmentService.importMovieByTmdbId()` qui, lui, récupère le vrai titre.
- **Épisodes** → `resolveEpisodeId` (dans `catalog-sync-service.ts:319`) : si l'épisode existe déjà, **écrase `title`, `synopsis`, `airDate`, `durationMinutes` avec les données provider** (lignes 361–373), violant directement l'exigence *"Dirty provider titles must never overwrite canonical display metadata."*

Le `CanonicalResolver` est en l'état du dead code. Le cœur architectural de T067 n'est pas branché.

**Correction attendue** : instancier `CanonicalResolver` dans `sync-runs-service.ts` (et `episode-backfill-service.ts`) puis le passer dans les options de chaque appel `syncCatalog`. `MetadataEnrichmentService` est déjà disponible dans le contexte.

---

### 🔴 BLOQUANT — `resolveEpisodeId` écrase des champs canonical sur épisodes existants

**Fichier** : `apps/api/src/services/catalog-sync-service.ts:361–373`

Même si `CanonicalResolver` était injecté (et que ce chemin devenait un vrai fallback), `resolveEpisodeId` fait un `UPDATE` explicite sur `episodes.title`, `episodes.synopsis`, `episodes.airDate`, `episodes.durationMinutes` à partir des données provider pour les épisodes déjà en base. C'est une violation de la politique canonique pour tout environnement sans `TMDB_API_KEY`.

**Correction attendue** : supprimer le bloc `if (meta) { updates... }` à l'intérieur du `if (existingEpisode)` — pour les épisodes existants, retourner simplement l'ID sans mise à jour. Les données canonical de l'épisode sont la responsabilité de `MetadataEnrichmentService.enrichSeriesSeasons`.

---

### 🟡 OBSERVATION — `resolveEpisodeCanonical` appelé hors transaction

**Fichier** : `apps/api/src/services/catalog-sync-service.ts:1057–1070`

À l'intérieur d'un `db.transaction(async (tx) => {...})`, `canonicalResolver.resolveEpisodeCanonical` utilise le pool global `db` (pas `tx`). Si la transaction échoue après la création de saison/épisode, des enregistrements orphelins `seasons`/`episodes` subsistent. Fonctionnellement inoffensif (ils sont rattachés au prochain sync), mais architecturalement incohérent avec le fallback `resolveEpisodeId(tx, ...)` qui lui respecte le contexte transactionnel.

---

### 🟡 OBSERVATION — Couverture de `resolveEpisodeCanonical` insuffisante

**Fichier** : `apps/api/src/services/__tests__/canonical-resolver.test.ts:141–149`

Le test est un stub qui vérifie uniquement que la méthode existe. Les tests d'intégration dans `catalog-sync-service.test.ts` utilisent le chemin de repli (sans `canonicalResolver`), donc `CanonicalResolver.resolveEpisodeCanonical` n'a aucune couverture réelle. Le plan prévoyait des tests unitaires pour tous les chemins de résolution.

---

## Risques éventuels

- **Titres placeholder permanents** : sans `CanonicalResolver` branché, les films créés en sync restent avec le titre `[TMDB #X]` jusqu'à ce que le job d'enrichissement tourne. Si l'enrichissement échoue, le titre reste pollué. Avec `CanonicalResolver`, le titre TMDB est résolu dès le sync.
- **Double-counting mineur** : `unresolvedCount` est incrémenté dans le pre-pass pour les items UNMATCHED, puis potentiellement incrémenté à nouveau dans la boucle de résolution principale pour les items hors scope du pre-pass. Les deux chemins sont mutuellement exclusifs en pratique, mais le code mérite un commentaire.

---

## Décision

- ~~APPROVED~~
- **REQUEST_CHANGES**

## Actions demandées

1. **[Bloquant]** Dans `sync-runs-service.ts`, instancier `CanonicalResolver` (en injectant le `MetadataEnrichmentService` existant) et le passer dans les appels `syncCatalog`, `syncPlexCatalog`, `syncM3UCatalog`. Faire de même dans `episode-backfill-service.ts`.

2. **[Bloquant]** Dans `catalog-sync-service.ts`, supprimer le bloc de mise à jour des champs canonical dans `resolveEpisodeId` (lignes 361–373) pour les épisodes existants. Retourner simplement l'ID sans mutation des colonnes `title`/`synopsis`/`airDate`/`durationMinutes`.

3. **[Recommandé]** Ajouter un test d'intégration pour `resolveEpisodeCanonical` qui valide le chemin avec `CanonicalResolver` effectivement injecté.

IMPLEMENTATION_FIX_REQUIRED
