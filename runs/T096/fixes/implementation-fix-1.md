# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T096/reviews/implementation-review.md
- generated at: 2026-08-18T09:09:17Z

---

I have a complete picture of the implementation. Writing the review now.

---

# PR Review — T096: Import and sync intro/recap/outro/credits segment metadata

## Résumé

L'implémentation livre un pipeline complet et bien structuré : schéma `media_segments`, provider IntroDB, service de sync avec upsert idempotent, 36 tests, endpoints API publics et admin, scheduler avec 3 priorités. La qualité de code est globalement bonne et la plupart des critères d'acceptation sont couverts par la structure.

Deux problèmes empêchent l'approbation immédiate.

---

## Vérifications effectuées

- Migration SQL `0036_t096_media_segments.sql`
- Schéma Drizzle `media-segments.ts`
- Client IntroDB (`client.ts`, `mapper.ts`, `types.ts`, `errors.ts`)
- Abstraction `SegmentProvider` / `types.ts`
- `SegmentSyncService` (upsert, syncEpisode, backfillCatalog)
- `imdb-resolver.ts`
- Scheduler (`scheduler-service.ts`) — intégration segment refresh
- Routes `GET /episodes/:id/segments` et `/admin/segments/coverage` + `/admin/segments/episode/:id`
- Script `backfill-segments.ts`
- Hook `setOnNewEpisodeHook` dans `sync-runs-service.ts` et `canonical-resolver.ts`
- Contrat `packages/api-contracts/src/segments.ts`
- Tests : client, mapper, segment-sync-service, imdb-resolver, episodes-segments route

---

## Points validés

**Schéma et migration**
- Table `media_segments` conforme au ticket : tous les champs requis, enum `segment_type` extensible, contrainte unique sur `(episode_id, type, source_provider)`, cascade DELETE, index sur `episode_id`. Correct.

