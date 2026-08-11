## Objective

Create a canonical domain-model document under `docs/architecture/` and update existing product/architecture docs to formally establish IPTVFlix as a universal media library where canonical works exist independently of provider availability, replacing the IPTV-first framing in the current docs.

## Included

### New file: `docs/architecture/domain-model.md`

Define and name the four first-class concepts and their relationships:

- **Media** — a canonical work (Movie or Series) that exists in the catalog independently of any provider. A Media is the single identity around which discovery, watchlist, history and recommendations are organised. A Media may have zero availabilities and still be a valid catalog entry.
- **Availability** — a record of where and how a specific Media can currently be accessed (provider, item ID, status, timestamps). One Media may have multiple Availability records covering different sources, languages or quality variants; these are variants of the same canonical work, not duplicate catalog entries.
- **Source** — a provider adapter (Xtream, M3U, Plex, or future integrations) that supplies Availability data. A Source is responsible for mapping its own item identifiers to canonical Media via the matching layer. A Source must not introduce source-specific models into the canonical API or UI.
- **Shelf** — an ordered, named grouping of Media used for home-screen and discovery presentation (e.g. "Continue Watching", "Recently Added", "Cinema Radar"). Shelves are a presentation concept; they reference canonical Media identities, not provider items.

Document the canonical hierarchy for series content:
- A **Series** is a Media containing one or more **Seasons**.
- A **Season** belongs to exactly one Series, identified by `seasonNumber`.
- An **Episode** belongs to exactly one Season, identified by `episodeNumber`.
- Availability for a Series may be tracked at Series level and at Episode level independently.

State the four explicit invariants:
1. A Media may exist with zero Availabilities.
2. Multiple Availabilities (across sources, languages, or quality tiers) do not create duplicate Media entries.
3. Watchlist, viewing progress, and recommendations reference canonical Media (or Episode) IDs, never provider item IDs.
4. A new Source integration must implement the provider adapter boundary and must not require changes to canonical API responses or UI components.

Document the release lifecycle distinction:
- **Global release state** — announced, upcoming, theatrical, digital, streaming-wide (derived from external metadata such as TMDB/IMDB). Applies to the canonical Media regardless of any user's sources.
- **Available to me** — the user-specific availability: whether any of the user's configured Sources carries this Media right now.

Identify current implementation alignment and known evolution points (without prescribing rewrites):
- Schema already models the domain correctly: `movies`, `series`, `seasons`, `episodes` tables are provider-independent; `movieAvailabilities`, `seriesAvailabilities`, `episodeAvailabilities` carry per-source records.
- `sources` table currently enumerates `XTREAM | M3U` — adding Plex requires a new enum value and a new adapter module; the canonical schema is unchanged.
- `titleMatchResults` implements the provider→canonical matching layer; the same table and matching logic can be reused for any new Source type.
- Global release lifecycle fields (announcement date, theatrical release date, streaming-wide date) are not yet present in the `movies`/`series` schema. This is a planned evolution point, not a blocker.
- `AvailabilityStatus` in API contracts currently exposes only `AVAILABLE | UNAVAILABLE`; a richer "available to me vs. globally released" distinction may be surfaced in a future API contract revision.
- Shelf is architecturally intended but not yet a first-class DB entity; current home-screen rows are computed ad-hoc queries. A future Shelf table is an identified evolution point.

### Updated file: `docs/product/vision.md`

- Replace the opening framing ("personalised discovery layer over IPTV subscriptions") with language that positions IPTVFlix as a universal personal media library.
- Add Plex as an example of a future Source alongside IPTV.
- Update "What IPTVFlix Is Not" to reflect that Plex-style local libraries are a future Source adapter, not an excluded concept.
- Keep "MVP Scope" section accurate to what is actually built.

### Updated file: `docs/architecture/overview.md`

- Add a reference to `docs/architecture/domain-model.md` as the canonical domain reference.
- Update the "Provider adapter isolation" principle to use the generalised Source concept (not Xtream-specific language).

## Excluded

- Schema migrations or any runtime code changes.
- Plex adapter implementation.
- Recommendation engine implementation.
- Shelf DB entity implementation.
- Global release lifecycle field additions to the schema.
- Changes to API contracts or frontend components.
- Any changes outside `docs/`.

## Acceptance criteria

- `docs/architecture/domain-model.md` exists and defines Media, Availability, Shelf, and Source with responsibilities and relationships.
- The Series → Season → Episode hierarchy is explicitly documented in `docs/architecture/domain-model.md`.
- The document explicitly states that a canonical Media may exist with zero Availabilities.
- The document explicitly states that multiple source/language/quality variants are modeled as Availability records of one canonical Media, not as duplicate catalog entries.
- The document distinguishes global release lifecycle from user-specific/source-specific availability.
- Plex is named as a future Source example using the same adapter boundary as IPTV/Xtream.
- Current schema alignment and known evolution points (release lifecycle fields, Shelf table, `AvailabilityStatus` richer enum, Plex source enum value) are called out without prescribing a rewrite.
- `docs/product/vision.md` no longer frames IPTVFlix exclusively as an IPTV product.
- `docs/architecture/overview.md` references the new domain-model document.
- No file outside `docs/` is modified.
