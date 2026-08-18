# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T097/reviews/implementation-review.md
- generated at: 2026-08-18T10:49:28Z

---

I now have enough information to write a complete review. Let me produce the structured output.

---

# PR Review — T097: Extend MediaSegment ingestion with TheIntroDB and SkipMe multi-provider support

## Résumé

L'implémentation livre correctement l'essentiel du scope T097 : l'adaptateur `TheIntroDbClient`, le service de merge multi-provider déterministe, la table `segment_selections`, les diagnostics, la mise à jour de l'API client, et une suite de tests unitaires de qualité. Le code est propre, cohérent avec T096, et les tests passent à 50/50.

Deux problèmes bloquants persistent : le backfill ne supporte pas réellement les providers de façon indépendante (le `filterUnsynced` écarte silencieusement les épisodes déjà traités par T096), et la règle de complétion du ticket exige une démonstration de récupération réelle depuis TheIntroDB — absent de l'implémentation.

## Vérifications effectuées

- Lecture complète de tous les fichiers T097 : `theintrodb/client.ts`, `theintrodb/mapper.ts`, `theintrodb/errors.ts`, `theintrodb/types.ts`
- `services/segment-merger.ts` — algorithme de clustering et ranking
- `services/segment-sync-service.ts` — flow complet `syncEpisode`, `upsertSelections`, `filterUnsynced`
- `db/schema/segment-selections.ts` + migration SQL
- `routes/episodes.ts` + `routes/segment-admin.ts`
- `scripts/backfill-segments.ts` + `scripts/smoke-test-segments.ts`
- Suite de tests : `segment-merger.test.ts`, `segment-sync-service.test.ts`, `theintrodb/__tests__/`
- Artefacts de validation : `runs/T097/provider-research.md`, `runs/T097/anime-validation.md`
- Plan complet : `runs/T097/plan.md`

## Points validés

- **Adaptateur TheIntroDB** : path TMDB primary / IMDb fallback, backoff exponentiel sur 429 (max 3 retries, max 60s), warn sur `X-RateLimit-Remaining`, 404 → tableau vide, timeout 10s avec `AbortSignal`. Correct et cohérent avec le pattern IntroDB.
- **Mapper** : conversion secondes→ms, sélection best-entry par `submissions`, type mapping (`intro`→`INTRO`, `recap`→`RECAP`, `credits`→`CREDITS`, `preview`→`PREVIEW`), keys inconnues loggées et ignorées. Conforme.
- **Merger** (`segment-merger.ts`) : clustering ±2s, ranking submissionCount → confidence → providerPriority, discard < 5s, provenance complète. Logique pure sans DB. Déterministe.
- **`segment_selections`** : schéma Drizzle + migration SQL corrects, unique constraint `(episode_id, type)`, cascade delete. Conforme.
- **`SegmentSyncService`** : isolation d'erreur par provider (un échec ne bloque pas l'autre), upsert raw + upsert sélections, résolution `seriesTmdbId` depuis DB. Conforme.
- **Client API** : `GET /episodes/:id/segments` interroge `segment_selections`, retourne contrat identique à T096, provenance cachée côté client. Conforme.
- **Diagnostics** : coverage avec per-provider counts, type breakdowns, overlap, disagreement rate, no-data rate. Épisode-level avec raw + selections + provenance. Conforme sur la majorité des champs.
- **Backfill script** : enregistre les deux providers, passe `providerPriority`. Correct.
- **Documentation** : `provider-research.md` (TheIntroDB CONDITIONALLY VIABLE avec gap ToS documenté, SkipMe NOT VIABLE avec evidence). `anime-validation.md` (3 épisodes anime, gap AniList, season 0, numérotation ordinale). Conforme.
- **Tests unitaires** : 50 cas — merger (13), client TheIntroDB (12), mapper (11), sync service (4 nouveaux). Couverture solide des happy paths et erreurs.

## Problèmes détectés

### [BLOQUANT 1] `filterUnsynced` non provider-aware — backfill multi-provider silencieusement cassé

**Fichier** : `apps/api/src/services/segment-sync-service.ts:259-271`

```ts
private async filterUnsynced(...) {
  const existing = await this.db
    .selectDistinct({ episodeId: mediaSegments.episodeId })
    .from(mediaSegments)
    .where(inArray(mediaSegments.episodeId, episodeIds))
  const synced = new Set(existing.map((r) => r.episodeId))
  return rows.filter((r) => !synced.has(r.episodeId))
}
```

`filterUnsynced` exclut tout épisode ayant **n'importe quel** segment dans `media_segments`, quelle que soit la source. En conséquence, si un épisode a déjà des données IntroDB (T096), le backfill T097 le saute silencieusement sans lui apporter les données TheIntroDB — sauf si `--force` est passé.

Le ticket exige explicitement :
> "Backfill and incremental refresh support multiple providers independently."
> "one provider outage does not prevent another provider from enriching the episode."

La règle s'applique à l'enrichissement par provider, pas seulement à la résilience aux pannes. Tel quel, le déploiement T097 suivi d'un `backfill-segments.ts` sans `--force` enrichira **zéro** épisode existant avec TheIntroDB.

