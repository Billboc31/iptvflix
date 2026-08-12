# Test Report — T048 — Restore full green validation across build, typecheck and tests

**Date**: 2026-08-13  
**Branch**: ticket/T048-restore-full-green-validation-across-build-typeche  

---

## Commands executed

```
pnpm validate   # = pnpm build && pnpm typecheck && pnpm test
```

Exit code: **0**

---

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Root production build green on clean checkout | ✅ PASS | `pnpm build` exits 0; API compiled via `tsconfig.build.json`, Web via `tsc && vite build` — no errors |
| 2 | API and Web typecheck commands green with maintained test sources included | ✅ PASS | `pnpm typecheck` exits 0 across `packages/api-contracts`, `apps/api`, `apps/web` |
| 3 | Full automated test suite green (or env-dependent tests isolated with documented requirements) | ✅ PASS | 35 test files, 507 tests — all pass; integration tests require PostgreSQL, documented in `docs/validation.md` |
| 4 | PLEX/M3U/XTREAM test fixtures use correct shared `SourceType` rather than XTREAM-only helper inference | ✅ PASS | `sources.test.ts` imports `SourceType` from `@iptvflix/api-contracts` and uses it as the discriminator |
| 5 | Existing title-matching/catalog-sync failures fixed as regressions or updated with justified expectations | ✅ PASS | `title-normalizer.test.ts` updated with `variantAttributes` assertions; `catalog-sync-service.test.ts` updated with multi-provider fixtures |
| 6 | No test deleted or skipped without documented justification | ✅ PASS | No `.skip` / `.todo` in any test file; no test file removed |
| 7 | AI Dev Factory/CI has a clear full-validation command with non-zero exit on failure | ✅ PASS | `pnpm validate` defined in root `package.json`; `docs/validation.md` documents rule requiring exit 0 for TEST_COMPLETE |

---

## Additional observations

- **API build config**: `apps/api/tsconfig.build.json` correctly excludes `src/**/*.test.ts` and `src/**/__tests__/**`. Test sources are only compiled during `pnpm typecheck`.
- **`.gitignore` hygiene**: Web build artifacts (`apps/web/src/**/*.{js,d.ts,js.map,d.ts.map}`, `vite.config.*`) excluded; `!apps/web/src/vite-env.d.ts` negation preserved.
- **stderr in tests**: Two test files emit expected `stderr` output (catalog-sync conflict log, discovery network error) — these are intentional assertions verifying warning/error paths and do not affect test pass status.
- **CI consistency (known minor)**: `.github/workflows/ci.yml` runs the three gates as separate steps rather than calling `pnpm validate` directly. Functionally equivalent; noted as minor in implementation review and not a regression.

---

## Verdict

**TEST_COMPLETE — all acceptance criteria satisfied.**

`pnpm validate` exits 0. No test deleted or skipped. No regression observed.
