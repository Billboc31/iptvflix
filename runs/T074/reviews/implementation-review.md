Good, the TypeScript error is confirmed. Now I have everything needed to write the review.

---

# PR Review — T074: Populate canonical TV seasons and episodes from TMDB

## Résumé

L'implémentation couvre l'essentiel du ticket de manière propre et focalisée : upsert canonique des saisons et épisodes, hydratation prioritaire au bootstrap, trigger on-demand, et tests ciblés. Un défaut TypeScript bloquant est introduit dans les tests, et un garde de concurrence manque pour le trigger on-demand (déviation explicite du plan). Le reste est correct.

---

## Vérifications effectuées

- `metadata-enrichment-service.ts` : logique d'upsert saisons et épisodes
- `catalog-bootstrap-service.ts` : configuration, tier prioritaire, checkpoint
- `routes/catalog.ts` : trigger fire-and-forget, header `X-Hierarchy-Hydrating`
- `index.ts` : câblage des services
- `providers/metadata/types.ts` et `tmdb/client.ts` : champs `name` et `airDate` sur les saisons
- `config/env.ts` : nouvelle variable `CATALOG_BOOTSTRAP_HIERARCHY_PRIORITY_COUNT`
- Tests : `metadata-enrichment-service.test.ts`, `catalog-bootstrap-service.test.ts`, `catalog.test.ts`
- Vérification TypeScript (`tsc --noEmit`)

---

## Points validés

**Upsert canonique (`metadata-enrichment-service.ts`)**
- `enrichSeries()` : `INSERT ... ON CONFLICT (seriesId, seasonNumber) DO UPDATE` correct avec `sql\`EXCLUDED.*\`` pour les champs ; season 0 gérée nativement sans filtre.
- `enrichSeriesSeasons()` : `INSERT ... ON CONFLICT (seasonId, episodeNumber) DO UPDATE` ; `episodeAvailabilities` et watch-state intacts (tables séparées non touchées).
- `updatedAt: sql\`now()\`` inclus dans les deux upserts — propre.
- Throttle 250ms entre saisons dans `enrichSeriesSeasons()`.

**Bootstrap (`catalog-bootstrap-service.ts`)**
- Tier prioritaire post-étapes : top-N par `popularity`, batches de 5, délai 500ms inter-batch, checkpoint `hierarchy:priority`, logs clairs.
- Résumabilité : `checkpoint[hierarchyKey]?.done` évite de rejouer le tier en cas de reprise.
- `BootstrapConfig.hierarchyPriorityCount` avec défaut 200 via `env.ts`.

**On-demand hydration (`routes/catalog.ts`)**
- Condition triple correcte : `seasonRows.length === 0 && seriesRow.tmdbId != null && opts.enrichmentService`.
- Fire-and-forget via `void` ; `X-Hierarchy-Hydrating: true` retourné immédiatement.
- Câblage `index.ts` correct : `enrichmentService` passé aux deux services.

**Tests**
- 5 nouveaux cas dans `metadata-enrichment-service.test.ts` : upsert sans source, idempotence, épisodes source-free, épisode TMDB crée une ligne.
- 3 cas d'hydratation on-demand dans `catalog.test.ts` (trigger, non-trigger si saisons présentes, non-trigger si `tmdbId` null).
- Coverage fonctionnel suffisant pour les acceptance criteria.

**Types TMDB**
- `ExternalSeriesMetadata.seasons[].name` et `.airDate` ajoutés dans `types.ts`; `mapSeriesDetail()` les popule depuis `raw.seasons`.

---

## Problèmes détectés

### [BLOQUANT] TypeScript type error dans `catalog-bootstrap-service.test.ts`

`tsc --noEmit` confirme :

```
src/services/__tests__/catalog-bootstrap-service.test.ts(16,7): error TS2741:
Property 'hierarchyPriorityCount' is missing in type '{ maxPagesPerFeed: number;
... }' but required in type 'BootstrapConfig'.
```

Le champ `hierarchyPriorityCount: number` a été ajouté comme requis dans l'interface `BootstrapConfig`, mais l'objet `config` du test (ligne 16) n'a pas été mis à jour. Le CI type-check échouera.

**Fix requis** : ajouter `hierarchyPriorityCount: 200` à l'objet `config` du test (ligne 23), ou rendre le champ optionnel dans l'interface avec une valeur par défaut dans le constructeur.

---

### [MINEUR] Garde de concurrence absent pour le trigger on-demand

Le plan spécifiait explicitement : *"AND enrichment is not already running"*. L'implémentation déclenche `enrichSeries(id)` à chaque requête `GET /series/:id` quand `seasonRows.length === 0`. Si N requêtes simultanées arrivent pour la même série non hydratée, N appels TMDB concurrents sont déclenchés.

Les upserts étant idempotents, aucune donnée corrompue ne résulte. Mais cela gaspille le quota TMDB et pourrait déclencher du rate-limiting sur des séries très demandées au démarrage. L'impact est faible en pratique, mais c'est une déviation documentée du plan.

**Fix suggéré** : un `Set<string>` en mémoire (ou un champ de module) des IDs en cours d'hydratation suffit. Pas de persistance DB nécessaire.

---

### [OBSERVATION] Tier bootstrap prioritaire peut sauter des séries récemment enrichies sans saisons

`enrichSeries()` retourne `'skipped'` si `metadataEnrichedAt` est dans la fenêtre `staleDays`. Une série enrichie avant ce fix (donc sans saisons) et dont `metadataEnrichedAt` est récent sera sautée par le tier prioritaire. Le refresh scheduler la ramassera à sa prochaine fenêtre de staleness.

Pour un bootstrap initial (toutes séries nouvelles, `metadataEnrichedAt = null`), ce cas ne se produit pas. Pour un re-bootstrap sur un catalogue existant, certaines séries resteront sans hiérarchie jusqu'au prochain cycle de refresh. Ce comportement est acceptable mais mériterait un commentaire dans le code.

---

### [OBSERVATION] Parallélisme bootstrap × rate-limit TMDB

Le tier prioritaire lance 5 séries en `Promise.all`. Chaque `enrichSeries()` fait 4 appels TMDB parallèles (metadata, videos, credits, certification). Cela représente jusqu'à 20 requêtes TMDB simultanées par batch, au-delà de la fenêtre TMDB de ~40 req/10s. Le retry/backoff du client TMDB absorbe les 429, mais le bruit sera visible. Acceptable compte tenu de la stratégie documentée ; à surveiller en prod.

---

## Risques éventuels

- Aucun risque de régression sur les `episodeAvailabilities` ou watch-state (tables distinctes, non touchées par les upserts).
- L'idempotence des upserts est correctement garantie par les contraintes DB `(seriesId, seasonNumber)` et `(seasonId, episodeNumber)`.
- Le fire-and-forget ne propage aucune erreur à l'appelant HTTP.

---

## Décision

L'implémentation est fonctionnellement correcte et bien structurée. Un défaut TypeScript bloquant introduit dans les tests doit être corrigé avant fusion. La déviation sur le garde de concurrence est mineure mais documentée dans le plan ; elle devrait être adressée dans le même fix.

**Actions requises :**
1. **[Bloquant]** Ajouter `hierarchyPriorityCount: 200` à l'objet `const config: BootstrapConfig` dans `catalog-bootstrap-service.test.ts` ligne 16.
2. **[Conseillé]** Ajouter un garde simple contre les hydrations concurrentes dans le handler `GET /series/:id`.

IMPLEMENTATION_FIX_REQUIRED
