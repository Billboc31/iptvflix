# T073 — Unify mobile navigation with desktop top navigation and search

**Source**: GitHub Issue #151

## Description

## Goal
Make IPTVFlix mobile navigation use the same information architecture as desktop instead of a separate bottom-tab experience.

The primary destinations must remain consistent across devices:

- Accueil
- Films
- Séries
- Ma Liste
- Nouveautés

Search must also be available from the TOP of the mobile interface.

## Requirements

### Mobile top navigation
Replace the current mobile bottom-navigation-first approach with a responsive top header/navigation derived from the desktop `TopNav` direction introduced by T059.

The mobile header must provide access to all five primary destinations above. Choose the cleanest responsive presentation for narrow screens: horizontally scrollable navigation, compact/expandable navigation, or another polished pattern. Do not silently remove destinations just because the viewport is narrow.

### Search at the top
Search must be clearly accessible in the top header area, not in a bottom navigation bar. Prefer a compact search field or expandable search control appropriate to the viewport. Existing search behavior/results should be reused.

### Remove duplicate bottom navigation
Once the responsive top navigation provides the required destinations, `BottomNav` must no longer be the primary navigation. Avoid duplicate top + bottom navigation competing for the same destinations.

### Desktop consistency
Do not regress the current desktop top navigation. Desktop and mobile should share navigation concepts and, where sensible, shared components/configuration so labels/routes do not drift independently.

### Settings/admin access
Preserve the settings/admin entry point introduced/restored by the new navigation work, including discoverable access to Sources and existing settings routes. It may be represented compactly on mobile but must not disappear.

### Interaction and responsive behavior
- Active destination should be visually identifiable.
- Navigation must remain usable on small phones without horizontal page overflow.
- Touch targets must be appropriate.
- Header/search should not obscure content.
- Handle long labels/localization gracefully.
- Tablet should transition naturally between compact and desktop layouts.
- Keyboard/accessibility behavior must remain correct where relevant.

### Media-detail compatibility
This navigation work must be compatible with the immersive media-detail issue. When a Movie/Series full-screen detail layer is open on mobile, that detail owns the screen and exposes its own `×` close control. Closing it restores the underlying page/header and previous scroll position.

## Acceptance criteria
- [ ] Mobile exposes Accueil, Films, Séries, Ma Liste and Nouveautés through top navigation.
- [ ] Search is accessible from the top mobile header.
- [ ] Mobile no longer relies on a bottom navigation bar as its primary navigation.
- [ ] Duplicate competing top/bottom navigation is removed.
- [ ] Desktop top navigation is not regressed.
- [ ] Desktop and mobile use the same route/information architecture.
- [ ] Active navigation state works.
- [ ] Settings/admin/Sources remain discoverable on mobile.
- [ ] Small-phone layouts do not create page-level horizontal overflow.
- [ ] Tablet layouts adapt cleanly.
- [ ] Existing routes/search behavior continue to work.
- [ ] Relevant responsive/navigation tests are added or updated.

## UX direction
The goal is one coherent IPTVFlix navigation model across desktop and mobile. Mobile may condense the presentation, but it should not feel like a different application with a different bottom-tab information architecture.
