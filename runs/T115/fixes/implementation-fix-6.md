# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T14:33:12Z

---

I have a complete picture of what coder-attempt-6 produced. Let me write the review.

---

# PR Review — T115: Complete catalog enrichment and make refresh failures resumable/observable

**Review attempt:** 6

## Résumé

Coder-attempt-6 apporte trois corrections de code (renommage migration `0047`, mise à jour du journal, fix `toISOString()` dans `catalog-stats.ts`) et produit un artefact de run local (`runs/T115/local-validation-run-20260819.md`). Ces corrections lèvent les risques techniques identifiés en review 5 (conflit de numérotation migration, erreur `TypeError` sur `Date`). Cependant, **le blocker de completion rule reste non satisfait** : un run local avec 5 films et 39 séries de dev n'est pas équivalent à un snapshot production, et les 126 failures de production ne sont pas diagnostiquées.

## Vérifications effectuées

- `apps/api/migrations/meta/_journal.json` — entrées idx 44–47 présentes ✓
- `apps/api/migrations/0047_t115_enrichment_failures.sql` — fichier renommé, plus de conflit avec `0045_t114` ✓
- `apps/api/src/routes/catalog-stats.ts:20` — `staleThreshold` utilise `.toISOString()` ✓
- `apps/api/src/services/catalog-enrich-missing-service.ts` — code inchangé depuis review 5, fixes `matchStatus = 'MATCHED'` inconditionnels confirmés ✓
- `apps/api/src/services/metadata-enrichment-service.ts` — `classifyError`, `persistFailure`, `clearFailure` confirmés ✓
- `runs/T115/local-validation-run-20260819.md` — artefact de run local présent

## Points validés (inchangés depuis review 5)

Tous les points techniques restent validés :
- TMDB normalization (`runtime=0` → `null`, empty `imdb_id` → `null`, blank `overview` → `null`) ✓
- `classifyError()` expose le vrai `error.constructor.name`, `.code`, `.message` ✓
- Upsert `enrichment_failures` avec `ON CONFLICT` incrémentant `retryCount` ✓
- `clearFailure()` sur succès ✓
- Keyset cursor `WHERE id > :lastId` sans drift ✓
- `matchStatus = 'MATCHED'` inconditionnellement dans `countEligible()` et `execute()` ✓
- 8 nouvelles métriques dans `/admin/catalog-stats` + `embeddingPending` non-hardcodé ✓
- Migrations `0046` et `0047` + journal complet ✓

## Corrections de coder-attempt-6 validées

**Migration renommée** (`0047_t115_enrichment_failures.sql`) : le conflit `0045` signalé comme risque en review 5 est éliminé ✓

**Journal complet** (idx 44–47) : les 4 migrations T107/T114/T115 sont enregistrées, `migrate-safe.mjs` ne les sautera plus silencieusement ✓

**`staleThreshold.toISOString()`** (`catalog-stats.ts:20`) : le `TypeError` postgres.js sur interpolation de `Date` brut est corrigé, l'endpoint retourne 200 ✓

## Problème bloquant — Completion rule non satisfaite

### Le run local ne constitue pas un "équivalent restored production snapshot"

Le ticket stipule :

> **Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes.**

Le run local produit dans `local-validation-run-20260819.md` utilise :
- **5 films** (dont 2 sans `tmdbId`, 3 avec IDs réels Inception/Dark Knight/Interstellar)
- **39 séries** (dont 37 sans `tmdbId`, 2 avec IDs réels Breaking Bad/GoT)
- **0 terminal failures**

Il s'agit d'un environnement de développement synthétique, pas d'un snapshot production. L'écart avec le contexte réel est fondamental :

| Dimension | Production | Run local |
|---|---|---|
| Films | ~60 000 | 5 |
| Séries | ~5 000 | 39 |
| Failures connues | 126 | 0 |
| Films français (ex. *Les Chevaliers du Fiel*) | Présents | Absent |
| Cas runtime=0 / imdb_id="" en prod | Non testés ici | Non exercés |

La completion rule exige spécifiquement :
- "show the remaining terminal failures with their real causes" — le run produit **0 terminal failures**, ce qui ne démontre pas la résolution des 126 failures connues
- "successful retry/fix of the previous failure population" — le film en exemple (`Les Chevaliers du Fiel : L'assassin est dans la salle`) n'est pas présent dans le dataset de test

Le local run démontre la **correctness fonctionnelle du chemin nominal**, mais pas la **résolution des failures de production** qui était l'objectif central du ticket.

### Escalade requise vers un opérateur humain

Cette condition ne peut pas être satisfaite par l'agent AI : l'accès à l'environnement de production est un prérequis humain. Les actions requises sont :

1. Déployer cette branche en production (ou monter un snapshot PostgreSQL de production)
2. Exécuter les migrations 0044–0047 via `migrate-safe.mjs`
3. `GET /admin/catalog-stats` → capturer l'état avant (notamment `neverEnriched`, `failedLastEnrichment`)
4. `POST /admin/catalog-enrich-missing` → démarrer le run
5. Attendre `status: "COMPLETED"` via `GET /admin/catalog-enrich-missing/status`
6. `GET /admin/catalog-stats` → capturer l'état après
7. `GET /admin/catalog-enrich-missing/failures` → capturer les failures terminales avec `errorClass`, `errorCode`, `errorMessage` réels
8. Déposer ces artefacts dans `runs/T115/production-run-YYYYMMDD.md`

## Observations mineures (inchangées)

**`retrying` stat absente** — structurellement non observable entre checkpoints synchrones. Acceptable, un commentaire dans le code suffirait.

**`embeddingBlocked` toujours 0** — attendu et documenté dans `catalog-stats.ts`. Pas de problème.

## Décision

Le code est techniquement complet et correct sur tous les points du plan et du ticket. Les trois corrections de coder-attempt-6 règlent les derniers risques opérationnels (conflit migration, journal incomplet, TypeError date). La seule condition non satisfaite est l'exécution contre un dataset production, qui constitue un critère d'acceptance explicite du ticket et requiert une intervention humaine.

IMPLEMENTATION_FIX_REQUIRED
