# T083 — Plan: Diagnose blank web UI after latest playback changes

## Objective

Identify the exact runtime/build/deployment cause of the blank web UI introduced after the T082 playback changes, implement the smallest fix to restore the application shell, and add a top-level error boundary so a future catastrophic render failure is diagnosable rather than silent.

## Included

### Phase 1 — Reproduce & diagnose (no code changes yet)

1. **Local production build**
   - `pnpm --filter web build` then `pnpm --filter web start`
   - Load `http://localhost:3000` and capture browser console output (first uncaught exception + stack trace)
   - Capture network tab: note any failed asset (404/500), failed API call, or CORS error during bootstrap

2. **Check recent commits for global side effects**
   - `git diff f4e858d..HEAD -- apps/web/src/` focused on:
     - `apps/web/src/hooks/usePlayback.ts` — any top-level or module-level HLS/browser API access
     - `apps/web/src/pages/PlayerPage.tsx` — any initialization executed outside component lifecycle
     - `apps/web/src/context/AuthContext.tsx` — any change to the `/auth/me` bootstrap call
   - Confirm: does any playback import execute during non-player route load?

3. **AuthContext resilience check**
   - `apps/web/src/context/AuthContext.tsx`: verify that a failed `/auth/me` call is caught and produces a recoverable state (not an unhandled rejection that crashes the provider tree)

4. **Railway deployment check**
   - Verify `VITE_API_BASE` is set in Railway web service env vars (missing = all API calls fail at bootstrap)
   - Confirm build command, start command, PORT binding from `apps/web/railway.toml`
   - Check Railway build logs for the deployed commit SHA and any build-time error

### Phase 2 — Fix root cause

Once the first blocking error is identified, implement the smallest change:

**Option A — Playback import/init causes crash at route level**
- `apps/web/src/pages/PlayerPage.tsx` or `apps/web/src/hooks/usePlayback.ts`: move any top-level browser API access or HLS instantiation inside component/effect scope so it never executes on non-player routes

**Option B — AuthContext unhandled rejection blanks the tree**
- `apps/web/src/context/AuthContext.tsx`: wrap the `/auth/me` fetch in try/catch; on failure set `isAuthenticated = false` and expose an `authError` signal rather than letting the promise reject unhandled

**Option C — Missing/wrong `VITE_API_BASE` Railway env var**
- Fix the Railway environment variable; no code change required
- Add a build-time guard in `apps/web/src/lib/api.ts` (or equivalent) that throws a clear error if `VITE_API_BASE` is empty, rather than silently producing broken requests

### Phase 3 — Error boundary (required regardless of root cause)

- New file: `apps/web/src/components/ui/ErrorBoundary.tsx`
  - Class component implementing `componentDidCatch` + `getDerivedStateFromError`
  - Renders a visible "Something went wrong" panel (not a blank page) with sanitized message (no credentials/URLs)
- `apps/web/src/App.tsx`: wrap the provider tree with `<ErrorBoundary>` as the outermost element
- `apps/web/src/main.tsx`: optionally wrap `<App />` as secondary safety net

### Phase 4 — Regression test (where practical)

- `apps/web/src/components/ui/ErrorBoundary.test.tsx`: unit test that a child throwing renders the fallback, not a blank DOM node
- If AuthContext resilience was fixed: add a test that a failed `/auth/me` call leaves the shell visible

### Documentation

- `runs/T083/diagnostic.md`: record the first blocking error, its stack trace, responsible commit/PR, and the fix applied

## Excluded

- UI redesign or feature work unrelated to the blank-screen regression
- Refactoring playback code beyond what is necessary to isolate initialization side effects
- Changing Railway infrastructure (other than correcting a wrong env var)
- Addressing any other T082 playback correctness issues not directly causing the blank screen
- Adding error boundaries at sub-route or page level (only top-level is in scope)
- Backend / API changes

## Acceptance criteria

- [ ] Root cause is documented in `runs/T083/diagnostic.md` with the first blocking exception/error and its stack trace
- [ ] The responsible commit/PR/file is identified
- [ ] `pnpm --filter web build && pnpm --filter web start` produces a visible Home page at `localhost:3000` (not a blank page)
- [ ] Browser console shows no uncaught exceptions during application bootstrap
- [ ] Top navigation renders on `/`, `/movies`, `/series`
- [ ] A child component throwing inside `<ErrorBoundary>` renders the visible fallback panel, not a blank page (unit test passes)
- [ ] A failed `/auth/me` call does not produce a blank page; a visible loading/error state is shown instead
- [ ] PlayerPage / HLS initialization does not execute on non-player routes
- [ ] Railway deployment serves the intended build (correct SHA confirmed in deploy logs, no 404/500 on assets)
- [ ] `VITE_API_BASE` is set in Railway env vars and verified
- [ ] Existing T082 playback behavior is preserved unless proven to be the direct cause
