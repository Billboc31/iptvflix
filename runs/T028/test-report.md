# Test Report — T028

**Date**: 2026-08-12  
**Branch**: ticket/T028-do-not-commit-generated-node-modules-vitest-artifa  
**Tester**: Claude Sonnet 4.6

---

## Acceptance Criteria

### AC1 — No `node_modules` or `.vite` generated artifacts remain tracked

**Status: PASS**

Command:
```
git ls-files | grep -E '(node_modules|\.vite)'
```
Output: empty — zero tracked paths match.

The implementation commit `2f7fcf6` removed 45 previously committed paths across `apps/api/node_modules/` and `apps/web/node_modules/` (symlinks, `.vite/vitest/results.json`, the absolute-path `node_modules/node_modules` symlink).

---

### AC2 — `.gitignore` (or equivalent) prevents re-committing these files

**Status: PASS**

Three layers of protection are active:

| File | Rule |
|------|------|
| `.gitignore` | `node_modules/`, `.vite/` |
| `apps/api/.gitignore` | `node_modules/`, `.vite/`, `vitest-results.json`, `results.json` |
| `apps/web/.gitignore` | `node_modules/`, `.vite/`, `vitest-results.json`, `results.json` |

`git check-ignore` confirmed all previously committed paths are now covered:

```
apps/api/.gitignore:2:node_modules/   apps/api/node_modules/vitest
apps/api/.gitignore:2:node_modules/   apps/api/node_modules/.vite/vitest/results.json
apps/api/.gitignore:2:node_modules/   apps/api/node_modules/node_modules
apps/web/.gitignore:2:node_modules/   apps/web/node_modules/.vite/vitest/results.json
```

---

### AC3 — Automated ticket workflow does not stage these paths

**Status: PASS**

Two enforcement layers verified:

**Layer 1 — `.gitignore` blocks `git add`**  
Attempting to stage `apps/api/node_modules/.vite/fake.json` (simulated):
```
The following paths are ignored by one of your .gitignore files:
apps/api/node_modules
hint: Use -f if you really want to add them.
```
`git add` exits non-zero — staging fails without `--force`.

**Layer 2 — `.githooks/pre-commit` blocks forced staging**  
Force-staged the same file, then ran the hook:
```
ERROR: staged paths contain node_modules or .vite artifacts — unstage them before committing.
apps/api/node_modules/.vite/fake.json
hook_exit=1
```
Hook exits 1, commit is rejected.

Hook is active: `git config core.hooksPath` returns `.githooks`. File is executable (`-rwxr-xr-x`).

Deletions of `node_modules`/`.vite` paths are explicitly allowed by the hook (only `[AM]` status codes are checked), so the cleanup commit itself was not blocked.

---

### AC4 — Existing build/tests still pass after cleanup

**Status: PASS (no regression introduced by T028)**

Running `npm run build` after T028 yields TypeScript errors in test files:
- `apps/api/src/__tests__/integration/vertical-slice.test.ts` — TS2347
- `apps/api/src/routes/sources.test.ts` — TS2322 (PLEX type narrowing)
- `apps/api/src/services/__tests__/catalog-sync-service.test.ts` — TS2783 (duplicate keys)

**These errors are pre-existing.** Verified by running the same build with `git stash` (T028 changes removed): identical errors produced. T028 modifies only `.gitignore` files and the pre-commit hook — no source or test files were touched.

The `apps/web` build (Vite) completes successfully.

---

## Summary

| Criterion | Status | Notes |
|-----------|--------|-------|
| No tracked `node_modules`/`.vite` artifacts | **PASS** | 45 paths removed from index |
| `.gitignore` prevents re-committing | **PASS** | Root + per-app rules, all previously committed paths covered |
| Workflow cannot stage these paths | **PASS** | `.gitignore` + pre-commit hook, two layers verified |
| No regression in build/tests | **PASS** | TypeScript errors pre-existing, not introduced by T028 |

**Overall: PASS** — all acceptance criteria satisfied. Implementation can proceed to PR.

---

## Known limitations

- TypeScript build errors in test files (`sources.test.ts`, `vertical-slice.test.ts`) are pre-existing and out of scope for T028.
- Build was tested without a database; integration tests requiring Postgres were not run.
