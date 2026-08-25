The implementation is complete. Let me provide the summary.

---

**Implementation complete for T131.**

## Files created (11)

| File | Purpose |
|------|---------|
| `apps/api/src/db/schema/channels.ts` | `channels` table: canonical id, name, logo, tvgId, categories, timestamps |
| `apps/api/src/db/schema/channel-sources.ts` | `channel_sources` table: FK→channels, FK→sources, providerItemId, streamUrl, matchConfidence, matchProvenance, UNIQUE(sourceId, providerItemId) |
| `apps/api/migrations/0053_t131_live_tv_channels.sql` | SQL migration for both tables |
| `apps/api/src/channels/channel-normalizer.ts` | `normalizeChannelName` (strips IPTV prefixes + quality suffixes → lowercase) + `toCanonicalDisplayName` |
| `apps/api/src/channels/category-mapper.ts` | Data-driven keyword mapping to 8 canonical categories; preserves unknowns |
| `apps/api/src/channels/source-selector.ts` | `selectPreferredSources` — sorts AVAILABLE→priority desc→lastSeenAt desc |
| `apps/api/src/services/channel-sync-service.ts` | Core dedup engine: confidence-based matching (tvgId +0.6, normalizedName +0.4, threshold 0.75), in-memory index, lifecycle marking |
| `apps/api/src/channels/__tests__/channel-normalizer.test.ts` | Unit tests for prefix/suffix stripping |
| `apps/api/src/channels/__tests__/category-mapper.test.ts` | Unit tests for all canonical categories + unknown preservation |
| `apps/api/src/services/__tests__/channel-sync-service.test.ts` | Integration tests: dedup, non-merge, multi-provider, logo, ordering, idempotence, lifecycle, provenance |
| `e2e/tests/live-tv-sync.spec.ts` | E2E: 5 raw entries → 3 canonical channels, idempotent re-sync, logo and categories |

## Files modified (13)

| File | Change |
|------|--------|
| `apps/api/src/db/schema/index.ts` | Export both new schemas |
| `apps/api/src/providers/m3u/types.ts` | Add `'live'` to kind union; add `liveChannels` to snapshot |
| `apps/api/src/providers/m3u/parser.ts` | Classify non-VOD/series entries with group-title as `'live'` |
| `apps/api/src/providers/m3u/client.ts` | Populate `liveChannels` in snapshot |
| `apps/api/src/providers/xtream/types.ts` | Add `XtreamLiveCategory`, `XtreamLiveStream`; extend snapshot |
| `apps/api/src/providers/xtream/client.ts` | Add `getLiveCategories()` and `getLiveStreams()` |
| `apps/api/src/services/sync-runs-service.ts` | Fetch live categories+streams in parallel with VOD (graceful degradation) |
| `apps/api/src/services/catalog-sync-service.ts` | Call `ChannelSyncService.syncLiveChannels` after movie/series sync; add `channelsCreated/Updated` to result counts |
| `apps/api/src/routes/channels.ts` | Full `GET /channels` + `GET /channels/:id/stream` implementation |
| `packages/api-contracts/src/channels.ts` | Replace `category?: string` with `categories: string[]`; add `ChannelStreamResponse` |
| `e2e/fixtures/m3u-server.ts` | Add `'live-channels'` mode (5 entries: 3 TF1 variants + France 2 + France 3) |
| `e2e/global-setup.ts` | Start `m3uLiveChannels` server on port 9991 |
| `e2e/fixtures/index.ts` | Add `m3uLiveChannels` to `FakeServers` type |
| `apps/api/src/providers/m3u/__tests__/parser.test.ts` | Update existing test: CNN International now correctly classifies as `'live'` not `'unclassified'` |
