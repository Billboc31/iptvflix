# T028 — Do not commit generated node_modules/Vitest artifacts from workflow runs

**Source**: GitHub Issue #60

## Description

## Problem

PR #59 merged generated/local artifacts into `main` under `apps/api/node_modules`, including:

- `apps/api/node_modules/.vite/vitest/results.json`
- `apps/api/node_modules/node_modules` containing an absolute local path (`/Users/pierrebocquet/iptvflix/apps/api/node_modules`)

These files are environment-specific, noisy, and can make automated ticket branches non-reproducible.

## Expected fix

- Remove the committed generated files from `main`.
- Ensure `node_modules/`, `.vite/`, Vitest cache/results and similar generated artifacts are ignored at repository level.
- Add/adjust workflow safeguards so ticket execution cannot accidentally stage generated dependency/cache files.
- Verify future generated PRs contain only intentional source/run artifacts.

## Acceptance criteria

- [ ] No `node_modules` or `.vite` generated artifacts remain tracked.
- [ ] `.gitignore` (or equivalent repository rules) prevents them from being committed again.
- [ ] Automated ticket workflow does not stage these paths.
- [ ] Existing build/tests still pass after cleanup.

Found while reviewing PR #59 / ticket #52.
