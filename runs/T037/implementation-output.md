Done. Here's the summary:

**Changes made**: single commit `8acb10d` — `chore: untrack node_modules and .vite artifacts`

**Files removed from tracking** (45 total):
- `apps/api/node_modules/` — 21 entries (.bin/ symlinks, package symlinks, `.vite/vitest/results.json`)
- `apps/web/node_modules/` — 24 entries (.bin/ symlinks, package symlinks, `.vite/vitest/results.json`)

**Verifications passed**:
- `git ls-files | grep node_modules` → 0
- `git ls-files | grep '\.vite'` → 0
- Root `.gitignore` still contains `node_modules/` and `.vite/` (no edit needed)
- `apps/api/vitest.config.ts` and `apps/web/vitest.config.ts` remain tracked

Working tree is untouched — local `node_modules/` directories are still present for development, and `.gitignore` prevents them from ever being re-tracked.
