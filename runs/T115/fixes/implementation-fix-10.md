# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T15:13:52Z

---

I have a complete picture of the implementation. Here is my review:

---

# PR Review — T115 — Complete catalog enrichment and refresh failure observability

## Résumé

L'implémentation livre tous les mécanismes requis par le ticket. Les 4 problèmes identifiés lors des reviews précédentes ont bien été corrigés (vérifiés dans les fichiers source). La qualité du code est solide : pagination keyset correcte, classification d'erreurs transient/terminal, schema `enrichment_failures` conforme, routes admin complètes, eligibilité embedding avec source de vérité unique.

Il reste **un seul bloquant opérationnel** : le critère de complétion explicite du ticket n'est pas satisfait. La validation ne porte que sur 5 films de dev — la production run (~60k films / ~5k séries) exigée par la completion rule n'a pas été exécutée.

---

## Vérifications effectuées

- `catalog-enrich-missing-service.ts` : keyset pagination, `retryFailures` avec filtre `retryable` par défaut, `checkNoRunningConflict`, stats live, `saveCheckpoint`.
- `metadata-enrichment-service.ts` : `persistFailure`, `clearFailure`, `classifyError`, catch `enrichSeriesSeasons` + `persistFailure(stage: 'seasons')`, `console.warn` dans les catch blocks silencieux.
- `catalog-stats.ts` : tous les compteurs requis, `embeddingPending` via lookup réel dans `media_embeddings`, commentaires sur `fullyEnriched`.
- `embedding-eligibility.ts` : trois représentations synchronisées (TS function, raw SQL string, Drizzle condition), documentées.
- `tmdb/client.ts` : normalisation `runtime || null`, `imdb_id || null`, `overview?.trim() || null` — correcte et testée.
- Migrations `0046` et `0047` + `_journal.json` — cohérents et numérotés correctement.
- `local-validation-run-20260819.md` et `production-run-playbook.md`.
- Tests `t115-normalization.test.ts` et `t115-enrichment.test.ts`.

---

## Points validés

**Fix 1 (retryFailures filtre)** — Confirmé à la ligne 346 de `catalog-enrich-missing-service.ts` :
```typescript
if (!force) conditions.push(eq(enrichmentFailures.retryable, true))
```
Par défaut seules les failures retryable sont retraitées. Flag `force` disponible pour forcer les terminales.

**Fix 2 (échecs seasons persistés)** — Confirmé aux lignes 437–452 de `metadata-enrichment-service.ts` :
```typescript
let seasonsFailed = false
try {
  await this.enrichSeriesSeasons(seriesId)
} catch (err) {
  console.warn(`[enrichment] enrichSeriesSeasons(${seriesId}) failed:`, err)
  seasonsFailed = true
  await this.persistFailure({ ..., stage: 'seasons', err, ... })
}
if (!seasonsFailed) await this.clearFailure('SERIES', seriesId)
```
Les échecs de saisons apparaissent maintenant dans `GET /admin/catalog-enrich-missing/failures`. `clearFailure` est conditionnelle.

**Fix 3 (catch blocks silencieux)** — `console.warn` présent dans le catch du collection upsert (ligne ~229) et dans `enrichSeriesSeasons` (ligne 441).

**Fix 4 (fullyEnriched documenté)** — Commentaires inline présents dans `catalog-stats.ts` aux deux blocs movies et series :
```
// fullyEnriched: enriched with at least synopsis and keywords present (does not require all optional fields)
```

**Autres points solides :**
- Cursor keyset sur `id ASC` : `WHERE id > :lastId ORDER BY id LIMIT batchSize` — correct, sans offset drift.
- `persistFailure` via upsert sur `(mediaType, mediaId)` avec `retryCount + 1` — correct.
- `classifyError` distingue Network/RateLimit (retryable) vs PostgresError/mapping (terminal). Root cause réel capturé, non plus le SQL généré.
- `embeddingPending` calculé par `NOT EXISTS (SELECT 1 FROM media_embeddings WHERE media_id = ...)` — plus jamais hardcodé à 0.
- `EMBEDDING_ELIGIBLE_SQL_PREDICATE` utilisé à la fois dans `catalog-stats.ts` et dans `embedding-backfill-service.ts` — source de vérité unique confirmée.
- Migrations dans le journal (`idx 44–47`), toutes les quatre présentes.
- `local-validation-run-20260819.md` démontre le flux end-to-end sur un dev DB : 5 eligible → 5 enriched, 0 failures, `embeddingPending: 3` non-zéro.

---

## Problèmes détectés

### 🔴 BLOQUANT — Production run non exécutée

La completion rule du ticket est explicite et non-négociable :

> **Completion rule**: Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.

Les acceptance criteria non-démontrés :
- *"Run against the real production catalog and demonstrate meaningful reduction of incomplete titles and successful retry/fix of the previous failure population."*
- *"Production refresh failure root causes are observable with the real DB error, not only generated SQL/params."* — Les 126 vrais échecs de production n'ont pas été diagnostiqués.
- L'artefact `runs/T115/production-run-YYYYMMDD.md` n'existe pas.

La validation locale sur 5 films de dev (dont 2 sans `tmdbId`) ne constitue pas une production run ni un snapshot équivalent. Le `production-run-playbook.md` est présent et correct — il reste à l'exécuter.

**Action requise** : Connecter le branch au DB de production (ou snapshot restauré), appliquer les migrations `0044–0047`, exécuter les étapes du playbook, et publier l'artefact `production-run-YYYYMMDD.md` avec les compteurs avant/après et la liste des failures avec leurs causes réelles.

---

## Risques éventuels

- **Trois représentations de `isEmbeddingEligible`** (fonction TS, raw SQL string, Drizzle condition) : synchronisées aujourd'hui, mais aucun test d'équivalence automatique. Risque de divergence silencieuse à une future évolution. Acceptable en l'état.
- **`totalEligible` calculé au démarrage** : en cas de crash + reprise, le chiffre peut être périmé. Purement cosmétique, non bloquant.
- **Race condition TOCTOU dans `checkNoRunningConflict`** : check et insert non atomiques. Acceptable pour un endpoint admin à faible concurrence, mais à documenter si le service devient exposé.

---

## Décision

L'implémentation est fonctionnellement complète, correctement corrigée, et de bonne qualité. Le seul obstacle est opérationnel : la completion rule du ticket impose une démonstration sur production et celle-ci n'a pas été réalisée.

## Actions demandées

1. **(Bloquant)** Exécuter les étapes du `production-run-playbook.md` contre production ou snapshot restauré. Créer `runs/T115/production-run-YYYYMMDD.md` avec les `catalog-stats` avant/après, le statut du run, et `GET /admin/catalog-enrich-missing/failures` avec les causes réelles des failures (notamment pour `Les Chevaliers du Fiel : L'assassin est dans la salle`).

IMPLEMENTATION_FIX_REQUIRED
