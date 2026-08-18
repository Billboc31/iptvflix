# T098 — Account → Profile Foundation

## Objective
Introduce a first-class `Account → Profiles` data model, evolve the auth system so every authenticated session carries a securely resolved `profileId`, and wire all existing personalization routes to the dynamic profile instead of the hardcoded `DEFAULT_PROFILE_ID` constant. Add an interaction-event store for future recommendation signals and provide an idempotent boot-time migration so no existing watch progress, My List, or feedback data is lost.

## Included

### 1. Schema — `accounts` table (new)
File: `apps/api/src/db/schema/accounts.ts`

| Column | Type | Constraint |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `username` | text | NOT NULL, UNIQUE |
| `passwordHash` | text | NOT NULL |
| `email` | text | nullable |
| `maxProfiles` | integer | NOT NULL DEFAULT 5 |
| `createdAt` | timestamptz | NOT NULL DEFAULT now() |
| `updatedAt` | timestamptz | NOT NULL DEFAULT now() |

### 2. Schema — `profiles` table (extend)
File: `apps/api/src/db/schema/profiles.ts`

Add columns:

| Column | Type | Notes |
|---|---|---|
| `accountId` | uuid | FK → accounts.id (backfill before NOT NULL) |
| `avatarKey` | text | nullable |
| `isKids` | boolean | NOT NULL DEFAULT false |
| `maturityLevel` | text | nullable |
| `preferredUiLanguage` | text | nullable |
| `subtitlesEnabledPreference` | boolean | nullable (null = auto) |
| `autoplayNextEpisode` | boolean | NOT NULL DEFAULT true |
| `autoSkipIntro` | boolean | NOT NULL DEFAULT false |
| `autoSkipRecap` | boolean | NOT NULL DEFAULT false |
| `neverStopMode` | boolean | NOT NULL DEFAULT false |
| `updatedAt` | timestamptz | NOT NULL DEFAULT now() |
| `lastUsedAt` | timestamptz | nullable |

### 3. Schema — `profile_interaction_events` table (new)
File: `apps/api/src/db/schema/profile-interaction-events.ts`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, gen_random_uuid() |
| `profileId` | uuid | NOT NULL, FK → profiles.id ON DELETE CASCADE |
| `mediaType` | text | nullable (MOVIE/SERIES/EPISODE) |
| `mediaId` | uuid | nullable |
| `episodeId` | uuid | nullable |
| `eventType` | text | NOT NULL |
| `occurredAt` | timestamptz | NOT NULL |
| `positionMs` | integer | nullable |
| `durationMs` | integer | nullable |
| `shelfId` | uuid | nullable |
| `deviceType` | text | nullable |
| `sourceId` | uuid | nullable |
| `metadataJson` | jsonb | nullable |

Index on `(profileId, occurredAt DESC)` for future queries.

Allowed `eventType` values (enforced at service layer, not DB enum to allow future extension without migrations):
`DETAIL_OPENED`, `PLAY_STARTED`, `PLAY_RESUMED`, `PLAY_PAUSED`, `PLAY_COMPLETED`, `PLAY_ABANDONED`, `MY_LIST_ADDED`, `MY_LIST_REMOVED`, `LIKED`, `DISLIKED`, `SEARCH_PERFORMED`, `SEARCH_RESULT_OPENED`, `SHELF_IMPRESSION`, `SHELF_ITEM_OPENED`, `PREVIEW_STARTED`, `SOURCE_SELECTED`

### 4. Drizzle migration
Run `npm run db:generate` after schema changes to produce the SQL migration file in `apps/api/migrations/`. The migration:
- Creates `accounts`
- Creates `profile_interaction_events`
- Adds new nullable columns to `profiles` (no data loss, safe on live DB)
- Adds `accountId` column as nullable, defers the NOT NULL constraint until after the boot-time seed fills it

### 5. Idempotent boot-time seed
File: `apps/api/src/db/seed.ts` (new) — called once at server startup before the first request.

