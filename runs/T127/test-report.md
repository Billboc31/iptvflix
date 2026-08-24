# Test Report — T127: Build a true must-watch Hero ranker for Home

**Date**: 2026-08-24  
**Branch**: `ticket/T127-build-a-true-must-watch-hero-ranker-for-home`  
**State at test time**: `IMPLEMENTATION_APPROVED`

---

## Commands executed

```
npx vitest run --reporter=verbose \
  src/services/__tests__/hero-selector.test.ts \
  src/services/__tests__/home-snapshot.test.ts
```

**Result**: 34 passed / 34 (19 hero-selector + 15 home-snapshot)  
Duration: 347ms

---

## Acceptance criteria

### 1. Hero selection no longer returns the first eligible recommendation by input order
**PASS**

Tests #1 and #2 prove this explicitly.

- Test #1: pool of 3 candidates ordered [A, B, C]; C (3rd position, profileScore=0.9) wins with heroScore=0.755 over A (first, heroScore=0.62).
- Test #2: candidate at index 7 of 10 (profileScore=0.95, heroScore=0.777) wins over all 9 other candidates (profileScore=0.7, heroScore=0.665).

Implementation: `ranked.sort((a, b) => b.heroScore - a.heroScore)` + `ranked[0]` — explicit sort-and-pick, no iteration.

---

### 2. A dedicated Hero ranking policy/formula exists and is versioned/configurable
**PASS**

- `HERO_SCORE_WEIGHTS` (version: `v1`) defined in `env.ts:144–150`:
  ```
  profileRelevance:   0.45
  semanticConfidence: 0.25
  qualityPrior:       0.20
  languageAffinity:   0.10
  ```
