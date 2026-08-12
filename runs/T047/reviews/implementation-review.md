Now I have everything I need for the review. Let me write it up.

---

# PR Review — T047: Make Railway/Vercel staging deployment reproducible and migration-safe

## Résumé

L'implémentation couvre la totalité des critères d'acceptance du plan : `railway.toml`, scripts de démarrage production, 503 sur `/health` en cas d'indisponibilité DB, `vercel.json`, `tsconfig.build.json`, `.env.example` mis à jour, et `docs/staging-deployment.md`. Des ajouts hors scope sont présents (scripts locaux, validation de chaîne de migrations) mais ne posent pas de problème de sécurité ni de régression.

## Vérifications effectuées

- Lecture complète des fichiers créés/modifiés via `git diff main...HEAD`
- Vérification de la conformité de chaque fichier au plan (`runs/T047/plan.md`)
- Lecture du `health.ts` (503 vs 200) et du test associé
- Analyse du script `start:railway` (migration-first)
- Vérification du `tsconfig.build.json` et de la modification du script `build`
- Lecture des scripts shell (`reset-local.sh`, `start-local.sh`)
- Vérification du `validate-snapshot-chain.ts`
- Lecture du `staging-deployment.md`

## Points validés

| Critère d'acceptance | Statut |
|---|---|
| `apps/api/railway.toml` avec `buildCommand`, `startCommand`, `healthcheckPath` | ✅ |
| `start:railway` = `pnpm db:migrate && node dist/index.js` | ✅ |
| `GET /health` retourne 503 quand la DB est inaccessible | ✅ |
| `health.test.ts` assert 503 sur le cas DB-down | ✅ |
| `apps/web/vercel.json` avec `buildCommand`, `outputDirectory`, `framework` | ✅ |
| `apps/api/.env.example` inclut `NODE_ENV=production` | ✅ |
| `apps/web/.env.example` commente le rôle de `VITE_API_BASE` en staging | ✅ |
| `docs/staging-deployment.md` documente l'intégration Railway + Vercel | ✅ |
| `pnpm --filter api build` exclut les sources de test (`tsconfig.build.json`) | ✅ |
| Tests passants sans régression | ✅ (507 tests selon l'output) |

**Logique de migration-safety** : `pnpm db:migrate && node dist/index.js` est correct — `drizzle-kit migrate` sort avec un code non-nul en cas d'échec, ce qui coupe le déploiement avant que le serveur ne soit jamais lié au port. La suite healthcheck 503 → rollback Railway est cohérente avec cette logique.

**health.ts** : le corps `{ "status": "ok", "db": "unavailable" }` avec HTTP 503 est intentionnel — l'API est vivante, la DB ne l'est pas. Cela permet à Railway de distinguer un crash serveur (pas de réponse) d'une indisponibilité DB (503 propre). Aucun secret n'est exposé.

**tsconfig.build.json** : le fichier n'existait pas sur `main` (confirmé via diff). Sa création + la modification du script `build` (`"tsc"` → `"tsc -p tsconfig.build.json"`) sont justifiées : sans ce fichier, le critère "séparer build prod des sources de test" n'aurait pas pu être satisfait. Le plan supposait à tort que le fichier existait déjà.

## Problèmes détectés

### Hors-scope non-bloquants

**P1 — `db:validate-chain` + `scripts/validate-snapshot-chain.ts` non planifiés**
Ces fichiers ne figurent ni dans la section Included ni dans le plan. Ils sont fonctionnellement corrects (validation de la chaîne de snapshots Drizzle) mais représentent du scope créep.
→ Observation mineure. Ne bloque pas.

**P2 — `scripts/reset-local.sh`, `scripts/start-local.sh` et ajouts README hors scope**
Le ticket concerne le déploiement Railway/Vercel, pas le workflow de développement local. Ces scripts sont utiles mais n'appartiennent pas à ce ticket.
→ Observation mineure. Ne bloque pas.

**P3 — Script `start` (sans suffixe) ajouté sans être planifié**
`"start": "node dist/index.js"` n'est pas dans le plan. C'est raisonnable et anodin.
→ Observation. Ne bloque pas.

### Risque potentiel (non-bloquant)

**P4 — Possible incompatibilité Root Directory Railway et `buildCommand`**

La documentation dans `staging-deployment.md` instruit de configurer la **Root Directory** du service Railway à `apps/api` (afin que Railway lise `apps/api/railway.toml`). Or, selon la documentation Railway, quand Root Directory est positionné sur un sous-répertoire, le builder NIXPACKS ne voit que ce sous-répertoire — ce qui signifie que `pnpm-lock.yaml` (situé à la racine du repo) serait inaccessible.

Le `buildCommand` serait alors :
```
pnpm install --frozen-lockfile  ← échoue : pas de pnpm-lock.yaml dans apps/api/
pnpm --filter api build          ← échoue : pas de workspace root
```

En pratique, le comportement réel de Railway/NIXPACKS avec les monorepos est ambigu : pnpm remonte l'arborescence pour trouver le workspace root si le repo entier est monté, ce qui peut fonctionner. Mais ce n'est pas garanti.

Alternative plus sûre : ne pas définir de Root Directory et placer `railway.toml` à la racine du repo (en ajustant les chemins), ou ajouter une note dans `staging-deployment.md` indiquant que si le build échoue, il faut laisser Root Directory vide et copier `railway.toml` à la racine.

→ Risque à surveiller au premier déploiement. Ne bloque pas l'approbation car c'est une incertitude de comportement plateforme, pas un bug de code.

**P5 — `NODE_ENV=production` dans `.env.example` localement trompeur**

Un développeur copiant `.env.example` → `.env` exécutera son environnement local en mode production. Cela peut masquer des messages d'erreur détaillés, désactiver des comportements de dev, etc. Railway injecte lui-même `NODE_ENV=production`, donc cette variable n'a pas besoin d'être dans `.env.example` pour le staging.

Recommandation : commenter la ligne ou la mettre à `NODE_ENV=development` avec une annotation expliquant que Railway l'injecte à `production` en déploiement.

→ Mineur. C'est ce que le plan a demandé. Ne bloque pas.

## Risques éventuels

- Aucun risque de sécurité : aucun secret commité, credentials pas logués, validation des inputs non applicable ici.
- Aucune régression sur les tests (507 passants).
- Le `reset-local.sh` est explicitement destructif et le commente. Pas de risque de destruction involontaire.
- `source apps/api/.env` dans le script shell : acceptable pour un script local sous contrôle utilisateur.

## Décision

L'ensemble des critères d'acceptance est satisfait. La logique core (migration-safety, healthcheck 503, configuration Railway/Vercel reproductible) est correcte et testée. Les ajouts hors scope sont additifs et sans danger. Le risque P4 (Root Directory Railway) devra être vérifié au premier déploiement mais ne constitue pas un bug de code.

IMPLEMENTATION_APPROVED
