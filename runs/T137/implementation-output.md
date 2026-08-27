All expected files are present. Implementation is complete. Here's a summary:

---

## Changes delivered

### New files
| File | Purpose |
|------|---------|
| `apps/api/migrations/0056_t137_live_search.sql` | Enables PostgreSQL `unaccent` extension for accent-insensitive channel name search |
| `apps/api/src/services/live-search-normalizer.ts` | Strips French conversational prefixes (`je veux regarder`, `regarder`, `mettre`, `voir`) deterministically |
| `apps/api/src/services/live-search-service.ts` | Core `searchLiveTV()` — queries channels via `unaccent ILIKE`, resolves EPG catalog IDs to canonical channels, collapses duplicate sources, deduplicates repeated programs, groups into `liveNow`/`upcoming`/`channels` |
| `apps/api/src/services/__tests__/live-search-service.test.ts` | 27 passing tests covering all acceptance criteria |

### Modified files
| File | Change |
|------|--------|
| `apps/api/src/services/epg-service.ts` | Exports `EpgCache` + `EpgMatch` types; adds `searchEpgPrograms()` with accent/case-insensitive title matching and `isLive`/`matchWeight` classification |
| `packages/api-contracts/src/channels.ts` | Adds `LiveNowResult`, `UpcomingResult`, `ChannelResult`, `LiveSearchResponse` types |
| `apps/api/src/routes/channels.ts` | Adds `GET /channels/search?q=` endpoint (no auth, 400 on empty/long query, normalises conversational prefixes) |
| `apps/api/vitest.config.ts` | Adds dummy `DATABASE_URL` env var so unit tests don't error on import |
| `apps/android-tv/.../ChannelModels.kt` | Adds `LiveNowResult`, `UpcomingResult`, `ChannelSearchResult`, `LiveSearchResponse` data classes |
| `apps/android-tv/.../ChannelApi.kt` | Adds `searchLiveTV(query: String): LiveSearchResponse` |