- Weights sum to 1.0 (verified by test #9 arithmetic).
- `HERO_MIN_SCORE` (default 0.55) and `HERO_POOL_SIZE` (default 15) are env-configurable via `process.env`.
- `computeHeroScore()` is a pure exported function, tested in isolation (tests #9, #10).
- Version label `v1` appears in every `[HERO_RANKING]` log line.

---

### 3. Multiple strong candidates are evaluated before selection
**PASS**

- Pool limited to top `HERO_POOL_SIZE=15` candidates from input.
- Test #2 demonstrates 10 candidates fully evaluated and ranked before selection.
- Log output shows `pool=N eligible=M` counts for every invocation.

---

### 4. Profile relevance remains primary; quality/confidence/localization act as safeguards
**PASS**

- `profileRelevance` weight (0.45) is strictly dominant — more than `semanticConfidence + languageAffinity` combined (0.35).
- Test #7: "Parasite" with `languageAffinity=0.10` (foreign) and `profileScore=0.92` wins over "Domestic Film" with `languageAffinity=0.90` but `profileScore=0.65`. heroScores: 0.804 vs 0.633.
- Test #3: a title with `profileScore=0.85` but `qualityPrior=0.1` (obscure) is beaten by `profileScore=0.80` + `qualityPrior=0.95` (quality). heroScores: 0.653 vs 0.800. Quality acts as a safeguard, not an override.

---

### 5. Hero can select a lower-ranked `Pour toi` candidate
**PASS**

- Tests #1, #2, #3 all select candidates that are not first in input order.
- Integration point in `home-pool-service.ts:556`: `selectHero(profileId, pourToiCandidates)` is called with the full `pourToiCandidates` array before any filtering; the hero's `mediaId` is then excluded from the "Pour toi" rail (line 557: `excludedMediaIds.add(hero.mediaId)`), preserving cross-shelf diversity.

---

### 6. Poor catalog noise is materially less likely to occupy the hero
**PASS**

- Test #3 directly models this: obscure film (high `profileScore=0.85`, low `qualityPrior=0.10`) loses to a quality film (`profileScore=0.80`, `qualityPrior=0.95`). The `qualityPrior` weight (0.20) acts as the noise gate.
- Minimum score gate (`HERO_MIN_SCORE=0.55`) eliminates weak candidates before ranking.

---

### 7. No acceptable candidate => no hero
**PASS**

Three distinct code paths return `null`, all tested:

| Condition | Test |
|---|---|
| Empty candidate list | `no-hero fallback` #1 |
| All candidates below `HERO_MIN_SCORE` or unavailable | `score gate`, `no-hero fallback` #2 |
| All candidates disliked | `dislike gate` #1 |
| All candidates missing backdrop after DB enrichment | `hero ranking` test #8 |

No `undefined` leakage: function returns `Promise<HeroItem | null>`.

---

### 8. Existing ~24h Home snapshot stability/cache behavior preserved
**PASS**

15 `home-snapshot.test.ts` tests, all passing:

| Path | Coverage |
|---|---|
| MISS | Full generation triggered, snapshot saved |
| HIT | `buildDeclaredRails` not called, snapshot served |
| STALE | Served immediately, async regeneration triggered |
| Invalidation | Invalidated snapshot treated as MISS |
| Hero stability | Hero from snapshot returned on HIT without re-running selection |
| Hero stability (consecutive) | Hero unchanged across 2 consecutive HITs |

`HOME_SNAPSHOT_TTL_HOURS=24` env-configurable, unchanged from #268.

---

### 9. Debug/observability explains why the chosen hero won
**PASS**

`[HERO_RANKING]` log line emitted on every invocation (win or null):

**On selection:**
```
[HERO_RANKING] profileId=X pool=N eligible=M winner=mediaId(title) heroScore=0.755 weights=v1
  candidates: [
    { rank: 1, mediaId, title, heroScore, profile, semantic, quality, lang, selected: true },
    { rank: 2, ..., selected: false },
    ...
  ]
```

**On null (no eligible candidates):**
```
[HERO_RANKING] profileId=X result=null reason=no_eligible_candidates
```

Covers all fields required by the ticket: `mediaId`, `title`, per-signal scores, `heroScore`, `selected`, rejection via exclusion from `ranked[]`. No consumer UI exposure — server-side `console.info` only.

Observation: `rejectionReason` for gate-failed candidates (disliked, unavailable, no-backdrop) is implicit (they don't appear in the ranked array). This is acceptable: gate filtering happens before ranking and is identifiable by comparing pool vs eligible counts.

---

### 10. No title-specific/country-specific hardcoding; no manual production DB changes
**PASS**

- No hardcoded `mediaId`, title string, country code, or language code found in `hero-selector.ts` or `home-pool-service.ts`.
- Formula is purely arithmetic over data signals from the recommendation engine.
- No DB migration, seed, or manual data change required.

---

## Regressions observed

None.

The 33 failing tests in the full suite are pre-existing integration tests requiring a PostgreSQL connection at port 5433 (ECONNREFUSED). These are unrelated to T127 and affect `auth`, `pairing`, `shelf-concept-generator`, and other services that need a live DB. Two TypeScript errors in `commands.test.ts` and `pairing.test.ts` are pre-existing (missing `accountId` fixture field); files not modified by this branch (confirmed: `git diff main -- apps/api/src/routes/commands.test.ts` = empty).

---

## Blocking issues

None.

---

## Non-blocking observations

1. **`HERO_SCORE_WEIGHTS` are code-level constants**, not individually env-configurable. Changing weights requires a deploy. Acceptable for v1 (version label present, formula fully documented).
2. **No explicit test for unsupported media types** (e.g., `EPISODE`): these fall through `enrichMap` silently (no entry → no backdropUrl → excluded from ranking). Behavior is correct but not explicitly tested.
3. **`rejectionReason` not logged per candidate** for pre-ranking gate failures. The null-path log only gives a global reason. For deep debugging, you cannot distinguish "disliked" from "no-backdrop" from the log alone. Non-blocking for v1.

---

## Decision

**TESTING_PASSED**

All 10 acceptance criteria are satisfied. 34/34 hero-related tests pass. No regressions introduced. Implementation is correct, bounded to the ticket scope, and stable.
