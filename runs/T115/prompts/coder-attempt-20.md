# GLOBAL CONTEXT

# Global Context — Iptvflix

## Project

- project_id: iptvflix
- repo: git@github.com:Billboc31/iptvflix.git

## AI Dev Factory

This project uses AI Dev Factory for AI-assisted development.

Agent context folders:
- `ai/` — roles and skills
- `docs/` — project documentation
- `prompts/` — ticket-specific and generic prompts
- `runs/` — per-ticket runtime artifacts
- `tickets/` — ticket definitions

---

# ROLE

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

---

# SKILL: workflow-discipline

# Skill — Workflow Discipline

## Objectif

Faire respecter le lifecycle officiel des tickets et PR IA.

## Règles

- respecter l’ordre des étapes du workflow
- ne pas bypass les reviews obligatoires
- maintenir les statuts cohérents
- conserver les artefacts versionnés
- séparer plan, implémentation et mémoire

## Refuser si

- une review obligatoire est sautée
- la mémoire est mise à jour avant validation implémentation
- le workflow officiel est contourné

---

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T115 — Complete catalog enrichment and make refresh failures resumable/observable

**Source**: GitHub Issue #242

## Description

## Context

A real production catalog refresh completed with:
- 2,725 movies refreshed
- 807 series refreshed
- 0 imported (expected after bootstrap)
- **126 failed updates**

The latest refresh checkpoint shows bounded batches (for example `refresh:MOVIE:stable offset 2750`, `refresh:SERIES:stable offset 800`) rather than a complete enrichment pass over the full ~60k movie / ~5k series catalog.

Some titles are still visibly incomplete until opened, indicating lazy/on-demand enrichment remains in use.

Before generating the production embedding corpus, we need a deterministic way to fully enrich all eligible catalog titles and retry failures.

## Goals

1. Provide a complete/resumable `enrich missing` pass over the canonical catalog.
2. Diagnose and fix the 126 refresh failures instead of only storing a generic failed query string.
3. Expose accurate enrichment progress so we know when the catalog is ready for embeddings.

## Required investigation

Audit `CatalogRefreshService` and related metadata enrichment code to determine:
- why stable refresh is capped/batched at the observed offsets;
- how titles are selected for `recent`, `stable`, `upcoming`;
- whether repeated refresh runs eventually cover the entire incomplete population or continually revisit the same rows;
- why specific updates fail;
- whether nullable/empty TMDB values such as runtime `0`, empty IMDb ID, empty synopsis, keywords/collection/external IDs can violate DB constraints or type expectations.

The production example failure included a movie update for `Les Chevaliers du Fiel : L'assassin est dans la salle`; preserve and expose the actual PostgreSQL/driver error cause, not only `Failed query: update ... params ...`.

## Enrich-missing mode

Add an explicit resumable mode/action that targets all canonical movies/series whose metadata is incomplete/stale, independently from the normal periodic refresh cadence.

It should:
- enumerate eligible incomplete rows deterministically;
- process in bounded batches with configurable concurrency/rate limiting;
- checkpoint by stable cursor/key so restart does not lose progress;
- skip already-complete/fresh rows unless forced;
- retry transient TMDB/DB failures with bounded retry/backoff;
- retain per-item terminal failures for later retry;
- be idempotent;
- support movies and series;
- not depend on opening a detail page to become enriched.

## Failure observability

Persist/report at minimum for each terminal failure:
- media type;
- media ID;
- TMDB ID;
- title;
- stage (`fetch`, `map`, `db_update`, etc.);
- sanitized error class/code/message;
- retry count;
- occurredAt;
- whether retryable.

Do not log secrets/credentials.

Expose run-level stats such as:
- total eligible;
- processed;
- enriched/completed;
- skipped already complete;
- remaining;
- retrying;
- failed terminal;
- current rate;
- ETA if practical.

## Catalog stats

Extend `/admin/catalog-stats` (or a dedicated diagnostic endpoint) so we can distinguish:
- total canonical titles;
- fully enriched;
- partially enriched;
- never enriched;
- stale;
- failed last enrichment;
- embedding eligible;
- embedding blocked by incomplete metadata.

Do not report `embeddingPending: 0` when the embedding corpus has not actually been created in the target pgvector DB.

## Embedding readiness

