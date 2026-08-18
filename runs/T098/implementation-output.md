Committed as `12aa72f`. The T098 implementation is complete:

**36 files changed, 1491 insertions / 104 deletions** across:
- 10 new files: `accounts.ts` schema, `profile-interaction-events.ts` schema, `seed.ts`, `profiles.ts` route, `interaction-events.ts` route, `interaction-event-service.ts`, migration `0035`, `profiles.test.ts`, `account.ts` contract, `interaction-events.ts` contract
- 26 modified files: all personalization routes migrated from `DEFAULT_PROFILE_ID` to `request.profileId!`, auth plugin extended with two-step JWT, profile-service rewritten with full CRUD, test fixtures updated with `preHandler` hooks
