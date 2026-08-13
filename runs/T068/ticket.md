# T068 — Implement hybrid local + TMDB search with automatic catalog enrichment

**Source**: GitHub Issue #135

## Description

Parent: #131

Search must not be limited to what IPTVFlix already knows locally.

When a user searches for a movie or show, search the local canonical catalog immediately and also query TMDB when appropriate. Merge results by canonical TMDB identity and avoid duplicate cards.

Any useful TMDB result not already present locally should be importable into the canonical catalog automatically so it becomes a durable IPTVFlix entity even with zero playable sources. It can then be added to a watchlist, used in shelves/recommendations, and later receive Xtream/Plex availability without changing identity.

Prioritize fast UX: local results should render without waiting for remote search. Remote results can enrich the result set. Handle TMDB outage/rate limiting gracefully and keep local search functional.

Search should understand movies and TV and use French/localized titles plus original/alternate titles where available. Ranking should remain sensible when local and remote results overlap.

Acceptance criteria:
- Local catalog search is fast and works offline from TMDB.
- TMDB can add relevant results missing locally.
- Local/remote duplicates merge by TMDB identity.
- Selecting/using a remote-only result persists the canonical entity locally.
- Zero-source results can be opened and added to user features.
- Later provider sync attaches availability to the same entity.
- Movies and shows are supported.
- Remote failures do not break local search.
