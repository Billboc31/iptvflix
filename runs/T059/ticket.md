# T059 — Redesign web browsing with top navigation, immersive hero and shelf-first media pages

**Source**: GitHub Issue #121

## Description

## Objective

Redesign the IPTVFlix web browsing experience into a premium streaming-style interface centered on a horizontal top navigation, an immersive featured-media Hero, compact contextual controls and shelf-first discovery pages for Movies and Series.

## Visual reference

Use the repository reference image as the primary structural inspiration for this ticket:

![Streaming Movies page UX reference](../blob/main/docs/design/reference-streaming-movies-page.jpg?raw=1)

Repository path: `docs/design/reference-streaming-movies-page.jpg`

The reference is for **layout, hierarchy and interaction inspiration only**. Do not reproduce Netflix branding, logos, proprietary assets or pixel-copy its visual design. The resulting UI must retain IPTVFlix's own identity and use assets/metadata available to the project.

## Context / Problem

The current web UI relies too heavily on a left-side navigation and does not yet create the immersive browsing experience expected from a modern streaming product. IPTVFlix is evolving from an IPTV browser into a universal media discovery experience, so the UI should emphasize content first and source/provider mechanics second.

The desired UX structure is: persistent horizontal navigation at the top, search/profile actions on the right, a large cinematic featured-media area, a compact genre selector, and horizontal media shelves immediately below the Hero.

## Included

### Global navigation

- Replace the primary left sidebar navigation on the main browsing experience with a responsive horizontal top navigation.
- Provide clear primary destinations such as Home, Movies, Series, My List and relevant IPTVFlix discovery/tracking destinations already supported by the product.
- Keep search and profile/account actions accessible on the right side of the header on desktop layouts.
- Preserve responsive behavior for narrower screens without forcing the desktop navigation model onto mobile-sized layouts.

### Movies and Series browsing pages

- Make Movies and Series first-class immersive browsing pages rather than simple catalog/grid views.
- Display the page context (`Movies` / `Series`) with a compact genre/filter selector rather than a large permanent filtering panel.
- Use the shared Shelf model when available for the primary content sections instead of introducing page-specific hard-coded row implementations.
- Allow multiple horizontal shelves to follow naturally below the Hero.

### Immersive featured-media Hero

- Add a large featured-media Hero at the top of Movies and Series browsing pages.
- Use canonical Media metadata/backdrop artwork rather than provider-specific catalog objects.
- Present useful information such as title/logo when available, short synopsis and relevant metadata without overwhelming the artwork.
- Provide primary actions appropriate to the Media state, such as Play when a playable availability exists and More Info for the canonical detail page.
- Gracefully handle Media with no playable availability; the Hero must not imply that unavailable content can be played.
- Design the Hero contract so the featured Media can later be selected by personalization/recommendation logic rather than permanently hard-coded.
- Ensure text remains readable across varied backdrop images through appropriate contrast/gradient treatment.

### Shelf-first composition

- Reuse a common shelf/row presentation for sections beneath the Hero.
- Support different shelf content without creating bespoke page components for every category.
- The UI must be capable of rendering future automatic shelves such as `For You`, `Recently added to your sources`, `Because you liked…`, `Recently released`, `Available in French`, `Under 2 hours`, `New on Plex`, or `Now available from your radar` when those backend capabilities exist.
- This ticket does **not** require implementing the future recommendation/ranking engine merely to populate those examples.

### IPTVFlix identity

- Keep the visual direction cinematic, dark and content-focused while maintaining an original IPTVFlix design system.
- Provider/source information should remain secondary to the canonical Media experience unless it is relevant to playback or availability.

## Acceptance Criteria

- [ ] Desktop browsing no longer depends on the current left sidebar for primary navigation.
- [ ] A persistent top navigation provides the main product destinations, search and profile/account access.
- [ ] Movies has an immersive Hero followed by horizontal Media shelves.
- [ ] Series has the same coherent browsing structure adapted to Series content.
- [ ] Movies/Series expose a compact genre/filter control without requiring a large filter sidebar.
- [ ] The Hero uses canonical Media data and supports Play only when an appropriate playable availability exists.
- [ ] The Hero remains useful for unavailable Media through detail/tracking-oriented actions rather than fake playback.
- [ ] Shelf rows use/reuse the common Shelf composition model when #38 is available instead of duplicating shelf business logic in the frontend.
- [ ] Layout remains usable across common desktop/tablet viewport sizes and has a defined responsive fallback for narrow screens.
- [ ] Backdrop/text contrast remains readable for different artwork.
- [ ] Existing Home, Movies, Series, Search, My List/watchlist and detail navigation remain reachable after the redesign.
- [ ] Automated frontend tests cover navigation, Hero availability states, shelf rendering and responsive-critical behavior where practical.
- [ ] The implementation does not copy Netflix logos, branding or proprietary visual assets.

## Excluded / Out of scope

- Building the recommendation/taste engine.
- Automatic personalized shelf generation/ranking beyond data already available from the backend.
- Video player implementation.
- Reproducing Netflix pixel-for-pixel.
- Android TV redesign; this ticket establishes the web browsing direction first.

## Dependencies

- Integrate with #38 (`Shelf`) when its shared shelf contract/composition layer is available.
- The top-navigation and Hero shell can be implemented independently where reasonable; do not introduce an artificial dependency on recommendation features.
- Consume the canonical Media/Availability contracts from the current domain evolution rather than introducing IPTV-specific UI models.
