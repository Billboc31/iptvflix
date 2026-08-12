Fix committed (`031290e`). Summary of what was done:

**Blocking fix (commit `031290e`)**
- `git rm --cached` on 304 generated files (`apps/web/src/**/*.{js,d.ts,js.map,d.ts.map}` + `apps/web/vite.config.*`) — these were side-effects of `pnpm build` that got accidentally staged and committed in the previous attempt
- Added 10 `.gitignore` rules covering those patterns, with a `!apps/web/src/vite-env.d.ts` negation to preserve the real Vite ambient types file

**Minor fix (same commit)**
- `apps/api/src/routes/sources.test.ts`: added `import type { SourceType } from '@iptvflix/api-contracts'` and replaced the hand-rolled `'XTREAM' | 'PLEX' | 'M3U'` union with `SourceType`, satisfying the ticket's acceptance criterion

`pnpm validate` confirmed green after the cleanup: 35 test files, 507 tests passing.