Define an explicit minimum metadata-quality policy for embedding generation. At minimum document which fields are required/preferred and whether incomplete titles are excluded or embedded with reduced documents.

The eventual backfill must be able to select only titles that meet this policy, and later pick up titles once enrichment succeeds.

## Acceptance criteria

- [ ] Production refresh failure root causes are observable with the real DB error, not only generated SQL/params.
- [ ] Known classes of invalid/empty TMDB values are normalized safely.
- [ ] Explicit `enrich missing` pass exists and is resumable/idempotent.
- [ ] Re-running it progresses toward zero eligible incomplete titles rather than repeatedly processing the same capped batch.
- [ ] Terminal failures are persisted/listable and individually retryable or retryable as a batch.
- [ ] Admin stats expose complete/partial/missing/failed/remaining counts accurately.
- [ ] Detail-page lazy enrichment is no longer required to obtain complete metadata for eligible catalog items.
- [ ] Embedding eligibility/readiness is explicit and accurate.
- [ ] Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population.

## Completion rule

Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

The TS errors are in unchanged files (`commands.test.ts`, `pairing.test.ts`) — pre-existing, not introduced by this change.

Here is what was done to address the review's two required corrections:

**Correction 1 — `db_update` PostgresError capture demonstrated (code fix):**

- `t115-enrichment.test.ts` — the `enrichMovie() — failure stored when DB update throws` test now:
  - Sets `Object.defineProperty(dbErr, 'constructor', { value: { name: 'PostgresError' } })` on the mock error, accurately reflecting what the postgres-js driver produces
  - Asserts `errorClass: 'PostgresError'`, `errorCode: '23502'`, and `errorMessage: 'null value in column violates not-null constraint'` are persisted — confirming the implementation captures real PostgreSQL errors rather than "Failed query: update..."
- All 8 T115 tests pass.
- The production-run report was updated with a section documenting this unit-level proof.

**Correction 2 — Production catalog run (remains blocked):**

`flyctl` is installed but unauthenticated (`flyctl auth login` required). Production DNS is not resolvable from this environment. This is a human operator action: once `flyctl auth login` is done, the playbook at `runs/T115/production-run-playbook.md` provides the exact curl commands to capture before/after stats and the real failure list for the ~60k movie catalog.

**Files modified:**
- `apps/api/src/services/__tests__/t115-enrichment.test.ts` — constructor mock + `errorClass`/`errorMessage` assertions
- `runs/T115/production-run-20260819.md` — added `db_update` PostgresError capture section

---

## Review

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

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T15:04:41Z

---

I have all the information needed. Here is my review.

---

# PR Review — T115 Complete catalog enrichment and refresh failure observability

## Résumé

