# IPTVFlix — UI/UX Reference

This folder contains the visual references used by AI Dev Factory when planning and implementing IPTVFlix frontend work.

## Product direction

IPTVFlix should feel like a modern premium streaming application, optimized for fast content discovery rather than like a traditional IPTV playlist browser.

The visual direction is dark, cinematic, image-led, and inspired by familiar streaming UX patterns while keeping IPTVFlix-specific product concepts prominent.

## Core navigation

Primary destinations should anticipate the following areas:

- Home
- Movies
- Series
- Cinema Radar
- My List
- History / Continue Watching
- Search / Discover
- Settings / IPTV Sources

The web application should establish reusable navigation and layout conventions that can later be adapted to Android TV.

## Home reference

The Home screen should support:

- A large cinematic hero area with primary playback/details actions.
- `For you` recommendations.
- Recently added IPTV content.
- Movies from the user's cinema radar that have become available.
- Continue watching.
- Recommendations derived from previously watched or liked content.
- Curated rows without excessive duplication of the same titles.

## Catalog reference

Movies and Series catalog screens should prioritize posters, fast scanning, and useful filtering. The domain data displayed by the UI must come from IPTVFlix canonical catalog contracts rather than provider-specific Xtream or M3U payloads.

## Media detail reference

Movie/series details should be designed around a cinematic backdrop and include the information needed for a decision to watch: title, synopsis, year, runtime, genres, quality/availability information, actions, external metadata, and related recommendations where available.

## Cinema Radar reference

Cinema Radar is a first-class IPTVFlix concept. It should make it easy to distinguish:

- films the user explicitly wants to see;
- films automatically monitored because they match the user's taste profile;
- monitored films that have just appeared in the IPTV catalog.

Availability changes should be visually obvious and later support notifications.

## IPTV source configuration reference

Source configuration must feel like application settings, not a raw technical admin screen. Xtream Codes is the first complete source flow; M3U is planned as another adapter. Credentials must never be exposed again in clear text after storage.

## Visual style

- Dark cinematic background.
- Strong poster/backdrop imagery.
- High contrast typography.
- Restrained accent colors for primary actions, status, ratings, and radar availability.
- Spacious layouts and horizontal streaming-style content rows where appropriate.
- Components should be reusable rather than page-specific one-offs.
- Do not reproduce Netflix branding or create a pixel-for-pixel clone; use familiar streaming UX patterns with an IPTVFlix identity.

## Planned visual reference files

The following mockups are intended to live alongside this document:

- `home.png`
- `movies.png`
- `movie-detail.png`
- `series.png`
- `cinema-radar.png`
- `search-discover.png`
- `iptv-settings.png`
- `onboarding.png`
- `android-tv-home.png`

Frontend issues should reference the relevant design file(s) once available. Visual references define desired UX and hierarchy; they do not override security, accessibility, architecture, responsive behavior, or acceptance criteria.
