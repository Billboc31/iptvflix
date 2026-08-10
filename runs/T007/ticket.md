# T007 — Build Netflix-inspired web experience from validated UI reference board

**Source**: GitHub Issue #9

## Description

## Objective

Deliver the first IPTVFlix web experience using the validated UI reference board as the primary visual specification. The implementation must establish the reusable frontend foundation that all future features will build upon.

## Context / Problem

The UI/UX direction has already been validated. AI Dev Factory should not invent the user experience.

The implementation must follow the reference board located at:

`docs/design/iptvflix-ui-reference-board.png`

The board defines the visual hierarchy, navigation, colors, spacing, layout philosophy and the main application screens.

The objective of this ticket is NOT to reproduce every future feature but to build a reusable Netflix-inspired frontend foundation faithful to the approved design.

## UI Reference

The reference board contains the following screens:

- Home
- Movie Catalog
- Series Catalog
- Movie Details
- Cinema Radar
- Search
- IPTV Source Configuration
- Onboarding
- Android TV Home (future reference)

These mockups are the primary visual reference for this ticket.

## Included

- Implement the global application shell.
- Left navigation.
- Top navigation/search area where applicable.
- Dark visual theme.
- Reusable layout system.
- Reusable cards.
- Reusable carousel/rows.
- Buttons, dialogs, forms and loading states.
- Responsive desktop web layout.
- IPTV Source configuration screens.
- Catalog browsing screens for Movies and Series.
- Synchronization status screens.
- Empty, loading and error states.
- Consume only the canonical backend API. Provider DTOs must never leak into the UI.

## Acceptance Criteria

- [ ] The implementation is visually consistent with the validated design board.
- [ ] Global navigation matches the approved UX.
- [ ] Shared UI components are reusable.
- [ ] Movies and Series use reusable poster grids and horizontal rows.
- [ ] IPTV source configuration follows the reference design.
- [ ] Synchronization workflow integrates naturally into the UI.
- [ ] Loading, empty and error states are polished.
- [ ] Frontend consumes only canonical API contracts.
- [ ] No Xtream-specific models appear inside UI components.
- [ ] Frontend tests cover the main user flows.

## Excluded

- Recommendation engine.
- Metadata enrichment.
- Netflix import.
- Cinema radar logic.
- Playback.
- Android TV implementation.

## Dependencies

Requires the canonical catalog synchronization pipeline (#7).

This ticket supersedes the original UI ticket by providing a much more detailed UX specification.
