Both blocking issues fixed and committed. Here's a summary:

**Fix 1 — LeftNav.tsx** (`apps/web/src/components/layout/LeftNav.tsx`)
- Added `disabled?: boolean` to `NavItem` type
- Marked `/radar`, `/list`, `/history` with `disabled: true`
- Disabled items render as a `<div>` with `opacity-40 cursor-not-allowed select-none` and a `title="Fonctionnalité à venir"` tooltip — no React Router involvement, no blank screen

**Fix 2 — OnboardingPage.tsx** (`apps/web/src/pages/OnboardingPage.tsx`)
- Imported `listSyncRuns`
- After `triggerSync`, enters a polling loop (`setTimeout` every 2s) calling `listSyncRuns()` until the matching run reaches `DONE` or `FAILED`
- Only sets `syncDone = true` and advances to step 3 when the backend confirms `status === 'DONE'`
- `FAILED` status surfaces the error message correctly

Tests: **26/26 pass** (unchanged).