L'implémentation livre l'ensemble des mécanismes demandés (passe `enrich-missing` resumable, persistance des échecs, stats catalog, politique d'éligibilité embedding, normalisation TMDB). La qualité du code est solide. Cependant, le critère de complétion explicite du ticket — exécuter la passe contre le catalogue de production (~60 k films / ~5 k séries) et publier les compteurs avant/après avec les vraies causes d'échec — n'est pas satisfait. La validation locale porte sur 5 films de dev. C'est un bloquant selon le ticket lui-même.

Plusieurs points mineurs sont aussi identifiés.

---

## Vérifications effectuées

- Lecture complète de `catalog-enrich-missing-service.ts`, `metadata-enrichment-service.ts`, `catalog-stats.ts`, `embedding-eligibility.ts`, `enrichment-failures.ts` (schema), `catalog-refresh-runs.ts` (schema), `tmdb/client.ts`, migrations `0046` et `0047`.
- Lecture des artefacts de run : `local-validation-run-20260819.md`, `implementation-output.md`.
- Vérification des tests de normalisation (`t115-normalization.test.ts`).
- Vérification du `workflow-status.md`.

---

## Points validés

**Architecture et design**
- Passe `enrich-missing` cursor-based (`gt(table.id, lastId)` + `orderBy(asc(table.id))`), idempotente, avec checkpoint JSONB persisté en DB après chaque batch. Correct.
- `retryWithTransient` : 3 tentatives avec délais bornés, retryable vs terminal distingués. Correct.
- Concurrence contrôlée via `runWithConcurrency()`, aucune goroutine incontrôlée.
- `enrichmentFailures` : tous les champs requis par le ticket présents (`mediaType`, `mediaId`, `tmdbId`, `title`, `stage`, `errorClass`, `errorCode`, `errorMessage`, `retryCount`, `occurredAt`, `retryable`). L'upsert par `(mediaType, mediaId)` est cohérent.
- `classifyError()` distingue réseau/rate-limit (retryable) vs erreurs DB/mapping (terminal). Correct.
- `persistFailure()` capture l'erreur DB réelle (et non plus "Failed query: ...") avec le stage `db_update`. Répond au root-cause de la production failure mentionné dans le ticket.
- `clearFailure()` appelée après succès dans `enrichMovie`/`enrichSeries` — le record d'échec est supprimé quand l'item est enrichi avec succès.
- `catalog-stats` expose : total, enriched, partial, fully, never, stale, failedLastEnrichment, embeddingEligible, embeddingBlocked, embeddingPending.
- `embeddingPending` calculé par lookup dans `media_embeddings` — ne retourne plus 0 quand le corpus n'existe pas.
- Normalisation TMDB : `runtime: 0 → null`, `imdb_id: '' → null`, `overview: '   ' → null` — testée explicitement et comportement intentionnel documenté.
- Routes admin : POST start, GET status, GET failures (filtres page/mediaType/retryable), POST retry-failures. API complète.
- Migrations numérotées correctement (`0046`, `0047`), journal mis à jour.

---

## Problèmes détectés

### 🔴 BLOQUANT — Production run non exécutée

Le ticket est explicite :

> **Completion rule**: Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

La validation locale (`local-validation-run-20260819.md`) porte sur **5 films de dev** dont 2 sans `tmdbId`. Elle ne constitue pas une production run, ni un snapshot restauré. L'artefact `production-run-YYYYMMDD.md` n'existe pas.

Les acceptance criteria suivants ne sont pas démontrés :
- *"Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."*
- *"Terminal failures are persisted/listable and individually retryable"* — non démontré sur des vrais échecs de production.
- *"Production refresh failure root causes are observable with the real DB error"* — non démontré sur les 126 vrais échecs.

**Action requise** : Exécuter `POST /admin/catalog-enrich-missing` contre production (ou snapshot restauré), publier le `GET /admin/catalog-stats` avant/après, et `GET /admin/catalog-enrich-missing/failures` avec les causes réelles.

---

### 🟠 MAJEUR — `retryFailures` inclut les échecs terminaux (non-retryable)

`apps/api/src/services/catalog-enrich-missing-service.ts` lignes 343–347 :

```typescript
const conditions = []
if (mediaType) conditions.push(eq(enrichmentFailures.mediaType, mediaType))
if (ids && ids.length > 0) conditions.push(inArray(enrichmentFailures.mediaId, ids))
const where = conditions.length > 0 ? and(...conditions) : undefined
const failures = await this.db.select().from(enrichmentFailures).where(where)
```

Sans filtre sur `retryable`, `retryFailures()` va tenter de ré-enrichir **tous** les échecs, y compris les terminaux (par exemple les 404 TMDB, qui ne passeront jamais). Ce comportement peut être intentionnel ("force retry"), mais il n'est pas documenté et peut entraîner une boucle inutile sur des échecs permanents.

**Action requise** : Soit filtrer par défaut sur `retryable = true` et ajouter un flag `force` explicite pour forcer le retry des terminaux, soit documenter clairement le comportement actuel dans le commentaire ou la réponse API.

---

### 🟠 MAJEUR — Échecs de saisonnement non persistés dans `enrichment_failures`

`apps/api/src/services/metadata-enrichment-service.ts` lignes 438–440 :

```typescript
} catch (err) {
  console.warn(`[enrichment] enrichSeriesSeasons(${seriesId}) failed:`, err)
}
```

Les échecs d'enrichissement des saisons/épisodes sont seulement loggés en console. Ils n'apparaissent pas dans `GET /admin/catalog-enrich-missing/failures`. Pour les séries, le metadata principal peut être enrichi (`metadataEnrichedAt` mis à jour) mais les saisons/épisodes peuvent être incomplètes sans aucune trace visible dans l'API admin.

**Action requise** : Appeler `persistFailure` avec `stage: 'db_update'` (ou un nouveau stage dédié `seasons`) lorsque `enrichSeriesSeasons` échoue, avec le résultat approprié (`terminal-failed` si non-retryable).

---

### 🟡 MINEUR — Définition "fullyEnriched" trop étroite dans catalog-stats

`apps/api/src/routes/catalog-stats.ts` lignes 48–50 :

```sql
where metadata_enriched_at is not null and synopsis is not null and keywords is not null
```

"Fully enriched" ne vérifie que `synopsis` et `keywords`. Un film sans `posterPath`, `voteAverage`, `originalLanguage`, ou `genres` serait compté comme "fully enriched". Cela peut conduire à des stats trompeuses.

**Action requise** (mineur, ne bloque pas si accepté) : Documenter explicitement la définition dans un commentaire de code, ou élargir le critère aux champs considérés obligatoires par la politique d'embedding.

---

### 🟡 MINEUR — `persistFrenchLocalization` et collection upsert échouent silencieusement

`metadata-enrichment-service.ts` lignes 228–230 et 755–756 :

```typescript
} catch {
  // collection upsert failure is non-fatal
}
// ...
} catch {
  return  // persistFrenchLocalization — no log
}
```

La French localization n'émet aucun log sur échec. Un item peut sembler enrichi depuis l'API admin sans avoir de titre/synopsis français, sans trace pour diagnostiquer.

**Action requise** (mineur) : Ajouter au minimum un `console.warn` dans les deux blocs catch, avec le mediaId concerné.

---

### 🟡 MINEUR — Race condition TOCTOU dans `checkNoRunningConflict`

`catalog-enrich-missing-service.ts` lignes 78–89 et 124–128 :

```typescript
await this.checkNoRunningConflict()
// gap
const [run] = await this.db.insert(...).values({ status: 'RUNNING' })
```

La vérification et l'insertion ne sont pas atomiques. Si deux requêtes arrivent simultanément, les deux peuvent passer le check et insérer deux runs RUNNING. Le `unique index on status = 'RUNNING'` dans `catalog-refresh-runs` peut atténuer ce risque si l'index existe, mais sa présence n'est pas vérifiable dans la migration fournie.

**Action requise** (mineur, acceptable en l'état) : Documenter la limitation ou utiliser un lock optimiste (upsert avec contrainte unique + ON CONFLICT).

---

## Risques éventuels

- **Embedding eligibility très permissive** : `metadataEnrichedAt IS NOT NULL` suffit pour être eligible à l'embedding, même si `synopsis` et `genres` sont null. Le ticket précise que c'est un choix explicite ("incomplete titles are embedded with reduced documents"), et c'est documenté dans `embedding-eligibility.ts`. Acceptable, mais à surveiller lors de la génération du corpus.
- **Trois représentations de `isEmbeddingEligible`** (TS function, raw SQL string, Drizzle condition) : risque de divergence à terme. Pas de test d'équivalence entre les trois.
- **`totalEligible` calculé au démarrage, pas à la reprise** : en cas de crash et de reprise, les stats de progression peuvent être légèrement imprécises (totalEligible périmé). Non bloquant car purement cosmétique.

---

## Décision

L'implémentation est fonctionnellement correcte et bien conçue. Le bloquant est de nature opérationnelle, pas structurelle : le ticket impose une démonstration sur production et celle-ci n'a pas été réalisée. Le fix sur `retryFailures` (majeur) et la persistance des échecs de saisons (majeur) doivent aussi être adressés.

## Actions demandées

1. **(Bloquant)** Exécuter `POST /admin/catalog-enrich-missing` contre la production ou un snapshot restauré. Publier `catalog-stats` avant/après et la liste des failures avec les vraies causes dans `runs/T115/production-run-YYYYMMDD.md`.
2. **(Majeur)** Filtrer `retryFailures` sur `retryable = true` par défaut, ou ajouter un flag `force` explicite avec documentation.
3. **(Majeur)** Appeler `persistFailure` sur échec de `enrichSeriesSeasons` pour rendre ces échecs visibles dans l'API admin.
4. **(Mineur)** Ajouter des logs dans `persistFrenchLocalization` et le catch de collection upsert.
5. **(Mineur)** Documenter la définition de `fullyEnriched` (synopsis + keywords seulement) dans un commentaire.

IMPLEMENTATION_FIX_REQUIRED