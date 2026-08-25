I have everything needed. Here is the test report.

---

## Test Report — T131 — Canonicalize and Deduplicate Live TV Channels

### Test Execution Summary

| Suite | Tests | Result | Notes |
|---|---|---|---|
| `channel-normalizer.test.ts` | 28 | ✅ All pass | Pure unit tests |
| `category-mapper.test.ts` | (included above) | ✅ All pass | Pure unit tests |
| `parser.test.ts` (M3U) | 20 | ✅ All pass | Pure unit tests |
| `client.test.ts` (M3U) | 12 | ✅ All pass | HTTP mock-based |
| `channel-sync-service.test.ts` | 12 | ⚠️ All skipped | Requires PostgreSQL on :5433 — not available in this environment |
| TypeScript typecheck | — | ❌ 3 errors | `c.category` does not exist on `ChannelResponse` |

---

### Acceptance Criteria

#### AC 1 — Live TV ingestion produces canonical channels with multiple underlying sources where duplicates are confidently identified.
**Status: CONDITIONAL PASS**

`ChannelSyncService.syncLiveChannels()` implements confidence-based matching (tvg-id contributes 0.6, normalized name contributes 0.4, threshold 0.75). The DB schema (`channels` + `channel_sources`) supports the one-to-many model correctly. Tests covering this exist and are complete — they are skipped only because PostgreSQL is not running in this environment, not due to a code defect.

#### AC 2 — Common naming variants (provider prefixes, quality suffixes) do not create obvious duplicate cards.
**Status: PASS**

`normalizeChannelName()` correctly strips `FR |`, `[XX]`, `XX-YY-ZZ` prefixes and `HD`, `FHD`, `4K`, `UHD`, `1080p` suffixes. All 14 normalization tests pass.

#### AC 3 — Ambiguous channels are not aggressively merged.
**Status: CONDITIONAL PASS**

The confidence threshold (0.75) requires both tvg-id AND normalized name to match. A name-only match scores only 0.4 — below threshold. Tests for non-merge and ambiguous scenarios exist. Skipped due to no DB.

#### AC 4 — Canonical channel exposes a clean display name and logo/fallback.
**Status: PARTIAL FAIL**

The backend `toCanonicalDisplayName()` works correctly (3/3 tests pass). The logo fallback (first initial letter) is implemented in both UI pages. However, the category field is broken at the UI layer (see blocking issue below), which is part of the channel card presentation.

#### AC 5 — Favorites/history/EPG-ready identity is designed at canonical channel level.
**Status: PARTIAL**

The `tvg_id` column on the `channels` table provides an EPG anchor point. No favorites or history schema was introduced for canonical channels. The AC states "designed at canonical channel level" — the tvg-id hook is there, but there is no favorites/history model. This is a gap but the AC wording is ambiguous.

#### AC 6 — A reusable source-selection function/service chooses the preferred stream and supports fallback ordering.
**Status: PASS**

`selectPreferredSources()` in `source-selector.ts` sorts by status (AVAILABLE first) → priority (descending) → lastSeenAt (descending). `GET /channels/:id/stream` calls it and returns the top result. The fallback ordering is correct.

#### AC 7 — API contracts expose canonical channels, not raw duplicate streams, to the Live TV frontend.
**Status: FAIL — Blocked by type mismatch**

The API contract is correct: `ChannelResponse = { id, name, logoUrl, categories: string[] }`. However, the Live TV frontend misuses it — it accesses the non-existent `channel.category` (singular) in both pages. This is a contract violation at the consumer layer.

#### AC 8 — Automated tests covering normalization, confident duplicates, ambiguous non-merges, multiple providers, logo selection and source ordering.
**Status: PASS (conditioned on DB availability)**

All specified test scenarios are implemented: 28 normalizer/category tests pass, 12 integration tests for deduplication/idempotence/lifecycle/logo exist (skip-only due to infrastructure, not code failure).

#### AC 9 — No channel-specific hardcoding.
**Status: PASS**

Normalization uses generic regex patterns. Category mapping uses keyword lists. No channel names are hardcoded.

#### AC 10 — No manual production DB edits.
**Status: PASS**

Migration `0053_t131_live_tv_channels.sql` covers the schema changes.

---

### Blocking Issues

#### BUG-1 — `c.category` does not exist on `ChannelResponse` (TS2339) — BLOCKING

**Files affected:**
- `apps/live-tv/src/pages/AllChannelsPage.tsx:16` — `channels.map((c) => c.category)` — `category` is undefined on every channel; the category filter bar will always be empty, rendering the entire filter UI non-functional.
- `apps/live-tv/src/pages/HomePage.tsx:68-69` — `channel.category &&` and `{channel.category}` — the category badge in every `ChannelCard` will never render.

**Root cause:** The API contract defines `categories: string[]` (plural array). Both pages access the non-existent singular `category` field. TypeScript reports 3 compilation errors; `pnpm typecheck` exits non-zero.

**Expected fix:**
```typescript
// AllChannelsPage.tsx:16
const categories = [...new Set(channels.flatMap((c) => c.categories).filter(Boolean))]

// HomePage.tsx:68-69 — show first category or nothing
{channel.categories?.[0] && (
  <span ...>{channel.categories[0]}</span>
)}
```

---

### Non-Blocking Observations

- **Category filter buttons have no click handler** — the pills render (once the type bug is fixed) but clicking does nothing. Not part of the AC but a visible UX gap.
- **Integration tests require a running PostgreSQL** — the 12 DB-dependent tests are sound in code but need infra to execute. CI must provide a test database.
- **No favorites/history schema** — the AC says "designed at canonical channel level"; `tvg_id` is there but no favorites table exists.

---

### Verdict

**FAIL — 1 blocking issue.**

The implementation is architecturally sound: domain model, deduplication pipeline, source selector, and API contract are all correct. All pure unit tests (60) pass. The blocking failure is a type mismatch in the Live TV frontend (`c.category` vs `c.categories`) that breaks the category UI in both pages and causes `pnpm typecheck` to exit with errors. This must be fixed before the ticket can be marked done.
