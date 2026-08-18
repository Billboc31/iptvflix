# T097 — Provider Research

Researched before implementation. Sources: public API documentation, open-source plugin source code, community forum posts.

---

## TheIntroDB — CONDITIONALLY VIABLE

**API base URL**: `https://api.theintrodb.org/v3`

**Authentication**: None required for read requests. An optional user API key can be included to receive pending/unverified submissions in results.

**Primary lookup path**: `GET /media?tmdb_id=<seriesTmdbId>&season=<n>&episode=<n>`

**Fallback lookup path**: `GET /media?imdb_id=<seriesImdbId>&season=<n>&episode=<n>`

**Identifiers supported**: TMDB (preferred), IMDb (fallback). TVDB not documented as a primary identifier. AniList not supported — the service uses TMDB for anime series.

**Segment types exposed** (response keys):
- `intro` — array of `{ start, end, submissions?, verified? }`
- `recap` — array
- `credits` — array
- `preview` — array

Each type is returned as an **array** — multiple candidate sub-segments may be present. The adapter picks the entry with the highest `submissions` count (tie-break: first entry).

**Timestamps**: Returned in **seconds** (float). Multiply by 1000 for milliseconds.

**Rate limiting**: Enforced server-side. Response headers exposed:
- `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset`
- `X-UsageLimit-Limit` / `X-UsageLimit-Remaining`

Exact thresholds (requests per window) are **not publicly documented**. The adapter logs a warning when either `Remaining` header drops below a configurable threshold (default 10). On 429, the adapter retries with exponential backoff using `X-RateLimit-Reset` or `Retry-After` (max 3 retries, max 60s delay).

**Bulk export**: Not available.

**ToS / data policy**:
- `GET /terms` returns HTTP 403 — the terms-of-service document is not publicly readable.
- No data reuse or caching policy is published on the website, in any GitHub repository, or in public channels.
- Official integrations exist for Jellyfin, Emby, Kodi, and Infuse — these make live API calls rather than caching data server-side.
- Contact `hello@theintrodb.org` required before production-scale server-side caching or redistribution.

**Production read intent**: Clear — the API was designed for media player integrations. Live read usage is the documented pattern.

**Decision**: **CONDITIONALLY VIABLE**
The adapter is built and functional. Production deployment at scale requires ToS confirmation from TheIntroDB regarding server-side caching. Until confirmation is received, the adapter performs live reads per playback session (matching the Jellyfin/Emby integration model).

---

## SkipMe (`db.skipme.workers.dev`) — NOT VIABLE

**Source**: Internal Cloudflare Workers endpoint, exposed incidentally by the open-source `intro-skipper` Jellyfin plugin source code (C# plugin, GitHub).

**Segment types** (inferred from plugin source): `intro`, `recap`, `credits`, `preview`, `commercial`.

**Identifiers** (inferred): TMDB, IMDb, TVDB, AniList — inferred from C# plugin; not verified against a public API spec.

**Rate limits**: Unknown — no documentation found anywhere.

**ToS / data policy**:
- No terms of service file exists in any repository.
- No data license published.
- No permission grant for third-party use in any repository or public channel.
- The endpoint is operated by the Jellyfin `intro-skipper` organization as an undocumented internal service.

**Bulk export**: Not available.

**Decision**: **NOT VIABLE**
Using an undocumented endpoint with no ToS provides no legal permission and no stability or availability guarantee. The endpoint could be taken offline or access-controlled at any time without notice.

**Alternative on record**: SkipDB (`api.skipdb.tv`) has a documented public API, a 120 req/min read limit, and an ODbL 1.0 license. ODbL requires publishing derived segment data under ODbL if cached server-side. This trade-off warrants a separate follow-up ticket before integration.

---

## Provider comparison summary

| Provider   | API | Auth | TMDB | IMDb | AniList | Anime coverage | License   | Status            |
|------------|-----|------|------|------|---------|----------------|-----------|-------------------|
| IntroDB    | Yes | No   | No   | Yes  | No      | Good           | Unknown   | Viable (T096)     |
| TheIntroDB | Yes | No   | Yes  | Yes  | No      | Good via TMDB  | ToS gap   | Conditionally viable |
| SkipMe     | No  | —    | —    | —    | —       | Unknown        | None      | NOT VIABLE        |
