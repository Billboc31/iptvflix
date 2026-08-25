# T131 — Canonicalize and deduplicate Live TV channels with logos and source failover

**Source**: GitHub Issue #278

## Description

## Context

Live IPTV providers frequently expose the same logical channel several times, for example `TF1`, `TF1 HD`, `TF1 FHD`, `FR | TF1`, or duplicates from multiple providers/playlists. IPTVFlix should display **one logical channel card** while retaining multiple technical stream sources behind it.

The Live TV UI target is:

![IPTVFlix Live TV target](https://raw.githubusercontent.com/Billboc31/iptvflix/main/CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png)

Channel cards in this UI assume clean canonical names/logos and must not show provider duplication noise.

## Goal

Introduce a canonical Live TV channel model and ingestion/deduplication pipeline so the UI consumes one `Channel` with zero or more `ChannelSource` records rather than raw provider streams.

## Domain model

Conceptually:

- `Channel`
  - canonical id
  - canonical display name
  - normalized name
  - logo
  - country/language where known
  - category/categories
  - EPG/tvg identity where known
  - favorite/history references at canonical-channel level
- `ChannelSource`
  - provider/source identity
  - source-specific name
  - stream URL/id
  - quality/resolution indicators where known
  - availability/health metadata
  - priority
  - source-specific tvg-id/logo/category metadata

Use existing ingestion entities where possible; avoid unnecessary parallel models if equivalent primitives already exist.

## Deduplication / matching

Build a generic confidence-based canonical matching strategy using available signals such as:

- normalized channel name (strip provider prefixes, HD/FHD/4K suffix noise, punctuation/spacing variants where safe);
- `tvg-id` / EPG identifiers;
- logo identity/path when useful;
- country/language;
- provider category/context;
- other reliable existing metadata.

Do **not** blindly merge on fuzzy name alone. Ambiguous matches should remain separate rather than incorrectly merging distinct regional/variant channels.

Store/debug enough match provenance/confidence internally to diagnose incorrect merges.

## Logos

Canonical channels should expose a stable usable logo.

- Prefer the strongest valid source logo when multiple sources provide one.
- Gracefully fall back to a styled initials/name placeholder when no logo exists.
- Do not block channel ingestion because artwork is missing.
- Avoid downloading/duplicating remote logo binaries unless the existing architecture already has a safe image caching strategy.

## Source selection / failover

The UI/player should request the canonical channel, then backend/domain logic selects an actual stream source.

Initial source selection should consider available metadata such as:

- known availability/health;
- configured provider/source priority;
- quality/resolution;
- stable preferred source when equivalent.

Design for automatic fallback to another `ChannelSource` if the preferred stream cannot play, without requiring the user to pick between duplicate TF1 entries manually.

Do not build an over-complex active probing infrastructure in this ticket unless infrastructure already exists; establish the model/selection seam cleanly.

## Categories

Map raw provider categories into useful canonical groups suitable for the UI reference, e.g. generalist, sport, cinema/series, news, kids, music, documentary, entertainment, international. Keep mappings configurable/data-driven and preserve unknown provider categories rather than destroying information.

## Acceptance criteria

- Live TV ingestion produces canonical channels with multiple underlying sources where duplicates are confidently identified.
- Common naming variants such as provider prefixes and quality suffixes do not create obvious duplicate cards.
- Ambiguous channels are not aggressively merged.
- Canonical channel exposes a clean display name and logo/fallback.
- Favorites/history/EPG-ready identity is designed at canonical channel level.
- A reusable source-selection function/service chooses the preferred stream and supports fallback ordering.
- API contracts expose canonical channels, not raw duplicate streams, to the Live TV frontend.
- Add automated tests covering normalization, confident duplicates, ambiguous non-merges, multiple providers, logo selection and source ordering.
- No channel-specific hardcoding for TF1/France 2/etc.; examples are illustrative only.
- No manual production DB edits.
