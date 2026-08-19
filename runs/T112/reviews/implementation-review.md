Now I have everything needed for a complete review. Let me write it.

---

## PR Review — T112: Activate production pgvector database and backfill embeddings

## Résumé

L'implémentation est solide sur la partie scripting/outillage (diagnostic, migration, topologie, rollback), et le périmètre est respecté. Deux problèmes bloquent l'approbation : (1) l'endpoint de coverage code est incomplet par rapport aux champs exigés par le ticket, et (2) les artefacts opérationnels obligatoires (`diagnostics.md` rempli, `coverage.json`, `semantic-validation.md`) sont absents ou vides de données réelles.

## Vérifications effectuées

- Lecture du ticket T112, du plan validé et de `implementation-output.md`
- Diff complet des fichiers modifiés sur la branche : `apps/api/scripts/diagnose-db.mjs`, `scripts/migrate-pgvector-db.sh`, `apps/api/package.json`
- Lecture du code existant invoqué : `ensure-pgvector.ts`, `embedding-backfill-service.ts`, `embedding-service.ts`, `embedding-backfill.ts` (routes)
- Vérification des artefacts `topology.md`, `rollback.md`, `diagnostics.md`, et absence de `coverage.json` / `semantic-validation.md`

## Points validés

- **Sécurité credentials** : `diagnose-db.mjs` masque correctement l'URL en `host:port/dbname`; aucun secret hardcodé; `rollback.md` renvoie explicitement vers le coffre-fort sécurisé pour l'ancienne URL de prod.
- **Migration script** : pré-checks corrects (URLs distinctes, source non-vide, destination non-vide avec confirmation interactive), `pg_dump` + `pg_restore --list` pour vérification d'intégrité, validation row-count table par table. `--clean --if-exists` avec `--exit-on-error` est le bon défaut (fail loud plutôt que restore partiel).
- **Topologie** : `topology.md` est bien étayé par des preuves de code (single `DATABASE_URL`, pas d'abstraction multi-DB). Décision correcte et documentée.
- **Rollback** : `rollback.md` est complet — conditions de rollback, étapes Railway précises, tableau root-cause, politique de rétention de l'ancienne DB.
- **Scope** : aucun changement au ranking, au modèle d'embedding, ou à du code non-lié à T112.
- **Idempotence backfill** (code existant #205) : la logique `docHash` dans `embedding-service.ts:53-68` est correcte — skip si hash + provider + model identiques. Cursor-pagination dans `embedding-backfill-service.ts:119-158` gère correctement les égalités `createdAt` via `or(gt, and(eq, gt(id)))`.

## Problèmes détectés

### BLOQUANT 1 — Coverage endpoint incomplet

**Fichier** : `apps/api/src/routes/embedding-backfill.ts:25-72`

Le ticket §7 exige (et le plan Step 9 répète) que la réponse de `GET /admin/embedding-backfill/coverage` contienne :

| Champ requis | Présent ? |
|---|---|
| Total eligible Movies (séparé) | Non — seul `total` combiné est retourné |
| Total eligible Series (séparé) | Non |
| Embedded count | Oui |
| Missing count | Non (inferable via `total - embedded` mais non retourné) |
| Failed count | Non (aucun tracking historique) |
| `coverageByField.overview` | Oui |
| `coverageByField.keywords` | Oui |
| Vector index mode (`pgvector` vs `float8`) | Non |
| Embedding model name | Non |
| Embedding dimension | Non |

Le `coverage.json` qui doit être sauvegardé comme artefact de preuve sera incomplet si ces champs manquent. Sans `vectorIndexMode` dans la réponse, il est impossible de prouver par cet artefact que les requêtes utilisent le chemin pgvector.

**Correction requise** :

```typescript
// Dans embedding-backfill.ts, enrichir la réponse de /coverage :
import { getEmbeddingIndexMode } from '../db/embedding-index-mode.js'
import { createDefaultProvider } from '../services/embedding-provider.js'

// Dans le handler :
const provider = OPENAI_API_KEY ? createDefaultProvider(OPENAI_API_KEY) : null
const missing = total - embedded

return reply.send({
  totalMovies: movieTotal,
  totalSeries: seriesTotal,
  total,
  embedded,
  missing,
  coverageByField: { overview: ..., keywords: ..., language: ... },
  vectorIndexMode: getEmbeddingIndexMode(),
  embeddingModel: provider?.modelName ?? null,
  embeddingDimension: provider?.dimension ?? null,
})
```

### BLOQUANT 2 — Artefacts opérationnels absents

Les critères d'acceptation du plan sont :

| Artefact | État |
|---|---|
| `runs/T112/diagnostics.md` avec row counts réels des deux DBs | Template vide (placeholders "FILL IN") |
| `runs/T112/coverage.json` | Absent |
| `runs/T112/semantic-validation.md` | Absent |

L'`implementation-output.md` reconnaît explicitement que "Production credentials are required for all operational steps." C'est une limite légitime du coder. Mais le ticket T112 traite ces étapes comme des critères de complétion non-négociables :

> "Do not close because `CREATE EXTENSION vector` succeeds. Completion requires a migrated real production dataset, a successful embedding backfill, proof that real semantic queries use pgvector, and a production smoke check."

Ces étapes doivent être exécutées par l'opérateur avec les credentials Railway avant que le ticket puisse être fermé.

### Observation mineure — Backup dans `/tmp/`

`scripts/migrate-pgvector-db.sh:29` : le dump est écrit dans `/tmp/iptvflix-backup-<timestamp>.dump`. Le plan mentionnait "Railway volume or S3". Dans un environnement conteneurisé, `/tmp/` est éphémère. Pour un run depuis un laptop de développeur, c'est acceptable. Le script devrait au minimum afficher un avertissement rappelant que le fichier doit être copié vers un stockage durable avant de redémarrer la session.

## Risques éventuels

- **`pg_restore --clean`** sur une DB non-vide (si l'opérateur bypass la confirmation) : acceptable car `--if-exists` est présent et `--exit-on-error` coupe si un DROP essentiel échoue.
- **`coverage.json` sans `vectorIndexMode`** : si sauvegardé dans l'état actuel, il ne prouvera pas l'utilisation du chemin pgvector — ce qui est précisément la preuve principale requise par le ticket.

## Décision

IMPLEMENTATION_FIX_REQUIRED

## Actions demandées

1. **Coder** — Enrichir `GET /admin/embedding-backfill/coverage` pour retourner : `totalMovies`, `totalSeries`, `missing`, `vectorIndexMode`, `embeddingModel`, `embeddingDimension`. Voir correction proposée ci-dessus.

2. **Opérateur** — Une fois le fix mergé, exécuter dans l'ordre :
   - `db:diagnose` contre les deux DBs Railway et remplir `runs/T112/diagnostics.md`
   - `scripts/migrate-pgvector-db.sh` avec `CURRENT_DB_URL` + `NEW_DB_URL`
   - Déployer sur Railway avec le nouveau `DATABASE_URL`
   - `POST /admin/embedding-backfill` → logger la réponse
   - `GET /admin/embedding-backfill/coverage` → sauvegarder en `runs/T112/coverage.json`
   - Requêtes Recommendation Lab × 3 → sauvegarder en `runs/T112/semantic-validation.md`

3. **Optionnel / mineur** — Ajouter dans le script migration un `echo "[migrate] WARNING: dump at ${DUMP_FILE} is ephemeral — copy to durable storage before ending this session."` après la ligne 84.

IMPLEMENTATION_FIX_REQUIRED
