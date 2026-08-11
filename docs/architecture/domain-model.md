# IPTVFlix — Domain Model

This document is the canonical reference for the IPTVFlix domain model. All future source integrations, API design decisions, and product features must be consistent with the invariants stated here.

---

## First-Class Concepts

### Media

A **Media** is a canonical work — either a Movie or a Series — that exists in the catalog independently of any provider or source. Media is the single identity around which discovery, watchlist, viewing history, and recommendations are organised.

A Media may have zero Availabilities and still be a valid catalog entry. Its existence is derived from external metadata (TMDB, IMDB) and user intent, not from any provider's catalog.

### Availability

An **Availability** is a record of where and how a specific Media can currently be accessed — it carries the provider reference, item ID, streaming status, language variant, and quality tier. One Media may have multiple Availability records covering different sources, languages, or quality variants. These are variants of the same canonical work, not duplicate catalog entries.

### Source

A **Source** is a provider adapter that supplies Availability data. Current sources: `XTREAM`, `M3U`. Future sources: `PLEX`, and others. A Source is responsible for mapping its own item identifiers to canonical Media via the matching layer (`titleMatchResults`). A Source must not introduce source-specific models into the canonical API responses or UI components.

Plex is a future Source that uses the same adapter boundary as IPTV sources. Its catalog entries map to canonical Media identities; the canonical API and UI are unchanged by adding it.

### Shelf

A **Shelf** is an ordered, named grouping of Media used for home-screen and discovery presentation (e.g. "Continue Watching", "Recently Added", "Cinema Radar"). Shelves are a presentation concept; they reference canonical Media identities, not provider items. Shelf is architecturally intended but is not yet a first-class DB entity — current home-screen rows are computed via ad-hoc queries.

---

## Series Hierarchy

- A **Series** is a Media containing one or more **Seasons**.
- A **Season** belongs to exactly one Series, identified by `seasonNumber`.
- An **Episode** belongs to exactly one Season, identified by `episodeNumber`.
- Availability may be tracked at Series level (e.g. the entire series is available on a source) and at Episode level independently (e.g. only specific episodes are matched).

---

## Invariants

1. **A Media may exist with zero Availabilities.** Presence in the catalog does not imply that the user's configured sources carry it.
2. **Multiple Availabilities do not create duplicate Media entries.** Source, language, and quality variants are modelled as Availability records on one canonical Media.
3. **Watchlist, viewing progress, and recommendations reference canonical Media (or Episode) IDs, never provider item IDs.**
4. **A new Source integration must implement the provider adapter boundary and must not require changes to canonical API responses or UI components.**

---

## Release Lifecycle vs. User Availability

Two distinct concepts govern whether content is "available":

**Global release state** describes where a work sits in its publication lifecycle — `announced`, `upcoming`, `theatrical`, `digital`, `streaming-wide`. This state is derived from external metadata (TMDB/IMDB) and applies to the canonical Media regardless of any user's configured sources.

**Available to me** is the user-specific availability: whether any of the user's configured Sources currently carries this Media. A film can be `theatrical` globally and `unavailable to me` on all my sources simultaneously.

---

## Current Implementation Alignment

The existing schema already models the domain correctly:

| Schema entity | Domain concept |
|---|---|
| `movies`, `series` | Canonical Media (Movies and Series) |
| `seasons`, `episodes` | Series hierarchy |
| `movieAvailabilities`, `seriesAvailabilities`, `episodeAvailabilities` | Availability records per source |
| `sources` | Source registry (`XTREAM \| M3U`) |
| `titleMatchResults` | Provider→canonical matching layer |

---

## Known Evolution Points

These are not blockers. They are identified migration/evolution steps for future tickets:

- **Plex source enum value** — `sources` table currently enumerates `XTREAM | M3U`. Adding Plex requires a new enum value and a new adapter module; the canonical schema is unchanged.
- **Global release lifecycle fields** — announcement date, theatrical release date, and streaming-wide date are not yet present in `movies`/`series`. This is a planned addition, not a rewrite.
- **`AvailabilityStatus` richer enum** — API contracts currently expose only `AVAILABLE | UNAVAILABLE`. A richer distinction between "available to me" and "globally released" may be surfaced in a future API contract revision.
- **Shelf as a first-class entity** — a future `shelves` DB table will replace current ad-hoc home-screen queries, enabling user-defined and system-defined shelves to be managed uniformly.
