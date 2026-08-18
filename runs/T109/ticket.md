# T109 — Fix series episode-level source selection and playback end-to-end

**Source**: GitHub Issue #230

## Description

## Problem

Series pages currently expose seasons/episodes, but the user still cannot reliably choose and play the actual available source(s) for a specific episode.

This must be treated as an end-to-end functional playback issue, not merely a UI task. The implementation should reuse the existing canonical Media / Episode / Availability / playback resolver architecture rather than inventing a separate series playback path.

## Expected UX

On a series detail page:

1. User selects a season.
2. User sees the episodes for that season.
3. Each episode clearly indicates whether it is playable.
4. Selecting/clicking an episode exposes the availabilities belonging to **that exact episode**.
5. If there is one usable source, playback can start directly.
6. If there are several sources, user can choose between them using useful human-readable information such as language, quality/resolution, provider/source and other preserved metadata — never opaque UUIDs as the primary label.
7. Pressing Play launches the selected episode through the same playback resolution/proxy/transcoding pipeline used for working movie playback.
8. Playback progress is stored against the specific episode and active profile, not only against the parent series.
9. Returning to the series must show the correct episode progress / watched state.

## Required investigation

Trace the complete data path for a real imported series episode:

`Series -> Season -> Episode -> Availability -> selected source -> playback resolver -> playable URL -> player`

Verify where the chain currently breaks instead of assuming that existing episode/availability code is functional.

Check in particular:

- episode IDs are canonical and stable;
- imported Xtream/M3U episode entries are actually attached to the correct Episode entity;
- episode availability queries filter by the episode ID rather than the parent series ID;
- multiple sources for the same episode remain distinct availabilities;
- original source metadata useful to the user is preserved during normalization/import;
- source labels do not fall back to UUIDs when better metadata exists;
- selected episode availability reaches the playback resolver unchanged;
- auth/proxy headers and source credentials work for episode streams exactly as for movies;
- web player receives a valid resolved stream;
- Android playback API contract remains compatible;
- unavailable episodes do not show a misleading Play action.

## UI requirements

Episode rows/cards should expose at minimum:

- episode number and title;
- runtime when known;
- watched/progress state;
- availability/playability state;
- Play/Resume action when playable;
- source/variant selector when multiple availabilities exist.

Variant labels should prefer useful data such as `FR • 1080p • IPTV provider/source` rather than UUIDs.

Do not overload the UI when only one source exists.

## Resume behavior

Integrate with the existing Continue Watching / resume work rather than creating another progress system.

For an episode with saved progress, the normal playback flow must support the existing intended Resume vs Start from beginning behavior. Progress must be isolated per profile and per episode.

## Acceptance criteria

This issue is **not complete merely because unit tests pass**.

Validate manually/end-to-end with at least one real imported series that has multiple episodes and real IPTV availability:

- [ ] open series detail
- [ ] select season
- [ ] select a specific episode
- [ ] see availability for that exact episode
- [ ] if multiple sources exist, choose a specific source using readable labels
- [ ] start playback successfully
- [ ] verify the selected episode — not another episode or parent series — is played
- [ ] seek/watch long enough to persist progress
- [ ] exit playback
- [ ] reopen series and verify progress on the correct episode
- [ ] resume the episode successfully
- [ ] play a different episode and verify state remains independent
- [ ] verify an unavailable episode is represented correctly

Add regression/integration tests around episode availability lookup and playback resolution, but retain the real end-to-end validation above as a completion requirement.

## Non-goals

Do not redesign the whole series model, recommendation engine, or Continue Watching system in this ticket. Fix and complete the existing episode-level playback chain.
