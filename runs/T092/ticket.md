# T092 — Make Series episodes directly playable with per-episode availability/source selection

**Source**: GitHub Issue #192

## Description

## Context
Series detail pages now correctly show seasons and episodes, but an episode cannot reliably be chosen and played according to its actual available Xtream/Plex sources.

Catalog structure and playback need to be connected at EPISODE level, not only Series level.

## Goal
From a Series detail page, the user must be able to select a season, see its episodes, and play a specific episode using that episode's own availability variants.

## Required behavior
For each episode:
- show episode number/title/overview/artwork where available;
- determine whether it has 0, 1 or N playable availabilities;
- show `Lecture` when at least one playable availability exists;
- hide/disable play clearly when no source exists;
- allow source/quality/language selection when multiple availabilities exist;
- default intelligently to the best/preferred availability;
- pass the episode canonical ID + selected availability into the existing playback resolver/player;
- save progress against that exact episode;
- next/previous episode must resolve availability for the destination episode, not reuse the previous stream accidentally.

## Multi-source example
```text
S01E03 — Episode title

Disponible :
✓ Français • 1080p • Source A
  Français • 720p • Source B
  VO • 4K • Source C

▶ Lecture
```

The UI should stay compact; source choice can be in a menu/dropdown rather than cluttering every episode card.

## Canonical model
Keep Series/Season/Episode canonical TMDB entities independent from provider streams.

Episode availability must join canonical episode -> provider/source variant. Do not create duplicate episodes per source.

If an Xtream source has episode metadata that failed to attach to the canonical episode, investigate/fix that mapping rather than falling back to series-level availability.

## Acceptance criteria
- [ ] User can pick a season and a specific episode.
- [ ] Each episode independently knows whether it is playable.
- [ ] `Lecture` on SxxExx launches that exact episode.
- [ ] Multiple source/quality/language variants can be selected for one episode.
- [ ] Best/preferred source is selected by default.
- [ ] Episodes without source remain visible but are not falsely playable.
- [ ] Progress/resume is stored per episode.
- [ ] Next episode resolves the correct next episode availability.
- [ ] No duplicate episode cards are created because of multiple providers.
- [ ] Tested with a real Series containing several seasons and real Xtream episode availabilities.

## Completion rule
Do not close because seasons/episodes merely render. Manually click `Lecture` on at least two different real episodes and prove the correct streams open.
