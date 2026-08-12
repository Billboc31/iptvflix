# T037 — Remove already-tracked node_modules and Vitest cache artifacts from repository

**Source**: GitHub Issue #77

## Description

## Objective

Finish the repository cleanup by removing generated dependency/cache files that are still tracked on `main`, now that repository ignore rules already cover `node_modules/` and `.vite/`.

## Context / Problem

The broader ignore-rule part of #60 has already been absorbed by other work: the root `.gitignore` now ignores both `node_modules/` and `.vite/`.

However, generated files that were committed before those ignore rules remain tracked by Git. For example, `apps/api/node_modules/.vite/vitest/results.json` is still present on `main`.

Adding paths to `.gitignore` does not automatically untrack files already committed, so a final repository cleanup is required.

## Included

- Identify generated files/directories under `node_modules`, `.vite`, Vitest caches/results, or equivalent dependency/cache paths that are currently tracked.
- Remove those generated artifacts from Git tracking and from the repository tree.
- Preserve the existing ignore rules that prevent them from being re-added.
- Verify the cleanup does not remove legitimate source or repository-owned fixtures.

## Acceptance Criteria

- [ ] No generated files under any `node_modules/` directory remain tracked on `main`.
- [ ] No generated `.vite` / Vitest cache or result artifacts remain tracked on `main`.
- [ ] Existing `.gitignore` rules continue to ignore `node_modules/` and `.vite/`.
- [ ] Running dependency installation/tests locally does not cause these generated files to appear as Git changes.
- [ ] Build and automated tests still pass after cleanup.

## Out of scope

- Redesigning the workflow staging strategy beyond the ignore protections already present.
- Removing legitimate checked-in test fixtures or run artifacts outside generated dependency/cache directories.

## Context

Follow-up to #60, which is being closed because its ignore-rule work was partially implemented elsewhere; this ticket captures only the remaining concrete cleanup.
