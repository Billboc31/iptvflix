## Objective

Remove the committed `apps/api/node_modules` (and nested `.vite/vitest`) artifacts from git tracking, reinforce the existing `.gitignore` rules, and add a pre-commit safeguard so the AI-driven ticket workflow cannot accidentally re-stage these paths.

## Included

### 1. Untrack committed artifacts
- Run `git rm -r --cached apps/api/node_modules` to remove all 22 tracked paths under `apps/api/node_modules` from the git index without touching the working directory.
- Commit the resulting index change as a dedicated cleanup commit.

### 2. Harden `.gitignore`
- **Root `.gitignore`**: already contains `node_modules/` and `.vite/`. Add an explicit negation guard comment explaining these are intentionally global so subdirectory installs remain covered.
- **`apps/api/.gitignore`** (create if absent): add explicit entries `node_modules/`, `.vite/`, and `vitest-results.json` / `results.json` as belt-and-suspenders, since subdirectory-level rules survive future root-level edits.

### 3. Pre-commit safeguard hook
- Add `.husky/pre-commit` (or `.git/hooks/pre-commit` if Husky is not used) that runs:
  ```sh
  git diff --cached --name-only | grep -E '^.*/node_modules/|^.*/.vite/' && \
    echo "ERROR: staged path contains node_modules or .vite" && exit 1 || exit 0
  ```
- This blocks any commit that includes these paths, regardless of how staging was performed.

### 4. Verify CI
- Run `pnpm install` + existing test/build pipeline locally to confirm removing the tracked symlinks/binaries from git tracking does not affect reproducible installs.
- Confirm `git ls-files apps/api/node_modules` returns empty after the cleanup commit.

## Excluded

- Removing or restructuring `apps/api/` package layout or `pnpm-workspace.yaml`.
- Fixing any other `.gitignore` gaps beyond `node_modules/` and `.vite/` artifacts.
- Changing the CI workflow YAML (the tracked artifacts are a git-index problem, not a CI pipeline problem).
- Auditing other packages (`apps/android-tv`, etc.) for similar issues — the problem was reported only for `apps/api`.
- Updating `runs/` gitignore rules (those paths are already untracked per current git status).

## Acceptance criteria

- `git ls-files apps/api/node_modules` returns empty.
- `git ls-files | grep '\.vite'` returns empty.
- Root `.gitignore` and `apps/api/.gitignore` both contain explicit `node_modules/` and `.vite/` entries.
- A test commit containing a file under `apps/api/node_modules/` is rejected by the pre-commit hook.
- `pnpm install && pnpm test` (or equivalent) passes cleanly on the branch after the cleanup commit.
