All three fixes are in place. Here's what was changed:

**Files modified:**

1. **`packages/api-contracts/src/taste.ts`** — Extended `ProfileTaste` with 10 missing fields: `personScores`, `personMeta`, `keywordScores`, `franchiseScores`, `languageScores`, `countryScores`, `decadeScores`, `mediaTypePreferences`, `completionRate`, `historyEventCount`, `tasteVersion`.

2. **`apps/api/src/services/profile-taste-service.ts`** — Two changes:
   - `buildOutput` now spreads all `extra` fields into the returned object (was silently dropping them).
   - `buildTaste` uses `.returning({ tasteVersion: profileTaste.tasteVersion })` on the upsert so the actual post-conflict incremented version is returned, not a hardcoded `1`.

3. **`apps/api/src/db/schema/profile-interaction-events.ts`** — Added `import { viewingSessions }` and wired `sessionId` with `.references(() => viewingSessions.id, { onDelete: 'set null' })` to align the Drizzle schema with the migration SQL.
