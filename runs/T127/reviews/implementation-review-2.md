# PR Review — T127: Build a true must-watch Hero ranker for Home (attempt 2)

## Contexte

La review précédente (attempt 1) avait rejeté l'implémentation pour "violation de scope massive" sur 6 fichiers. Le coder a contesté ce diagnostic en montrant que ces fichiers étaient des changements T126 déjà commités — la review avait utilisé `git diff main --stat` qui inclut T125+T126+T127, pas seulement T127.

Cette review repart de la base correcte : `git diff 9e42ae01..HEAD` (T126 endpoint → T127 HEAD).

---

## Vérifications effectuées

- `git diff 9e42ae01..HEAD --stat` — inventaire exact des 6 fichiers code modifiés par T127
- Lecture complète de chaque diff T127
- Lecture du fichier `hero-selector.ts` complet (141 lignes)
- `pnpm vitest run src/services/__tests__/hero-selector.test.ts src/services/__tests__/home-snapshot.test.ts` — 34 tests, tous verts
- `pnpm tsc --noEmit` — analyse des erreurs et isolation des nouvelles vs pre-existing

---

## Périmètre réel T127

Les 6 fichiers code modifiés par T127 uniquement (base `9e42ae01`) :

| Fichier | ∆ lignes | Scope plan |
|---|---|---|
| `apps/api/src/services/hero-selector.ts` | +77 | Dans scope ✓ |
| `apps/api/src/services/__tests__/hero-selector.test.ts` | +236 | Dans scope ✓ |
| `apps/api/src/services/__tests__/home-snapshot.test.ts` | +78 | Dans scope ✓ (req #7) |
| `apps/api/src/config/env.ts` | +8 | Dans scope ✓ |
| `apps/api/src/client/recommendation-engine-client.ts` | +4 | Dans scope ✓ |
| `apps/api/src/services/home-pool-service.ts` | +2 | Dans scope ✓ |

Aucun fichier hors scope modifié par T127. Le diagnostic de la review 1 était erroné.

---

## Points validés

**`hero-selector.ts`**
- Pool cap `candidates.slice(0, HERO_POOL_SIZE)` : correct
- Gate d'éligibilité `available && finalScore >= HERO_MIN_SCORE` : préservée
- Filtre dislike via DB `explicitFeedback` : correct
- Enrichissement DB batch `Promise.all([movies, series, movieTrailers, seriesTrailers])` : correct
- `computeHeroScore()` : fonction pure exportée, formule pondérée 4 composantes, conforme au plan
- Sélection par `ranked.sort((a, b) => b.heroScore - a.heroScore)[0]` : élimine le comportement "premier éligible"
- Log `[HERO_RANKING]` avec pool/eligible/winner/heroScore/weights : conforme
- `return null` si pool vide après enrichissement : correct

**`env.ts`**
- `HERO_POOL_SIZE` (env, défaut 15) : conforme
- `HERO_SCORE_WEIGHTS` objet versionné `v1`, 4 poids, `as const` : conforme

**`recommendation-engine-client.ts`**
- `qualityPrior: number` et `languageAffinity: number` ajoutés à `ShelfCandidateItem` : conforme
- Mapping depuis `r.scoreBreakdown?.qualityPrior ?? 0` : correct
- Aucun autre champ ajouté (pas de `freshnessBoostDays` ni `mediaTypeFilter`) : clean

**`home-pool-service.ts`**
- +2 lignes : `qualityPrior: 0, languageAffinity: 0` dans le mapper fallback catalog : conforme au plan

**Tests fonctionnels — 34/34 verts**
- Test 1 : candidat #3 avec `profileScore=0.9` bat les candidats #1 et #2 ✓
- Test 2 : candidat à l'index 7/10 avec `profileScore=0.95` gagne ✓
- Test 3 : `qualityPrior=0.95` compense une légère faiblesse de `profileScore` ✓
- Test 4 : disliked ne peut pas gagner ✓
- Test 5 : `available=false` exclu avant ranking ✓
- Test 6 : pas de backdrop → exclu ✓
- Test 7 : contenu étranger (Parasite) gagne sans hard-filter langue ✓
- Test 8 : `null` retourné si tous sans backdrop ✓
- Test 9 : `computeHeroScore` vérifié avec inputs connus (résultat 0.705) ✓
- Test bonus : `profileScore` élevé → heroScore plus élevé ✓
- Stabilité snapshot (req #7 ticket) : 2 tests — hero stocké en snapshot retourné sur HIT sans re-sélection ✓ — hero identique sur 2 refreshes consécutifs ✓

---

## Problèmes détectés

### [BLOQUANT] TS errors nouvelles dans `hero-selector.test.ts` (lignes 450, 464, 465)

`computeHeroScore` est typée avec `typeof HERO_SCORE_WEIGHTS`. Grâce à `as const`, ce type a des valeurs littérales : `profileRelevance: 0.45`, `semanticConfidence: 0.25`, etc. Les tests de `computeHeroScore` construisent des objets `weights` custom sans `as const`, ce qui produit le type `{ profileRelevance: number; ... }` — incompatible avec les types littéraux.

```
src/services/__tests__/hero-selector.test.ts(450,47): error TS2345:
  Argument of type '{ version: "v1"; profileRelevance: number; ... }'
  is not assignable to parameter of type
  '{ readonly version: "v1"; readonly profileRelevance: 0.45; ... }'.
  Types of property 'profileRelevance' are incompatible.
    Type 'number' is not assignable to type '0.45'.
```

**Correction requise (deux options) :**
- Option A (préférable) : élargir le type du paramètre `weights` dans `computeHeroScore` :
  ```typescript
  type HeroScoreWeights = {
    readonly version: string
    readonly profileRelevance: number
    readonly semanticConfidence: number
    readonly qualityPrior: number
    readonly languageAffinity: number
  }
  export function computeHeroScore(
    candidate: ShelfCandidateItem,
    weights: HeroScoreWeights,
  ): number
  ```
  Le type exporté `HERO_SCORE_WEIGHTS` (`as const`) reste satisfait par ce type élargi.

- Option B : ajouter `as const` aux objets `weights` dans les tests.

### [BLOQUANT] TS errors nouvelles dans `home-pool-service.test.ts`

T127 a ajouté `qualityPrior: number` et `languageAffinity: number` comme champs requis de `ShelfCandidateItem`. Les fixtures de `home-pool-service.test.ts` (écrites en T126) construisent des `ShelfCandidateItem` sans ces champs. Résultat : ~15 erreurs TS dans ce fichier T126 non mis à jour.

```
src/services/__tests__/home-pool-service.test.ts(204,45): error TS2345:
  Type '{ mediaId: string; ... available: boolean; }[]' is not assignable to type 'ShelfCandidateItem[]'.
  Type '...' is missing the following properties from type 'ShelfCandidateItem': qualityPrior, languageAffinity
```

**Correction requise :** mettre à jour les fixtures dans `home-pool-service.test.ts` pour ajouter `qualityPrior: 0, languageAffinity: 0` sur tous les objets candidate construits directement (même pattern que `makeCandidate()` dans `hero-selector.test.ts`).

---

## Risques éventuels

- **console.info + objet** : le log `[HERO_RANKING]` utilise `console.info(string, { candidates: [...] })` — le second argument s'affichera comme `[Object]` dans les loggers non-structurés (PM2, stdout brut). Pas bloquant, mais observable en production. Acceptable en l'état pour un log de debug.

---

## Erreurs TS pré-existantes (hors scope T127)

Les erreurs `commands.test.ts` / `pairing.test.ts` sur `accountId` manquant dans les fixtures auth existent depuis avant T125 — hors scope, non imputables à T127.

---

## Critères d'acceptation — statut

| Critère | Statut |
|---|---|
| Hero non sélectionné par ordre d'entrée | ✓ |
| Politique de ranking dédiée et versionnée | ✓ |
| Plusieurs candidats évalués avant sélection | ✓ |
| profileRelevance primaire, quality/confidence/lang en safeguard | ✓ |
| Hero peut choisir le candidat #5, #10 | ✓ |
| Bruit catalog moins probable en hero | ✓ |
| Aucun candidat → no hero | ✓ |
| Comportement snapshot T126 préservé | ✓ |
| Debug/observabilité expliquant le choix | ✓ |
| Pas de hardcoding titre/pays | ✓ |
| `pnpm tsc --noEmit` sans nouvelles erreurs | ✗ — 3 erreurs `hero-selector.test.ts` + ~15 erreurs `home-pool-service.test.ts` |

---

## Décision

L'implémentation core (hero-selector.ts, env.ts, recommendation-engine-client.ts, home-pool-service.ts) est correcte et conforme au plan. Les tests fonctionnels passent tous (34/34). Deux corrections TS ciblées sont requises pour respecter le critère d'acceptance #9.

**Actions demandées :**

1. **`apps/api/src/services/hero-selector.ts`** : élargir le paramètre `weights` de `computeHeroScore` de `typeof HERO_SCORE_WEIGHTS` à un type structurel explicite `HeroScoreWeights` (voir correction Option A ci-dessus). La constante `HERO_SCORE_WEIGHTS` reste telle quelle.

2. **`apps/api/src/services/__tests__/home-pool-service.test.ts`** : ajouter `qualityPrior: 0, languageAffinity: 0` à tous les objets candidate construits inline dans les fixtures de ce fichier pour aligner sur la nouvelle interface `ShelfCandidateItem`.

3. Vérifier que `pnpm tsc --noEmit` ne produit aucune erreur nouvelle après ces corrections.

IMPLEMENTATION_FIX_REQUIRED
