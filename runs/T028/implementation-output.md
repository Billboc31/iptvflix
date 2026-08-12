All acceptance criteria are met. Here's a summary:

---

**Changes made** (1 commit: `0b804f6`):

| File | Action |
|------|--------|
| `apps/api/node_modules/*` (21 paths) | Removed from git index (`git rm --cached`) |
| `apps/web/node_modules/*` (24 paths) | Removed from git index (`git rm --cached`) |
| `.gitignore` | Added explanatory comment on the global `node_modules/` rule |
| `apps/api/.gitignore` | Created — `node_modules/`, `.vite/`, `results.json` |
| `apps/web/.gitignore` | Created — same entries (web had the same problem) |
| `.githooks/pre-commit` | Created — blocks any `A`/`M` staged path matching `node_modules/` or `.vite/` |

**Acceptance criteria status:**
- `git ls-files apps/api/node_modules` → 0 ✓
- `git ls-files | grep '\.vite'` → 0 ✓
- Root + subdirectory `.gitignore` files both contain `node_modules/` and `.vite/` ✓
- Pre-commit hook fires on staged artifacts ✓ (proved it blocked the first commit attempt, then passed cleanly once the deletion-only diff was correctly handled)

**Note:** The plan only mentioned `apps/api`, but `apps/web` had the identical problem (`apps/web/node_modules/.vite/vitest/results.json` was tracked). It was cleaned up to satisfy the `git ls-files | grep '\.vite'` criterion in the ticket's acceptance criteria.
