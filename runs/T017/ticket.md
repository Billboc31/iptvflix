# T017 — Normalize media availability variants by language, subtitles and quality

**Source**: GitHub Issue #34

## Description

## Objective

Represent multiple provider entries for the same canonical work as distinct playback availabilities/variants with normalized language and quality attributes, so the catalog presents one work instead of duplicate cards.

## Context / Problem

A provider may expose the same film/episode several times, for example `FRENCH`, `TRUEFRENCH`, `MULTI`, `VOSTFR`, `1080p`, `2160p`, HDR or other release tags. These are not separate works. IPTVFlix must preserve each usable stream while grouping them under one canonical Media identity.

## Included

- Extend the existing title normalization/matching output to extract availability-specific attributes without destroying `rawTitle`.
- Normalize audio language hints to standard language codes where evidence is reliable (for example FR/FRENCH/TRUEFRENCH → French audio semantics, ENG/ENGLISH → English; MULTI must not be treated as a specific single language unless actual language data proves it).
- Normalize subtitle hints such as VOSTFR separately from audio language.
- Normalize useful video-quality/version hints such as 720p/1080p/2160p/4K and HDR/Dolby Vision where reliably derivable.
- Keep uncertain/unknown attributes explicit rather than guessing.
- Associate all matched variants with the same canonical Movie/Episode.
- Expose variants through canonical detail/API contracts while catalog/list responses remain deduplicated by canonical Media.
- Preserve source identity and provider item identity for every variant.

## Acceptance Criteria

- [ ] Multiple provider entries matched to the same work produce one canonical catalog item with multiple availabilities/variants.
- [ ] Raw provider titles remain preserved for diagnostics/reprocessing.
- [ ] Audio language, subtitle language and video quality are distinct normalized attributes.
- [ ] `VOSTFR` is not incorrectly represented as French audio.
- [ ] `MULTI` is represented without falsely asserting languages that are not known.
- [ ] Unknown/ambiguous language or quality data remains unknown rather than being guessed.
- [ ] Catalog cards/search results are not duplicated merely because language or quality differs.
- [ ] Detail API can expose all usable variants for manual selection.
- [ ] Tests cover common French/English/MULTI/VOSTFR markers, quality markers, ambiguous tags and duplicate-work variants.

## Excluded / Out of scope

- Choosing the user's preferred variant automatically.
- Media player implementation.
- Audio/subtitle probing of stream bytes unless already available cheaply from provider metadata.
- Replacing canonical matching logic from Batch 2.

## Dependencies

Builds on #33 and the existing T011 title normalization/canonical matching pipeline.
