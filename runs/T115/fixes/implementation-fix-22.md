# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-20T21:01:19Z

---

# PR Review — T115: Complete Catalog Enrichment and Make Refresh Failures Resumable/Observable

## Résumé

L'implémentation couvre l'ensemble du périmètre technique du ticket : normalisation des valeurs TMDB invalides, persistance granulaire des échecs avec la vraie cause d'erreur PostgreSQL/driver, nouveau service `CatalogEnrichMissingService` avec pagination par curseur et checkpoint, 4 routes admin, extension des stats catalog, et politique d'éligibilité embedding. Le code est propre, les tests passent (33 tests). **Un seul blocage** : le **Completion Rule** du ticket exige explicitement une exécution sur le catalogue de production (ou snapshot équivalent) avec publication des compteurs avant/après — cette étape n'a pas été réalisée.

---

## Vérifications effectuées

- Lecture de tous les fichiers source modifiés (`catalog-enrich-missing-service.ts`, `metadata-enrichment-service.ts`, `catalog-stats.ts`, `catalog-enrich-missing.ts`, `embedding-eligibility.ts`, `enrichment-failures.ts`, `catalog-refresh-runs.ts`, `tmdb/client.ts`, `types.ts`)
- Lecture des deux migrations SQL (0047, 0048)
- Lecture de la suite de tests T115 (`t115-enrichment.test.ts`, `t115-normalization.test.ts`, `catalog-stats.test.ts`)
- Lecture du plan (`runs/T115/plan.md`) et du rapport de run (`runs/T115/production-run-20260819.md`)
- Vérification de la cohérence schema/migration (index partiel `status='RUNNING'`, upsert sur `(media_type, media_id)`)

---

## Points validés

**Normalisation TMDB (client.ts)**
- `runtime === 0` → `runtimeMinutes: null` via `raw.runtime || null` — correct, évite la violation de contrainte DB.
- `imdb_id === ""` → `imdbId: null` via `raw.imdb_id || null` — correct.
- `overview` whitespace → `synopsis: null` via `raw.overview?.trim() || null` — correct.
- La séparation JSON parse / mapping dans deux `try-catch` distincts permet de distinguer les erreurs de stage `fetch` vs `map` — bien pensé.
- `MetadataMappingError` bien typé et utilisé comme discriminant dans `persistFailure()`.

**Persistance des échecs (`MetadataEnrichmentService.persistFailure`)**
- Extrait `errorClass`, `errorCode`, `errorMessage` depuis l'objet Error réel — fini le `"Failed query: update ... params ..."`.
- Classification transient/terminal dans `classifyError()` : Network*, RateLimit*, ECONNRESET, ETIMEDOUT, ECONNREFUSED → retryable; tout le reste → terminal.
- Upsert sur `(media_type, media_id)` incrémente `retry_count` sur conflit — comportement correct.
- `clearFailure()` appelé en cas de succès — suppression propre.
- `persistFailure()` avec `stage: 'seasons'` préserve la distinction entre échec metadata principale vs enrichissement épisodes.

**Service `CatalogEnrichMissingService`**
- Pagination keyset (`id > lastId ORDER BY id ASC`) — non-sensible aux déphasages offset, reproductible.
- Checkpoint JSONB persisté après chaque batch — survie au redémarrage.
- `checkNoRunningConflict()` + catch 23505 sur l'INSERT — double sécurité contre les runs concurrents, correcte.
- `enrichWithRetry()` ne retente que `'provider-failed'` (erreurs transient) et pas `'terminal-failed'` — logique correcte.
- `resumeRunId` : reprise depuis le curseur d'un run précédent interrompu — idempotent.
- `retryFailures()` : filtre `retryable=true` par défaut, `force=true` inclut les terminaux — fix route appliqué et vérifié.

**Routes admin**
- Validation des paramètres d'entrée (batchSize 1–500, concurrency 1–20, throttleMs ≥ 0, mediaTypes enum) — correcte.
- Codes HTTP cohérents : 202 pour démarrage async, 409 pour conflit run, 404 si aucun run.
- `GET /failures` : pagination + filtres mediaType/retryable.

