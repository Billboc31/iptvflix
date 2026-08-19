# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T16:50:14Z

---

Now I have everything needed. Here is the review:

---

# PR Review — T115 — Complete catalog enrichment and make refresh failures resumable/observable

## Résumé

L'implémentation couvre correctement les trois axes du ticket : mode `enrich-missing` resumable avec pagination par curseur, observabilité des échecs par persistance structurée en base, et stats catalog enrichies. La qualité du code est bonne et les conventions sont respectées. Un seul critère d'acceptation reste non satisfait : le passage en production mandaté par la completion rule.

---

## Vérifications effectuées

- Lecture complète de : `catalog-enrich-missing-service.ts`, `metadata-enrichment-service.ts`, `catalog-stats.ts`, `catalog-enrich-missing.ts`, `embedding-eligibility.ts`, `enrichment-failures.ts` (schema), migrations 0046/0047, diff TMDB client, tests T115.
- Vérification de la concordance entre le schéma Drizzle et les migrations SQL.
- Vérification de la pagination par curseur vs. offset.
- Vérification de l'idempotence de l'upsert `enrichment_failures`.
- Vérification de la protection contre l'exécution concurrente (index partiel + race condition sur insert).
- Vérification de la cohérence du prédicat d'éligibilité embedding entre `embedding-eligibility.ts`, `catalog-stats.ts` et `embedding-backfill-service.ts`.
- Lecture du fichier `implementation-output.md` sur l'état des corrections.

---

## Points validés

**Failure observability (AC1)**
- `classifyError()` extrait correctement `errorClass` (nom du constructeur), `errorCode` (code driver), `errorMessage` depuis n'importe quel `Error` ou valeur non-Error.
- `persistFailure()` fait un upsert idempotent sur `(media_type, media_id)` et incrémente `retryCount` via `${enrichmentFailures.retryCount} + 1`.
- Les étapes `fetch`, `map`, `db_update`, `seasons` sont correctement distinguées.
- Le test `t115-enrichment.test.ts` vérifie que `PostgresError` avec code `23502` est capturé avec `errorClass: 'PostgresError'` — ce qui répond directement au cas de production mentionné dans le ticket.
- `clearFailure()` supprime proprement l'entrée en cas de succès.

**TMDB normalization (AC2)**
- `runtime: 0` → `runtimeMinutes: null` via `raw.runtime || null` (`0` est falsy).
- `imdb_id: ""` → `imdbId: null` via `raw.imdb_id || null`.
- `overview?.trim() || null` élimine les synopsis vides ou whitespace-only pour movies et series.
- `MetadataMappingError` permet de distinguer erreur de parsing vs erreur réseau dans `enrichMovie`/`enrichSeries`.

**Enrich-missing mode (AC3, AC4)**
- Pagination par curseur `WHERE id > :lastId ORDER BY id LIMIT batchSize` — aucun drift d'offset possible.
- Checkpoint sauvegardé après chaque batch : le run est resumable même en cas de crash entre batches.
- Filtre correct : `tmdbId IS NOT NULL AND matchStatus = 'MATCHED' AND (metadataEnrichedAt IS NULL OR metadataEnrichedAt < threshold)`.
- Idempotence : les titres déjà enrichis récemment sont sautés (retourne `'skipped'`).
- Support `force=true` pour forcer le re-traitement des titres déjà frais.
- Concurrence contrôlée par `runWithConcurrency` avec retry exponentiel (250ms / 500ms / 1000ms) pour les erreurs transientes.
- Protection contre les runs concurrents via index partiel `WHERE status = 'RUNNING'` + double-check sur code `23505` à l'insert.
- 4 endpoints REST : `POST` (start), `GET /status`, `GET /failures`, `POST /retry-failures`.

**Terminal failure persistence (AC5)**
- Table `enrichment_failures` bien définie avec tous les champs requis par le ticket.
- Pagination des échecs listables (`/failures?page=&limit=&mediaType=&retryable=`).
- `retryFailures()` filtre par défaut sur `retryable=true`, `force=true` pour forcer le retry des terminal.

**Catalog stats (AC6)**
- Nouveau champ `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment` calculés via `FILTER (WHERE ...)` en une seule query par type de média.
- `embeddingPending` calculé via un `NOT EXISTS (SELECT 1 FROM media_embeddings WHERE ...)` réel — corrige le bug mentionné dans le ticket ("Do not report `embeddingPending: 0` when the embedding corpus has not been created").
- `enriched = partiallyEnriched + fullyEnriched` est cohérent.

**Embedding eligibility (AC8)**
- Prédicat unique dans `embedding-eligibility.ts`, partagé entre `catalog-stats.ts` et `embedding-backfill-service.ts`.
- La politique est documentée : `metadataEnrichedAt IS NOT NULL` est la condition minimale. Les champs préférés (synopsis, genres, originalLanguage) sont documentés mais pas bloquants.
- `embeddingBlocked` est commenté comme toujours 0 avec l'explication de la raison — correct et honnête.

**AC7 — Lazy enrichment no longer required**
- Le mode `enrich-missing` peut couvrir l'intégralité du catalog sans ouverture de page de détail.

---

## Problèmes détectés

### [BLOQUANT] — Completion rule non respectée : run production non effectué

**Ticket, Completion rule :**
> "Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."

