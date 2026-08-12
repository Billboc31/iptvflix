# Validation commands

## Full validation (required before TEST_COMPLETE)

```
pnpm validate
```

This runs the three sequential gates below. A non-zero exit means validation failed — it must not be treated as TEST_COMPLETE.

## Individual gates

| Command | What it validates |
|---|---|
| `pnpm build` | Production TypeScript compilation for `apps/api` (via `tsconfig.build.json`, excludes `*.test.ts`) and `apps/web`. Catches broken imports in production code. |
| `pnpm typecheck` | TypeScript type-checking for all packages and apps, **including** test source files. Catches stale type fixtures and type regressions in tests. |
| `pnpm test` | Full Vitest unit and integration test suite for `apps/api`. Requires a running PostgreSQL instance (see `DATABASE_URL`). |

## Environment-dependent tests

Integration tests in `src/__tests__/integration/` and `src/db/__tests__/` require `DATABASE_URL` to point to a PostgreSQL instance. CI provides this automatically. For local runs, use `pnpm reset-local` or set `DATABASE_URL` manually.

## Rule

`TEST_COMPLETE` requires `pnpm validate` to exit with code 0.
