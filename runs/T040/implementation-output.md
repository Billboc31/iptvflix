All 437 tests pass. Here's a summary of all changes made:

---

## Files created or modified

| File | Change |
|---|---|
| `apps/api/src/db/schema/profile-taste.ts` | New — `profile_taste` Drizzle table |
| `apps/api/src/db/schema/index.ts` | Added `export * from './profile-taste.js'` |
| `packages/api-contracts/src/taste.ts` | New — `GenreScore` and `ProfileTaste` types |
| `packages/api-contracts/src/index.ts` | Added `export * from './taste.js'` |
| `apps/api/src/services/profile-taste-service.ts` | New — `buildTaste`, `getTaste`, `SIGNAL_WEIGHTS` |
| `apps/api/src/routes/taste.ts` | New — `GET /taste`, `POST /taste/rebuild` |
| `apps/api/src/index.ts` | Registered `tasteRoutes` |
| `apps/api/migrations/0017_profile_taste.sql` | New — SQL migration for `profile_taste` |
| `apps/api/migrations/meta/0017_snapshot.json` | New — Drizzle schema snapshot |
| `apps/api/migrations/meta/_journal.json` | Added entry for migration 0017 |
| `apps/api/src/services/__tests__/profile-taste-service.test.ts` | New — 16 service unit tests |
| `apps/api/src/routes/__tests__/taste.test.ts` | New — 6 route tests |

## Weights implemented

| Signal | Weight |
|---|---|
| LIKE | +3 |
| DISLIKE | −3 |
| NOT_INTERESTED | −2 |
| Completed view (≥90%) | +1 |
| In-progress view (5–90%) | +0.5 |
| Watchlist | +0.5 |

Note: `drizzle-kit generate` couldn't run directly in the worktree (broken pnpm symlinks), so the migration and snapshot were written manually following the established chain format.