**Correction requise** : soit rendre `filterUnsynced` provider-aware (vérifier si un provider spécifique a déjà traité l'épisode), soit documenter explicitement dans le script et le workflow que le premier backfill T097 sur catalogue existant doit être exécuté avec `--force`.

---

### [BLOQUANT 2] Aucune démonstration de récupération réelle depuis TheIntroDB

La règle de complétion du ticket est explicite :
> "Demonstrate real segment retrieval from every provider classified as viable, persist them for real canonical episodes, show at least one merged/selected result, and prove the normalized IPTVFlix API returns the correct markers."

Le plan reprend ce critère :
> "Smoke test or manual run confirms TheIntroDbClient fetches real segments for at least one live-action episode and one anime episode"

Ce qui existe :
- `smoke-test-segments.ts` — teste uniquement IntroDB avec un serveur mock local (commenter ligne 6 : *"api.introdb.net does not resolve (NXDOMAIN) from this environment"*). TheIntroDB n'est **pas** couvert, et le test est mock-only.
- `anime-validation.md` — présente des timestamps pour 3 épisodes anime avec des IDs TMDB réels, mais aucune trace d'exécution (log, output JSON, screenshot) ne prouve que ces valeurs viennent d'un appel live à `api.theintrodb.org/v3`. Les timestamps correspondent à des durées connues publiquement.
- `implementation-output.md` — mentionne "50/50 tests pass" qui sont des tests unitaires avec réseau mocké.

Si l'environnement n'a pas accès à internet, ce fait doit être documenté explicitement dans `runs/T097/` avec une note indiquant comment la validation a été effectuée (ex. appel curl depuis un environnement avec accès, output brut conservé). Sinon un smoke test réel contre TheIntroDB est requis.

---

### [OBSERVATION 1] Placeholders hardcodés dans les diagnostics

**Fichier** : `apps/api/src/routes/segment-admin.ts:91-93`

```ts
identifierMismatchRate: 0,
animeEpisodes: 0,
animeWithAnySegment: 0,
```

Le ticket demande "anime coverage by provider" et "identifier mismatch rate" dans les diagnostics. Ces champs retournent toujours 0. Ils sont affichés dans la réponse de production sans indicateur qu'ils sont non implémentés.

Ce n'est pas bloquant si le scope de ces métriques est officiellement exclu (aucun champ `isAnime` n'existe dans le schéma actuel), mais il faudrait soit les supprimer de la réponse, soit les marquer `null` avec documentation.

---

### [OBSERVATION 2] `formClusters` : tolérance transitive, pas absolue

**Fichier** : `apps/api/src/services/segment-merger.ts:23-38`

Le clustering compare chaque segment au **dernier élément du cluster**, pas au premier. Cela permet des clusters transitifs : A à 80 000 ms, B à 81 500 ms (dans cluster avec A), C à 83 000 ms (dans cluster avec B car delta=1 500 ms ≤ 2 000 ms) — mais C est à 3 000 ms de A. En pratique pour des intros, ce cas est improbable, mais c'est un comportement potentiellement surprenant.

---

### [OBSERVATION 3] `upsertSelections` — N+1 requêtes DB

**Fichier** : `apps/api/src/services/segment-sync-service.ts:95-119`

Les sélections sont insérées en boucle `for (const s of sorted)` avec une requête par sélection. Pour un épisode (2-5 segments max), c'est négligeable. Pour un backfill massif avec `--force`, cela génère des allers-retours supplémentaires. Non bloquant à ce volume, mais à noter.

---

### [OBSERVATION 4] `SegmentProvider` sans propriété `id`

Le ticket suggère une interface avec `id: string`. L'implémentation utilise `provider.constructor.name` pour les logs (`segment-sync-service.ts:165`), ce qui peut être perdu après minification. Non bloquant fonctionnellement mais écart de robustesse.

---

### [OBSERVATION 5] Hardcoding des noms de providers dans les requêtes SQL de diagnostic

**Fichier** : `apps/api/src/routes/segment-admin.ts:54-76`

```sql
WHERE ms1.source_provider = 'introdb'
  AND ms2.source_provider = 'theintrodb'
```

L'ajout d'un troisième provider nécessitera une mise à jour manuelle du SQL. À documenter ou rendre configurable si/quand SkipDB est intégré.

## Risques éventuels

- **ToS TheIntroDB** : le gap ToS est correctement documenté dans `provider-research.md`. L'adaptateur est déployé avec la caveat que le caching server-side à grande échelle nécessite confirmation. Acceptable à ce stade, mais le contact avec `hello@theintrodb.org` doit être effectué avant mise en production à grande échelle.
- **Backfill silencieux** (voir BLOQUANT 1) : sans `--force`, les métriques de coverage TheIntroDB resteraient à zéro sur un catalogue existant, pouvant induire en erreur sur la qualité de l'intégration.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[BLOQUANT 1]** Corriger le comportement du backfill pour les épisodes T096 existants. Option minimale : documenter dans `backfill-segments.ts` (commentaire ou `--help`) que `--force` est requis pour enrichir les épisodes déjà traités par T096. Option robuste : rendre `filterUnsynced` provider-aware.

2. **[BLOQUANT 2]** Fournir une trace de récupération réelle depuis `api.theintrodb.org/v3` pour au moins un épisode live-action et un épisode anime — soit par exécution du smoke test avec le vrai endpoint, soit en conservant l'output `curl` brut dans `runs/T097/`. Si l'environnement n'a pas accès internet, documenter explicitement ce fait et la méthode de validation alternative utilisée.

3. **[OBSERVATION 1]** Soit supprimer `animeEpisodes`, `animeWithAnySegment`, `identifierMismatchRate` de la réponse `/admin/segments/coverage`, soit les remplacer par `null` avec un commentaire expliquant qu'ils nécessitent le champ `isAnime` dans le schéma.

IMPLEMENTATION_FIX_REQUIRED
