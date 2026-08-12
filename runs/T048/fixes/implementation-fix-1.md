# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T048/reviews/implementation-review.md
- generated at: 2026-08-12T23:45:30Z

---

Now I have the full picture. Let me write the structured review.

---

## PR Review — T048 — Restore full green validation

### Résumé

L'implémentation livre les 6 correctifs fonctionnels attendus (scripts `validate`, CI, doc, 3 fix TypeScript dans les tests API), mais le commit inclut accidentellement **306 fichiers compilés** du frontend web (`apps/web/src/**/*.js`, `*.d.ts`, `*.js.map`, `*.d.ts.map`) qui n'ont rien à faire dans le dépôt.

---

### Vérifications effectuées

- Diff complet du commit `3b04eca` vs `main`
- Vérification de l'existence des artefacts dans `main` (absents → introduits par T048)
- Vérification du `.gitignore` (ne couvre pas les `.js`/`.d.ts` dans `src/`)
- Vérification de `apps/api/tsconfig.build.json` (exclu les tests ✅, pré-existant)
- Vérification de `packages/api-contracts/src/sources.ts` (`SourceType = 'XTREAM' | 'M3U' | 'PLEX'`)
- Vérification du `MockSource` local dans `sources.test.ts`

---

### Points validés

| Livrable | Statut |
|---|---|
| `package.json` → script `"validate"` | ✅ |
| `docs/validation.md` | ✅ Conforme au plan |
| `.github/workflows/ci.yml` → étape `pnpm build` | ✅ |
| `catalog-sync-service.test.ts` → suppression doublons TS2783 | ✅ |
| `feedback.test.ts` → élargissement type `setupUpsert` TS2322 | ✅ |
| `vertical-slice.test.ts` → import `FastifyInstance` TS2347 | ✅ |
| `apps/api/tsconfig.build.json` exclut bien `*.test.ts` | ✅ (pré-existant, non cassé) |

---

### Problèmes détectés

#### 🔴 BLOQUANT — 306 artefacts de build web commités

Le commit `3b04eca` introduit 306 fichiers générés par `tsc --declaration` dans `apps/web/src/` :

```
apps/web/src/App.js
apps/web/src/App.d.ts
apps/web/src/App.js.map
apps/web/src/App.d.ts.map
apps/web/src/components/content/ContinueWatchingRow.js
apps/web/vite.config.js
… (302 autres)
```

Ces fichiers **n'existent pas dans `main`**. Ils ont été générés comme effet de bord de `pnpm build` et commités par accident (le `.gitignore` racine ne couvre que `dist/`, `build/`, `out/` — pas les `.js`/`.d.ts` produits en place dans `src/`).

Conséquences :
- Pollution de l'historique git avec des fichiers binaires/générés
- Sur un `git clone` suivi de `pnpm build`, conflit entre les fichiers déjà présents (committés) et la sortie freshement générée
- Les 306 fichiers masquent les vrais changements dans toute future diff

**Correction requise :** Retirer ces fichiers du commit et ajouter les règles `.gitignore` appropriées (`apps/web/src/**/*.js`, `apps/web/src/**/*.d.ts`, `apps/web/src/**/*.js.map`, `apps/web/src/**/*.d.ts.map`, `apps/web/vite.config.js`, etc.) — en préservant `apps/web/src/vite-env.d.ts` qui est un vrai fichier source Vite.

#### 🟡 MINEUR — `MockSource` dans `sources.test.ts` toujours hand-rolled

Le plan (Phase 2) demandait de remplacer le type local :
```ts
// apps/api/src/routes/sources.test.ts:38
type MockSource = Omit<typeof mockSource, 'type' | 'username'> & {
  type: 'XTREAM' | 'PLEX' | 'M3U'
```
par le `SourceType` partagé de `packages/api-contracts`. Ce fichier n'est pas dans le commit. Le type local est fonctionnellement identique à `SourceType` (`'XTREAM' | 'M3U' | 'PLEX'`) donc il n'y a pas d'erreur TypeScript, mais c'est un critère d'acceptance explicite du ticket. Non-bloquant car aucune régression produite.

#### 🟡 MINEUR — Absence de la triage table Phase 1

Le plan demandait une table de triage `fichier / erreur / verdict`. L'`implementation-output.md` ne la documente pas. L'inventaire des erreurs a été effectué mais non archivé.

---

### Risques éventuels

- Si les fichiers web générés ne sont pas retirés **avant** le merge, tout futur `pnpm build` dans un checkout propre générera des conflits de fichiers déjà trackés.
- Le `.gitignore` actuel est insuffisant pour une monorepo avec `"declaration": true` dans `tsconfig.base.json` — risque de récurrence sur d'autres tickets.

---

### Décision

- REQUEST_CHANGES

### Actions demandées

1. **[Bloquant]** Retirer du commit les 306 fichiers `apps/web/src/**/*.js`, `*.d.ts`, `*.js.map`, `*.d.ts.map` et les fichiers `apps/web/vite.config.{js,d.ts,js.map,d.ts.map}`. Ajouter des règles `.gitignore` pour les couvrir. Re-vérifier que `pnpm validate` passe toujours après nettoyage.

2. **[Mineur / optionnel]** Remplacer le `MockSource` hand-rolled dans `apps/api/src/routes/sources.test.ts` par `import type { SourceType } from '@iptvflix/api-contracts'` pour respecter l'acceptance criterion du ticket.

---

IMPLEMENTATION_FIX_REQUIRED