Logic (fully idempotent — safe to run on every restart):
```
if (no account exists):
  insert account(username = AUTH_USERNAME, passwordHash = AUTH_PASSWORD_HASH)

default account = first account row

if (profile 00000000-0000-0000-0000-000000000001 exists AND accountId IS NULL):
  UPDATE profiles SET accountId = default_account.id WHERE id = DEFAULT_PROFILE_ID

if (no profile with accountId = default_account.id):
  INSERT profile(name = 'Default', accountId = default_account.id, …defaults)
```

Called from `apps/api/src/index.ts` during startup, before routes are registered. This replaces the prior single-profile migration seed.

### 6. Auth evolution
File: `apps/api/src/routes/auth.ts` and `apps/api/src/plugins/auth.ts`

`POST /auth/login`:
- Validate `username/password` against `accounts` table using bcrypt compare
- Fallback (only if accounts table is empty): env-var check + auto-create account
- JWT payload changes from `{ username }` to `{ accountId: string, username: string }`

JWT profile context — two-step design:
- Login JWT: `{ accountId, username }` — no profileId yet
- After `POST /profiles/:profileId/select`: new JWT `{ accountId, username, profileId }`

### 7. Auth middleware evolution
File: `apps/api/src/middleware/authenticateWeb.ts`

After decoding JWT:
- Attach `request.account = { id: accountId, username }` (always present on authenticated requests)
- If JWT contains `profileId`: attach `request.profileId = profileId` and verify `profiles.accountId = accountId` on every request (ownership check, prevents stale token cross-account leak)
- If no `profileId` in JWT: for routes that require a profile, return 403 with `{ code: 'PROFILE_NOT_SELECTED' }`
- Routes that are account-level only (e.g., `GET /profiles`, `POST /profiles`) do not require `profileId` in JWT

### 8. Profile CRUD API
File: `apps/api/src/routes/profiles.ts` (new, pluralized; keep `profile.ts` as legacy alias or remove)

| Method | Path | Behaviour |
|---|---|---|
| `GET` | `/profiles` | List all profiles for `request.account.id` |
| `POST` | `/profiles` | Create profile; enforce `account.maxProfiles`; return 409 if at limit |
| `GET` | `/profiles/me` | Return profile identified by `request.profileId` |
| `PATCH` | `/profiles/:profileId` | Update (ownership check); allowed fields from §2 |
| `DELETE` | `/profiles/:profileId` | Cascade personal state; reject if last profile; reject if current |
| `POST` | `/profiles/:profileId/select` | Validate ownership; set `lastUsedAt`; return new JWT with `profileId` |

File: `apps/api/src/services/profile-service.ts` (extend, remove DEFAULT_PROFILE_ID export)

New functions:
- `listProfiles(accountId: string): Profile[]`
- `createProfile(accountId: string, data: CreateProfileInput): Profile`
- `updateProfile(accountId: string, profileId: string, patch: Partial<UpdateProfileInput>): Profile`
- `deleteProfile(accountId: string, profileId: string): void` — throws if last or current
- `selectProfile(accountId: string, profileId: string): Profile` — ownership check + lastUsedAt update
- `getCurrentProfile(accountId: string, profileId: string): Profile` — ownership check

### 9. Personalization routes — remove DEFAULT_PROFILE_ID hardcoding
All routes listed below currently import and use `DEFAULT_PROFILE_ID`. Replace every occurrence with `request.profileId`.

Files to update:
- `apps/api/src/routes/watchlist.ts`
- `apps/api/src/routes/viewing-progress.ts`
- `apps/api/src/routes/feedback.ts`
- `apps/api/src/routes/profile.ts` (redirect or alias to `/profiles/me`)
- `apps/api/src/routes/home.ts`
- `apps/api/src/routes/shelves.ts`
- `apps/api/src/routes/taste.ts`
- `apps/api/src/routes/recommendations.ts` (if exists)
- `apps/api/src/routes/continue-watching.ts` (if separate file)
- Any other route file referencing `DEFAULT_PROFILE_ID`

Service layer already accepts explicit `profileId`; only the route-to-service wiring changes.

