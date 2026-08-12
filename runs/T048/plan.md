Now I have enough context. Let me write the plan.

## Objective

Restore a trustworthy, fully-green validation baseline across the monorepo (root build, API/Web typecheck, full test suite) by triaging every current failure, fixing stale type fixtures and genuine small regressions, and standardising the single CI/AI Dev Factory validation command.

## Included

**Phase 1 — Failure inventory**
- Run `pnpm typecheck` (root) and `pnpm test` (root) on the current branch; capture every non-zero exit with full output.
- Run `pnpm build` to confirm production build is green (uses `apps/api/tsconfig.build.json` which already excludes `*.test.ts`).
- Produce a triage table: file / error / verdict (stale fixture | genuine regression | env-dependent).

**Phase 2 — Fix stale type fixtures**
- `apps/api/src/routes/sources.test.ts` — `MockSource` type: align the union `'XTREAM' | 'M3U' | 'PLEX'` with the current canonical `SourceType` from `packages/api-contracts`; remove any hand-rolled type that duplicates or conflicts with the shared type.
- `apps/api/src/services/__tests__/` (up to 6 files) — replace any helper that infers type from XTREAM-only shapes with the correct shared `SourceType` discriminator.
- `apps/api/src/db/__tests__/catalog-constraints.test.ts` and `apps/api/src/__tests__/integration/vertical-slice.test.ts` — update fixtures to include all three provider variants where the model now requires it.
- Any other test file returned by the Phase 1 inventory that fails for the same root cause.

**Phase 3 — Fix genuine small regressions**
- Title-matching / catalog-sync failures that are confirmed product regressions (not stale expectations): fix the implementation or the assertion, with a one-line comment explaining the verdict.
- Scope: only changes whose blast radius is contained to the failing module; no cross-cutting refactors.

**Phase 4 — Build config hygiene**
- Verify `apps/api/tsconfig.build.json` correctly excludes `src/**/*.test.ts` and `src/**/__tests__/**`; adjust if the Phase 1 inventory reveals escaping test files.
- Verify `apps/api/tsconfig.json` (used by `typecheck`) correctly includes all maintained test sources so type errors in tests are caught.
- Remove any brittle cache-file (`*.generated`, `*.cache`) that is used as a success signal anywhere in scripts or CI.

**Phase 5 — Standardise validation commands**
- Add a root `validate` script to `package.json`:
  ```
  "validate": "pnpm build && pnpm typecheck && pnpm test"
  ```
- Update `.github/workflows/ci.yml` to call `pnpm validate` as its single gate (or keep the three steps but ensure they are sequential and all required).
- Add a `docs/validation.md` (≤ 1 page) listing the exact commands, what each validates, and the rule that TEST_COMPLETE requires a zero exit from `pnpm validate`.

## Excluded

- New product features or API endpoints.
- Migrating to a different test framework (Vitest stays).
- E2E / Playwright test fixes (separate job, separate ticket if needed).
- Large provider-model refactors not directly related to a failing assertion.
- Replacing or restructuring the CI pipeline beyond adding/adjusting the validation step.

## Acceptance criteria

- `pnpm build` exits 0 on a clean checkout with no test sources compiled into `dist/`.
- `pnpm typecheck` exits 0 with maintained test files included in the typecheck scope.
- `pnpm test` exits 0; no test is marked `.skip` or deleted without a one-line justification comment referencing the triage verdict.
- All `MockSource` / provider-type fixtures in test files use the shared `SourceType` from `packages/api-contracts`, not a hand-rolled local union.
- `pnpm validate` (new root script) exits non-zero if any of the three gates fails; CI uses it (or the equivalent sequential steps) as its mandatory gate.
- `docs/validation.md` documents the commands and states the rule that a zero exit is required for TEST_COMPLETE.
- No brittle generated-cache file is referenced as a success signal in any script or workflow.