**Catalog-stats**
- 13 requêtes parallèles couvrant tous les champs demandés par le ticket.
- `embeddingPending` calculé via `NOT EXISTS` (sous-requête réelle) — plus de `0` hardcodé.
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` utilisé comme source unique dans catalog-stats et embedding-backfill-service — pas de duplication inline.
- `enrichedWithSeasonFailures` expose le cas séries dont la metadata principale est enrichie mais les épisodes ont échoué.

**Tests**
- `t115-normalization.test.ts` : couvre runtime=0, imdb_id="", overview whitespace pour movies et series.
- `t115-enrichment.test.ts` : couvre `persistFailure()` avec PostgresError code 23505, et le chemin `stage='db_update'` lors d'une exception DB update.
- Test curseur : vérifie que deux batches sont exécutés et que `enrichMovie` est appelé exactement pour les bons IDs.
- `catalog-stats.test.ts` : couvre les 13 slots de la Promise.all — le mock `seriesSeasonFailureCount` est bien présent.

---

## Problèmes détectés

### [BLOQUANT] Completion Rule non respectée — pas de run production

Le ticket stipule explicitement :

> **Completion rule** : Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Le rapport `runs/T115/production-run-20260819.md` documente un run sur une base locale avec **6 films seulement** (3 enrichis, 2 sans tmdbId, 1 cas de test artificiel avec un TMDB ID invalide `99999999`). Ce run ne constitue pas une validation au sens du Completion Rule. Les critères suivants restent non démontrés sur production :

- Réduction mesurable de `neverEnriched` sur le catalogue réel (~60k films / ~5k séries)
- Causes réelles des 126 échecs de production (notamment `Les Chevaliers du Fiel : L'assassin est dans la salle` avec son vrai TMDB ID)
- Comportement du checkpoint et de la pagination sur un volume de données réel
- Comportement de la migration 0047 (`ALTER TABLE ... ADD COLUMN`) sur une table de production non vide

Le `production-run-playbook.md` existe et documente les étapes exactes. Il doit être exécuté (par un opérateur humain disposant de l'accès Fly.io) et ses résultats attachés avant approbation.

### [Mineur] `retryFailures()` n'écrit pas de stats dans le checkpoint

`retryFailures()` crée un run `catalog_refresh_runs` mais n'initialise ni ne sauvegarde de `checkpoint` contenant les stats. Le statut retourné par `GET /admin/catalog-enrich-missing/status` après un retry run affiche `"stats": null`. Le progrès d'un retry batch n'est donc pas observable en temps réel. Ce comportement est documenté implicitement dans le rapport de run (`{ "status": "COMPLETED", "stats": null }`), mais surprend un opérateur qui s'attend à suivre la progression.

### [Mineur] `retryCount: 0` ambigu sur le premier échec

Lors de la première insertion dans `enrichment_failures`, `retry_count = 0`. Sémantiquement, `0` pourrait signifier "pas encore retryé" ou "premier tentative". Sur conflit, le trigger `+ 1` est correct. Mais la valeur `0` ne distingue pas "échec initial, aucun retry tenté" de l'absence d'information. Aucune correction requise mais un commentaire dans le schema clarifierait (`-- 0 = échec initial, incrémenté à chaque retry ultérieur`).

---

## Risques éventuels

1. **Stats query à l'échelle** : 13 requêtes agrégées parallèles sur 60k lignes sans cache. Sur production à fort trafic, `GET /admin/catalog-stats` pourrait être lent (> 200ms). Pas bloquant mais à monitorer après déploiement.

2. **Unique partial index sur `status='RUNNING'`** : un seul run à la fois (REFRESH ou ENRICH_MISSING). Si une opération de refresh planifiée est en cours au moment où un opérateur démarre manuellement un `enrich-missing`, il recevra un 409. Ce comportement est correct mais mérite d'être documenté dans le playbook.

3. **Rate limiting TMDB à grande échelle** : `enrichWithRetry` retente avec des délais courts (250ms, 500ms, 1000ms). `TmdbClient.fetchWithRetry` gère déjà un premier 429 en interne. Un deuxième 429 lève `TmdbRateLimitError`, classifié comme transient → 3 retries supplémentaires à intervalles courts. Sur 60k films en concurrence 3, ce chemin pourrait amplifier les 429. Pas bloquant mais à surveiller avec `throttleMs` élevé en production (≥ 500ms recommandé dans le playbook).

---

## Décision

L'implémentation est techniquement correcte, bien structurée, et couvre l'ensemble du périmètre code du ticket. La seule raison de ne pas approuver est le **Completion Rule** non honoré : la validation sur catalogue de production (ou snapshot restauré) n'a pas été effectuée et ses résultats ne sont pas publiés.

**Action requise** : exécuter le `production-run-playbook.md` avec accès Fly.io, attacher les compteurs avant/après et la liste des failures réelles (avec leurs `errorClass`, `errorCode`, `errorMessage` authentiques), puis relancer la review.

---

IMPLEMENTATION_FIX_REQUIRED
