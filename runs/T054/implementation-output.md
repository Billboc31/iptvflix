All 8 HeroSection tests and all 12 PosterCard tests pass. Full suite: 20 test files, 129 tests, no failures.

The root cause was stale TypeScript-compiled `.js` artifacts left in the source tree alongside the `.tsx` sources. When Vitest resolved `./HeroSection.js`, it found and loaded the pre-T054 compiled artifact (which had no preview logic, no context usage, no mute button) instead of the updated `HeroSection.tsx`. Same for `PosterCard.js`. Deleting all compiled artifacts from `src/` lets Vitest fall back to the TypeScript sources for all `.js` imports.