**Provider IntroDB**
- Implémente bien `SegmentProvider` ; 404 → `null` (pas d'erreur) ; 429 → backoff exponentiel avec cap à 60s, max 3 tentatives ; timeout via `AbortSignal.timeout` ; pas de clé API requise. Conforme au ticket §3.
- Conversion secondes → millisecondes correcte (`Math.round`).
- `sourceProvider = 'introdb'` stocké sur chaque ligne — provenance garantie.

**IMDb resolution**
- `resolveAndPersistSeriesImdbId` : lecture locale en premier, persistance si absent, no-op si pas de TMDB ID. Évite les appels TMDB répétés. Conforme au ticket §2.

**SegmentSyncService**
- Upsert via `onConflictDoUpdate` sur la contrainte unique — idempotent.
- Season-0 : log structuré `segment_numbering_ambiguous`, compteur `mismatches++`, zéro ligne insérée. Correct.
- `backfillCatalog` : pagination par 200, `filterUnsynced` pour sauter les épisodes déjà synchés (sauf `--force`), `withBoundedConcurrency`, erreurs non fatales, métriques JSON. Conforme §6.

**Scheduler**
- 3 niveaux de priorité : recent (chaque tick), no-data (tick % 3), stable (tick % 7). Concurrence bornée à 3. Cadence configurable via env. Conforme §8.

**Hook on-demand**
- `setOnNewEpisodeHook` + `createOptionalCanonicalResolver` lit le hook au moment de l'appel (`triggerSync`). Comme le hook est enregistré synchroniquement au démarrage (avant tout déclenchement de sync), le timing est sûr. Conforme §7.

**Endpoints API**
- `GET /episodes/:id/segments` exposé publiquement, ne retourne que `type/startMs/endMs`. Conforme §12.
- Admin routes dans `protectedScope` → protégées par `authenticate`. Conforme §14.
- Shape du contrat `EpisodeSegmentsResponse` identique à l'exemple du ticket.

**Tests**
- Couverture des cas : 404, 429/retry, mapping anime (One Piece fixture), season-0, idempotence upsert, provenance, IMDb resolver (cache hit, TMDB fetch, pas de tmdbId). Conforme §15.

---

## Problèmes détectés

### [BLOQUANT 1] Completion rule non satisfaite : aucune validation contre des données réelles

Le ticket impose explicitement :

> "Do not close because the schema/provider interface exists. Validate against real public data for at least one live-action series episode and at least two Anime episodes, persist the returned segment(s) in IPTVFlix DB, and prove the normalized API returns them for the correct canonical episodes."

L'`implementation-output.md` contient seulement :
> "Committed as 6d544aa. T096 is done — 28 files, 1430 insertions, 36 passing tests."

Il n'y a aucune trace de smoke test réel : pas de log de `pnpm backfill:segments`, pas de résultat JSON d'un appel IntroDB contre One Piece ou Bleach, pas de capture de `GET /episodes/:id/segments` retournant des segments réels.

Le code est structurellement correct mais la completion rule n'est pas satisfaite. Les tests utilisent des fixtures mocked, pas l'API publique réelle.

**Action requise** : exécuter le smoke test complet — résoudre l'IMDb ID de One Piece et Bleach via TMDB, appeler IntroDB, persister en DB, vérifier `GET /episodes/:id/segments` avec les IDs canoniques réels. Documenter le résultat dans un fichier d'artefact.

---

### [BLOQUANT 2] `withAnySegment` dans `/admin/segments/coverage` charge tous les UUIDs en mémoire

`segment-admin.ts` lignes 20-23 :

```ts
const withAnySegment = await db
  .selectDistinct({ episodeId: mediaSegments.episodeId })
  .from(mediaSegments)
const withAnyCount = withAnySegment.length
```

Pour un catalogue de 50 000 épisodes, cela rapatrie potentiellement 50 000 UUID dans Node.js pour compter. Le reste de la même requête utilise `COUNT(DISTINCT ...)` via `sql<number>` — c'est incohérent. Remplacer par :

```ts
const [anyRow] = await db.select({
  withAny: sql<number>`cast(count(distinct episode_id) as integer)`,
}).from(mediaSegments)
const withAnyCount = Number(anyRow?.withAny ?? 0)
```

Ce n'est pas bloquant sur un petit catalogue mais c'est un bug de scalabilité réel pour une installation production.

---

## Risques éventuels (non bloquants)

**Dead code — `IntroDbNoDataError`**
La classe `IntroDbNoDataError` dans `errors.ts` est définie mais n'est jamais jetée ni importée. À supprimer.

**`sourceExternalId` jamais renseigné par le mapper**
Le mapper ne peuple pas `sourceExternalId` même si la clé composite `(imdbId, season, episode)` pourrait y être stockée pour tracabilité. Acceptable pour v1 mais à documenter comme limitation connue.

**Pas de test d'intégration pour `backfillCatalog`**
L'acceptance criteria mentionne "runs to completion twice without errors and produces identical row counts" — ce cas n'est pas couvert par les tests automatisés. Acceptable si le smoke test manuel couvre ce cas.

**`IntroDbRateLimitError` perd la valeur réelle du header `Retry-After`**
Le client récupère le header mais le throw utilise le constructeur par défaut (`retryAfterSec = 60`) : `throw new IntroDbRateLimitError()`. La valeur extraite du header est utilisée pour le backoff local mais pas stockée dans l'erreur propagée. Mineur.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[Obligatoire]** Exécuter le smoke test réel contre IntroDB : One Piece + Bleach (anime, 2 épisodes minimum) + 1 série live-action. Persister en DB, vérifier `GET /episodes/:id/segments`, documenter le résultat dans `runs/T096/smoke-test.md`.

2. **[Obligatoire]** Corriger `/admin/segments/coverage` : remplacer `selectDistinct` + `.length` par un `COUNT(DISTINCT episode_id)` SQL côté serveur.

3. **[Souhaitable]** Supprimer `IntroDbNoDataError` (dead code).

IMPLEMENTATION_FIX_REQUIRED
