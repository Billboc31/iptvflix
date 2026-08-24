# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T127/reviews/implementation-review.md
- generated at: 2026-08-24T09:45:50Z

---

---

## PR Review — T127: Build a true must-watch Hero ranker for Home (attempt 2)

### Correction du diagnostic de la review 1

La review précédente avait rejeté l'implémentation pour "violation de scope massive". C'était une erreur de diagnostic : la base de comparaison `git diff main --stat` incluait les changements T125+T126+T127 combinés. Le diff réel T127 (`9e42ae01..HEAD`) ne touche que **6 fichiers dans le scope**.

---

### Ce qui est correct

**Périmètre T127 exact :**

| Fichier | ∆ | Statut |
|---|---|---|
| `hero-selector.ts` | +77 lignes | ✓ dans scope |
| `hero-selector.test.ts` | +236 lignes | ✓ dans scope |
| `home-snapshot.test.ts` | +78 lignes | ✓ dans scope (req #7) |
| `env.ts` | +8 lignes | ✓ dans scope |
| `recommendation-engine-client.ts` | +4 lignes | ✓ dans scope |
| `home-pool-service.ts` | +2 lignes | ✓ dans scope |

**Tests fonctionnels : 34/34 verts.** Toutes les 9 exigences de test du ticket + 2 tests de stabilité snapshot (req #7) passent.

La logique core (`computeHeroScore`, pool cap, tri, log observabilité, `return null`) est correcte et conforme au plan.

---

### Problèmes bloquants détectés

#### [BLOQUANT 1] TS errors dans `hero-selector.test.ts` lignes 450, 464, 465

`computeHeroScore` est typée `weights: typeof HERO_SCORE_WEIGHTS`. Comme `HERO_SCORE_WEIGHTS` est `as const`, ses champs numériques ont des types littéraux (`profileRelevance: 0.45`, etc.). Les tests qui construisent des objets `weights` custom sans `as const` passent `number` au lieu de `0.45` — incompatible TS.

**Correction :** élargir le paramètre `weights` de `computeHeroScore` à un type structurel `{ version: string; profileRelevance: number; ... }` plutôt que `typeof HERO_SCORE_WEIGHTS`.

#### [BLOQUANT 2] TS errors dans `home-pool-service.test.ts` (~15 erreurs)

T127 a ajouté `qualityPrior: number` et `languageAffinity: number` comme champs requis sur `ShelfCandidateItem`, mais n'a pas mis à jour les fixtures du fichier de test T126 `home-pool-service.test.ts` qui construit ces objets directement.

**Correction :** ajouter `qualityPrior: 0, languageAffinity: 0` à tous les objets candidate inline dans `home-pool-service.test.ts`.

---

### Critère d'acceptance #9 non satisfait

Le plan exige explicitement : *"TypeScript compilation (`pnpm tsc --noEmit`) passes with no new errors."* Ces deux catégories d'erreurs sont nouvelles et introduites par T127.

*(Note : les erreurs `accountId` dans `commands.test.ts`/`pairing.test.ts` sont pré-existantes avant T125, non imputables à T127.)*

---

### Actions demandées

1. **`hero-selector.ts`** — élargir le type du paramètre `weights` dans `computeHeroScore` (type structurel `number` plutôt que types littéraux `as const`)
2. **`home-pool-service.test.ts`** — ajouter `qualityPrior: 0, languageAffinity: 0` aux fixtures candidate inline
3. Vérifier que `pnpm tsc --noEmit` ne produit aucune erreur nouvelle

IMPLEMENTATION_FIX_REQUIRED
