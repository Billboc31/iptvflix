T018 is fully implemented and committed. Here's what's in place:

**Backend**
- `profiles` table extended with 4 preference columns (`preferred_audio_languages`, `preferred_subtitle_languages`, `preferred_source_ids`, `max_video_quality`) — migration 0012 applied
- `availability-resolver.ts` — deterministic 5-tuple scorer (audio → subtitle → source → quality-capped → id tiebreak), 16 unit tests
- `GET /profile` and `PATCH /profile/preferences` routes
- `/movies/:id`, `/series/:id`, and episode list routes now resolve best variant via profile prefs and return `selectedVariantId`

**Contracts**
- `AvailabilityVariantResponse` extended with `status` and `providerId`
- `MovieDetailResponse`, `SeriesDetailResponse`, `EpisodeResponse` extended with `selectedVariantId`
- New `profile.ts` with `ProfilePreferences`, `ProfileResponse`, `UpdateProfilePreferencesBody`

**Frontend**
- `ProfileSettingsPage` at `/settings/playback` — language preference lists with add/remove/reorder, quality cap dropdown
- Variant selector UI in `MovieDetailPage` and `SeriesDetailPage` — highlights selected variant with a red ring, grays out unavailable ones
- Nav item "Préférences lecture" in left nav

335 tests, 28 files, all passing.
