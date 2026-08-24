Both blocking issues are fixed and committed:

1. **`hero-selector.ts`** — introduced a `HeroWeights` structural type (all fields `number`) for the `weights` parameter of `computeHeroScore`, replacing `typeof HERO_SCORE_WEIGHTS` which carried `as const` literal types incompatible with test-constructed objects.

2. **`home-pool-service.test.ts`** — added `qualityPrior: 0, languageAffinity: 0` to the `makeCandidates` fixture to satisfy the required fields added to `ShelfCandidateItem` by T127.

`pnpm tsc --noEmit` now shows only the two pre-existing `accountId` errors (in `commands.test.ts`/`pairing.test.ts`), and all 48 tests pass.
