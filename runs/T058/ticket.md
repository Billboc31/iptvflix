# T058 — Redesign mobile navigation and Shelf browsing for a true phone-first experience

**Source**: GitHub Issue #119

## Description

## Objective

Make IPTVFlix feel intentionally designed for mobile instead of a compressed desktop layout, with special attention to Home and Shelf browsing where the current permanent left navigation consumes too much screen width.

## Context / Problem

The current responsive Web layout keeps the desktop left navigation visible on phones. This significantly reduces usable width and makes horizontal Shelf browsing feel cramped. Mobile is also a primary control surface for discovery and `Play on TV`, so Home, Shelves, details and handoff actions should be optimized for touch and narrow screens.

## Included

- Replace the permanent left sidebar on narrow/mobile viewports with a mobile-specific navigation pattern.
- Prefer a compact bottom navigation for the highest-frequency destinations (for example Home, Search, My List/Library, Activity and Profile) and provide access to secondary destinations such as Sources, Devices and Settings without crowding the primary nav.
- Preserve the existing desktop/tablet-large left navigation behavior.
- Make Home and Shelf browsing the primary responsive focus:
  - Shelves must use the full available viewport width on mobile;
  - horizontal rows should support natural touch/swipe scrolling;
  - remove desktop-only arrow controls where they reduce usable space or duplicate native touch scrolling;
  - choose mobile-appropriate poster/card widths so enough of the next card remains visible to communicate horizontal scrollability;
  - use consistent horizontal edge padding without wasting screen width;
  - prevent card titles, badges, preview controls or progress indicators from forcing row overflow/layout jumps;
  - maintain smooth scrolling with long recommendation-backed Shelf lists;
  - avoid accidental autoplay preview activation during ordinary touch scrolling.
- Ensure the Home hero scales cleanly on narrow screens: readable title/metadata, sensible image crop, actions that do not overflow, and no desktop sidebar offset.
- Review Movie/Series details for mobile ergonomics, especially Play/Resume, `Play on TV`, My List, Follow, trailers and availability/variant controls.
- Make `Play on TV` practical from a phone: actions must remain reachable without tiny targets or horizontal overflow.
- Ensure Season/Episode browsing is touch-friendly and does not inherit desktop-width assumptions.
- Respect device safe areas (bottom/home indicator and notches) for mobile navigation and fixed controls.
- Keep accessibility basics: minimum practical touch targets, keyboard behavior on larger layouts, visible focus states where applicable, and no content hidden behind fixed navigation.
- Add representative responsive tests for narrow phone widths and a larger mobile/tablet breakpoint.

## Acceptance Criteria

- [ ] On phone-sized viewports the permanent left sidebar is not visible and does not reserve horizontal space.
- [ ] Primary mobile navigation is reachable with one hand and does not cover page content.
- [ ] Desktop/large-screen navigation remains unchanged or equivalently usable.
- [ ] Home Shelves occupy the full mobile content width and scroll horizontally with native touch gestures.
- [ ] Shelf cards have intentional mobile sizing and visible continuation/peek behavior rather than looking like a squeezed desktop row.
- [ ] Scrolling a Shelf does not accidentally trigger autoplay previews.
- [ ] Multiple/long Shelves render without horizontal page overflow or broken spacing.
- [ ] Hero content and actions fit common phone widths without clipping.
- [ ] Movie/Series detail primary actions, including `Play on TV`, remain easy to reach and use on mobile.
- [ ] Season/Episode lists are readable and touch-friendly on narrow screens.
- [ ] Fixed bottom navigation respects safe-area insets and does not hide content.
- [ ] Automated frontend tests cover mobile navigation visibility, Shelf scrolling/layout, hero/action layout and representative detail/device-handoff behavior.

## Excluded / Out of scope

- Native iOS/Android phone apps.
- Redesigning the desktop visual identity.
- Replacing the existing Shelf/recommendation data model.
- New product features unrelated to responsive/mobile UX.

## Dependencies

Builds on the current Home/Shelf, autoplay-preview, rich-detail and `Play on TV` Web features. This is a focused responsive UX improvement and should preserve their existing backend contracts.