### 10. Interaction events route & service
File: `apps/api/src/routes/interaction-events.ts` (new)
- `POST /interaction-events` — protected, requires `profileId` in session
- Validates `eventType` against the allowlist (return 400 for unknown types)
- `profileId` comes from `request.profileId`; never from client body

File: `apps/api/src/services/interaction-event-service.ts` (new)
- `recordEvent(profileId: string, event: InteractionEventInput): void`

### 11. API contracts
File: `packages/api-contracts/src/profile.ts`
- Extend `ProfileResponse` with all new fields from §2
- Add `CreateProfileBody`, `UpdateProfileBody` (subset of fields)
- Add `SelectProfileResponse: { token: string, profile: ProfileResponse }`

File: `packages/api-contracts/src/interaction-events.ts` (new)
- `InteractionEventBody` with all fields from §3 schema
- `InteractionEventType` union type (the allowlist)

File: `packages/api-contracts/src/account.ts` (new)
- `AccountResponse: { id: string, username: string, maxProfiles: number }`

### 12. Tests
File: `apps/api/src/__tests__/profiles.test.ts` (new)

Tests to implement:
- Account → two profiles: same movie has independent `viewing_progress` per profile
- Account → two profiles: `watchlist` membership is independent
- Account → two profiles: `audio/subtitle/skip` preferences are independent
- `POST /profiles/:id/select` with profile from another account → 403
- `POST /profiles` at `maxProfiles` limit → 409
- `DELETE /profiles/:id` on last profile → 409
- `DELETE /profiles/:id` cascades watchlist, progress, feedback for that profile only; sibling profile data intact
- `POST /interaction-events` stores event under correct profile
- `POST /interaction-events` with unknown eventType → 400
- Boot-time seed is idempotent: running twice does not duplicate account or profile
- Pre-T098 default profile (00000000-…) is linked to default account after seed; all prior progress/watchlist/feedback rows remain

## Excluded
- Web / Mobile / Android TV profile-selection UI (follow-up ticket)
- Full recommendation engine or taste-score recomputation changes
- Parental-control enforcement at catalog layer (schema fields added, API filtering deferred)
- Admin multi-account management UI
- Email-based auth, OAuth, or password reset
- Account-level subscription or billing model
- Multi-device session invalidation on profile delete
- Persisted search history (not currently stored)
- TMDB, catalog, or provider-sync changes
- `profile_taste` schema changes (existing structure is sufficient for this ticket)

## Acceptance criteria
- [ ] `accounts` table exists; `POST /auth/login` validates against it; JWT payload contains `accountId`
- [ ] `profiles` table has `accountId`, `isKids`, `maturityLevel`, `autoplayNextEpisode`, `autoSkipIntro`, `autoSkipRecap`, `neverStopMode`, `preferredUiLanguage`, `subtitlesEnabledPreference`, `avatarKey`, `lastUsedAt`, `updatedAt`
- [ ] `profile_interaction_events` table exists with schema from §3
- [ ] `POST /profiles/:profileId/select` returns a JWT containing `profileId`; a request with a profile from a different account is rejected with 403
- [ ] `GET /profiles`, `POST /profiles`, `PATCH /profiles/:id`, `DELETE /profiles/:id` work and enforce account ownership
- [ ] All personalization routes (`/watchlist`, `/progress`, `/continue-watching`, `/feedback`, `/shelves`, `/taste`) derive `profileId` from the session — `DEFAULT_PROFILE_ID` constant is removed
- [ ] `POST /interaction-events` inserts a row under `request.profileId` and returns 400 for an unknown `eventType`
- [ ] Boot-time seed is idempotent: starting the server twice does not create duplicate accounts or profiles
- [ ] Two profiles on one account simultaneously hold different watch progress, My List state, and skip preferences for the same movie (verified by test)
- [ ] A session for account A cannot read or modify a profile belonging to account B
- [ ] All existing watch progress, My List entries, and feedback rows are preserved after upgrading from pre-T098; no DB reset required
- [ ] Creating more than `maxProfiles` profiles returns a 409 error
- [ ] Deleting the last profile on an account returns a 409 error
- [ ] `isKids` and `maturityLevel` are present on profile schema; no catalog filtering enforcement is added in this ticket
