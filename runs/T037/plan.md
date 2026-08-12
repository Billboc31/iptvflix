I now have a complete picture of what's tracked. Let me write the plan.

## Objective

Remove all generated dependency and cache artifacts — specifically `apps/api/node_modules/`, `apps/web/node_modules/`, and the nested `.vite/vitest/results.json` files — from Git tracking, while leaving `.gitignore` rules intact so they are never re-tracked.

## Included

- **Audit**: confirm the exact set of tracked paths via `git ls-files | grep node_modules` (45 entries across `apps/api/node_modules/` and `apps/web/node_modules/`, including `.bin/` symlinks, scoped packages, and `apps/api/node_modules/.vite/vitest/results.json` + `apps/web/node_modules/.vite/vitest/results.json`).
- **Untrack**: run `git rm -r --cached apps/api/node_modules apps/web/node_modules` to remove all tracked entries from the index without touching working-tree files.
- **Verify .gitignore coverage**: confirm the root `.gitignore` already contains `node_modules/` and `.vite/` (it does — no edit required).
- **Commit**: produce a single commit with an appropriate message (e.g. `chore: untrack node_modules and .vite artifacts`).
- **Post-commit check**: run `git ls-files | grep node_modules` and confirm zero results; run `git ls-files | grep '\.vite'` and confirm zero results.
- **Files legitimately preserved** (not touched):
  - `apps/api/vitest.config.ts` — source file, not in `node_modules/`
  - `apps/web/vitest.config.ts` — source file, not in `node_modules/`

## Excluded

- Editing or restructuring `.gitignore` rules (already correct).
- Removing legitimate source fixtures or test data outside `node_modules/` or `.vite/`.
- Any CI or workflow changes.
- Any package-manager migration or pnpm-store changes.

## Acceptance criteria

- `git ls-files | grep node_modules` returns zero lines after the commit.
- `git ls-files | grep '\.vite'` returns zero lines after the commit.
- Root `.gitignore` still contains `node_modules/` and `.vite/` entries.
- `apps/api/vitest.config.ts` and `apps/web/vitest.config.ts` remain tracked (`git ls-files apps/api/vitest.config.ts apps/web/vitest.config.ts` lists both).
- A fresh `git status` after running `pnpm install` shows no unexpected staged or unstaged changes in `node_modules/`.
- CI build and test suite pass on the resulting commit.
