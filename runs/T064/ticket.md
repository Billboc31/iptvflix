# T064 — Pivot IPTVFlix to a TMDB-first canonical catalog architecture

**Source**: GitHub Issue #131

## Description

## Goal
Make TMDB the canonical media catalog. Xtream, Plex and future providers become availability/variant sources attached to canonical movies, shows and episodes.

Core rule: TMDB describes what media exists; IPTVFlix owns discovery/user state; providers describe where/how it can be played.

## Architecture
Prefer one PostgreSQL instance initially with a strong logical catalog/application boundary that can be extracted later. Do not duplicate full canonical metadata into app tables.

A canonical movie/show must be allowed to exist with zero playable sources. Multiple provider/language/quality variants must attach to one canonical entity.

Support movies and TV hierarchy (show → season → episode). Keep enough localized metadata for a premium streaming UI: titles, overview, dates, status, genres, posters/backdrops paths, runtime, popularity/votes, languages/countries, collections, useful credits/keywords/external IDs and sync provenance/timestamps.

Do not store TMDB image binaries locally; store paths/metadata.

## Migration
Existing media details, source variants, watchlist, history/progress, shelves and recommendations must migrate/reconcile onto canonical entities rather than being discarded.

## Acceptance criteria
- Canonical identity uses TMDB identity where available.
- Media with zero sources are first-class catalog entities.
- Multiple Xtream/Plex/future variants can attach to one item.
- TV hierarchy exists independently of source availability.
- Model is ready for a large local catalog.
- Existing user state can migrate to canonical entities.
- Adding another provider does not require redesigning Movie/Show.
- Follow-up tickets can land incrementally without maintaining two competing identity models long-term.