**Dernier critère d'acceptation :**
> "Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."

L'`implementation-output.md` est explicite :
> "Correction 2 — Production catalog run (remains blocked) : flyctl is installed but unauthenticated (flyctl auth login required). Production DNS is not resolvable from this environment. This is a human operator action."

Le playbook (`runs/T115/production-run-playbook.md`) a été écrit mais pas exécuté. Les before/after counts de production ne sont pas publiés. Les vraies causes d'échec du run de production initial (126 failures) ne sont pas exposées avec les vrais messages d'erreur DB.

Ce critère d'acceptation ne peut pas être satisfait par du code — il requiert une action humaine (authentification flyctl + exécution du playbook curl). La review ne peut pas approuver sans cette validation.

**Action requise :** Exécuter `flyctl auth login`, lancer le playbook `runs/T115/production-run-playbook.md` contre le catalog de production, et publier les résultats before/after ainsi que la liste des failures terminales avec leurs vraies causes d'erreur.

---

### [MINEUR] — Incohérence stat : série avec `metadataEnrichedAt` set ET entrée dans `enrichment_failures`

Dans `enrichSeries()` (`metadata-enrichment-service.ts:437-458`) : si le DB update de la série réussit (→ `metadataEnrichedAt` est writté) mais que `enrichSeriesSeasons()` échoue, alors :
- La série est comptée dans `fullyEnriched` / `embeddingEligible` (car `metadataEnrichedAt IS NOT NULL`).
- La série est **aussi** comptée dans `failedLastEnrichment` (car une entrée existe dans `enrichment_failures`).

Ces deux compteurs sont présentés côte à côte dans le stats endpoint, ce qui peut induire les opérateurs en erreur (une série ne peut pas être simultanément "enriched" et "failed last enrichment" de manière intuitive). La sémantique réelle est correcte (les métadonnées principales sont présentes, les épisodes sont incomplets), mais le stats endpoint ne la documente pas.

**Suggestion :** Soit documenter ce comportement dans la réponse du stats endpoint (`enrichedWithSeasonFailures: N`), soit setter `metadataEnrichedAt` uniquement si tous les stages réussissent (plus strict, mais change le comportement de skipping).

---

### [MINEUR] — `retryFailures` avec 0 échecs crée un run COMPLETED

`catalog-enrich-missing-service.ts:386-390` : quand `failures.length === 0`, le code insère quand même un run avec `status: 'COMPLETED'`. Ce run sans items traités pollue le log des runs. Comportement non bloquant.

---

### [MINEUR] — `enrichPending()` toujours présent et non-resumable

`MetadataEnrichmentService.enrichPending()` (ligne 614+) charge tous les IDs éligibles en mémoire d'un coup. Sur 60k films, c'est ~1MB de UUIDs, acceptable, mais surtout : ce mode n'a pas de checkpoint. Si appelé depuis le refresh flow, il peut re-traiter les mêmes items à chaque cycle sans progrès visible. Le ticket demandait d'auditer pourquoi les refresh capés continuaient de revisiter les mêmes lignes — cet audit n'est pas explicitement documenté.

Le nouveau `CatalogEnrichMissingService` remplace ce besoin pour l'enrichment batch. Vérifier que `enrichPending` n'est plus le chemin principal pour un enrichment complet.

---

## Risques éventuels

- **Rate limit TMDB** : le backoff de 250/500/1000ms est très court si TMDB renvoie un 429. Les RateLimit errors sont classifiées comme retryables mais le délai ne respecte pas la fenêtre de rate limit TMDB standard (typiquement 1s+). En pratique le `throttleMs` entre items + concurrence limitée amortit cela, mais un burst reste possible.
- **mediaType non contraint en DB** : la colonne `media_type` dans `enrichment_failures` est `text` sans CHECK constraint. Un bug applicatif écrivant `'movie'` au lieu de `'MOVIE'` passerait inaperçu silencieusement. Risque faible (TypeScript protège), mais un CHECK CONSTRAINT serait plus robuste.
- **Index partiel sur `catalog_refresh_runs`** : si un ENRICH_MISSING et un REFRESH essaient de démarrer simultanément, l'un bloquera correctement. Si un run reste en statut RUNNING indéfiniment (crash sans update), plus aucun run ne peut démarrer. Il n'y a pas de timeout ou de cleanup des runs fantômes.

---

## Décision

- REQUEST_CHANGES

---

## Actions demandées

1. **[BLOQUANT]** Exécuter le playbook `runs/T115/production-run-playbook.md` sur le catalog de production avec un opérateur authentifié (`flyctl auth login`). Publier dans les artefacts du ticket :
   - Les stats catalog avant le run (`/admin/catalog-stats`).
   - Les stats catalog après le run.
   - La liste des failures terminales avec leurs vraies causes (`/admin/catalog-enrich-missing/failures`).
   - Une comparaison before/after montrant la réduction du nombre de titres incomplets.

2. **[MINEUR, optionnel]** Clarifier le cas "série enrichie + échec seasons" dans les stats : soit documenter la sémantique dans le retour API, soit changer la logique pour ne pas setter `metadataEnrichedAt` si les seasons échouent.

3. **[MINEUR, optionnel]** Ne pas insérer un run COMPLETED quand `retryFailures` est appelé sans failure à traiter.

---

IMPLEMENTATION_FIX_REQUIRED
