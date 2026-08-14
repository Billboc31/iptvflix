# T077 — Fix Xtream VOD playback URL resolution for movies and episodes

**Source**: GitHub Issue #162

## Description

## Problem
Clicking `Regarder` currently resolves a playback session but media does not actually play.

The existing playback resolver has a concrete correctness issue for Xtream VOD:

- `buildXtreamStreamUrl()` currently always builds `/{username}/{password}/{providerItemId}.ts`.
- Movie and episode availability rows already persist `container_extension`, but `playback-resolver.ts` does not select/use it.
- Movie and episode playback need provider-specific VOD path construction rather than assuming the same path/extension for every media type.

This ticket fixes provider-side playback URL resolution first, before adding browser/player workarounds.

## Goal
Make `POST /playback/resolve/:mediaType/:mediaId` return a valid, testable Xtream playback target for canonical Movies and Episodes using the selected availability metadata.

## Requirements

### 1. Media-type-aware Xtream URL building
Build the correct Xtream VOD URL according to media type/provider semantics.

The resolver MUST distinguish:
- movie VOD;
- series episode VOD;
- future live TV (do not incorrectly reuse VOD path logic).

Do not hardcode one generic `/{user}/{pass}/{id}.ts` URL for all content.

The Planner must inspect the existing Xtream client responses and provider conventions already used by IPTVFlix and implement the correct path structure for Movies vs Episodes.

### 2. Use persisted container extension
`movie_availabilities` and `episode_availabilities` already have `container_extension`.

Include this field in playback resolution and use it when constructing the provider URL.

Examples may include `mkv`, `mp4`, `avi`, `ts`, etc. Do not silently force `.ts` when the provider exposes another extension.

If extension is absent, use a deliberate provider-specific fallback and make that fallback observable/tested.

### 3. Availability selection remains canonical
Keep the current canonical model:
- Movie/Episode identity stays canonical;
- selected availability determines provider/source/language/quality/playback reference;
- explicit availability selection must work;
- automatic variant resolution must still honor profile preferences.

### 4. Validate provider item IDs
Ensure the selected `provider_item_id` is actually the VOD/episode stream identifier expected by the Xtream endpoint, not a series/catalog id.

For Episodes, verify sync/backfill persists the correct Xtream episode stream id.

### 5. Source URL/base URL normalization
Handle provider base URLs robustly:
- trailing slash;
- http/https;
- ports;
- already-normalized base URLs.

Do not double-add path segments.

### 6. Diagnostics without leaking credentials
When playback URL construction or provider access fails, logs should identify:
- source id/type;
- media type/id;
- availability id;
- provider item id;
- container extension;
- HTTP/result category when probed.

Never log username/password or full credential-bearing playback URLs.

### 7. Test real URL construction behavior
Add unit/integration tests for at least:
- Movie Xtream URL with mp4 extension;
- Movie Xtream URL with mkv extension;
- Episode Xtream URL with provider episode id;
- missing extension fallback;
- explicit availability selection;
- disabled source / unavailable variant;
- malformed provider data.

## Acceptance criteria
- [ ] Movie playback resolver uses Movie-specific Xtream VOD URL semantics.
- [ ] Episode playback resolver uses Episode-specific Xtream VOD URL semantics.
- [ ] Persisted `container_extension` is read and used.
- [ ] Playback no longer forces `.ts` for every Xtream VOD item.
- [ ] Episode playback uses the actual episode stream/provider item id.
- [ ] Existing language/quality variant selection still works.
- [ ] Invalid/unavailable variants produce actionable errors.
- [ ] Logs do not expose Xtream credentials.
- [ ] Automated tests prove generated playback targets for Movies and Episodes.

## Current code evidence
`apps/api/src/providers/xtream/playback.ts` currently builds a generic `/{username}/{password}/{providerItemId}.ts` URL, while `apps/api/src/db/schema/availabilities.ts` already stores `container_extension`. `apps/api/src/services/playback-resolver.ts` currently ignores that field.
