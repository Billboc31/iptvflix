# T018 — Add profile playback preferences and deterministic best-availability selection

**Source**: GitHub Issue #35

## Description

## Objective

Allow IPTVFlix to select the best available version of a Movie/Episode for the current profile using explicit language, subtitle, quality and source preferences while still allowing manual variant choice.

## Context / Problem

Once one canonical work can have several Xtream/Plex/language/quality variants, the UI should not force users to inspect every provider entry. The default Play action needs a deterministic, explainable resolver based on profile preferences. UI locale must not be treated as identical to playback-language preference.

## Included

- Add profile-level playback preferences for preferred audio languages, subtitle languages, source priority and quality capabilities/preferences where appropriate.
- Keep UI locale separate from playback-language preferences.
- Implement a backend/domain availability resolver that ranks currently usable variants deterministically.
- Prefer explicit evidence; variants with unknown metadata remain candidates/fallbacks rather than being silently discarded.
- Return the selected/default availability plus alternative variants and enough reason/provenance for UI explanation/debugging.
- Add web settings controls for these preferences and variant selection on media details where multiple variants exist.
- Ensure frontend clients do not independently reimplement ranking rules.

## Acceptance Criteria

- [ ] A French UI can be configured to prefer English audio + French subtitles, proving UI locale and playback preferences are independent.
- [ ] A profile can express ordered audio-language preferences and source priority.
- [ ] The backend deterministically selects one preferred availability when multiple usable variants exist.
- [ ] Higher quality does not automatically override an explicitly higher-priority language/source preference unless the documented ranking rules say so.
- [ ] Alternative variants remain accessible to the user.
- [ ] Unknown metadata has deterministic fallback behavior.
- [ ] Unavailable/stale variants cannot be selected as the preferred playable availability.
- [ ] Automated tests cover language, subtitle, quality, source-priority, unknown metadata and no-availability cases.

## Excluded / Out of scope

- Actual video playback.
- Automatic bandwidth measurement/adaptive streaming.
- Per-device preference synchronization beyond the existing profile model.

## Dependencies

Requires normalized variants from #34 and builds on the profile foundation introduced by the watchlist/history work.
