# T093 — Preserve and display useful provider variant labels instead of UUID source names

**Source**: GitHub Issue #193

## Description

## Context
When a Movie or Episode has multiple playable variants/sources, the UI can currently show UUID-like identifiers instead of useful human-readable information. This makes source selection confusing.

The raw provider title often contains valuable variant information such as language, quality, codec/release tags or provider naming. Canonical catalog titles should stay clean, but useful provider variant metadata should not be thrown away.

## Goal
Keep canonical Movie/Series/Episode identity clean while preserving enough sanitized provider-origin metadata to label each availability meaningfully.

Example:

Raw Xtream names:
- `4K-FR - Dune (2021)`
- `DUNE.MULTI.1080P.BluRay`
- `Dune VOSTFR 720p`

Canonical media:
- `Dune`

Availability labels:
- `Français • 4K`
- `Multi • 1080p • Blu-ray`
- `VOSTFR • 720p`

Never display raw internal UUIDs as the primary user-facing source/variant label.

## Data model
Audit what is currently retained during Xtream/M3U/Plex ingestion.

Preserve useful fields on availability/provider-item level, potentially including:
- original provider title/name;
- normalized language tag(s);
- quality/resolution;
- container extension;
- codec where known;
- HDR/Dolby Vision when known;
- audio channels/format when known;
- release/source hint (WEB-DL, BluRay, etc.) when safely derivable;
- provider/source display name;
- provider stream/item ID internally only.

Do not reintroduce dirty provider titles as the canonical TMDB title.

## Source display names
A configured source should have a stable human-friendly display name (e.g. `IPTV Maison`, `Xtream Principal`, `Plex`) separate from internal UUID.

If current `source.name` or equivalent exists, use it. If not, add/derive an appropriate display-name field/migration while preserving IDs internally.

## Variant label builder
Create one shared availability-label formatter used by Movie details, Episode details, player quality/source menu and anywhere else variants are shown.

Priority should emphasize what helps the user choose:
1. language/audio;
2. quality/resolution;
3. HDR/codec/release info if useful;
4. source display name only when needed to distinguish otherwise identical variants.

Avoid labels like:
`3f027fd8-72d2-4e...`

Prefer:
`Français • 1080p`
or when needed:
`Français • 1080p • IPTV Maison`.

## Raw-name retention
Store the original provider item title/name for diagnostics and future parser improvements even after canonical matching.

This is particularly useful when normalization initially misses tags or when a user needs to understand why two variants differ.

Do not expose credentials/secrets embedded in provider URLs or configuration.

## Migration/backfill
Existing already-synced availabilities may lack useful preserved labels. Provide a safe backfill where possible from existing provider metadata/database fields. If some data cannot be recovered without re-sync, ensure the next source sync enriches existing availability rows rather than requiring database reset.

## Acceptance criteria
- [ ] Canonical Movie/Series titles remain TMDB-clean.
- [ ] Original provider item name is retained at provider/availability level where available.
- [ ] Internal source UUID is never the normal user-facing variant name.
- [ ] Sources have human-readable display labels.
- [ ] Variant selector clearly shows language + quality at minimum when known.
- [ ] Source name is added when needed to distinguish equivalent variants.
- [ ] Movie and Episode selectors share the same formatting logic.
- [ ] Player source/quality menu uses the same useful labels.
- [ ] Existing availability data is backfilled/enriched where feasible without DB reset.
- [ ] New syncs preserve provider-origin metadata.
- [ ] Tests cover representative dirty Xtream names and clean displayed labels.

## Completion rule
Manually inspect a real movie/episode with multiple Xtream variants. The user must be able to understand which variant to pick without seeing or interpreting a UUID.
