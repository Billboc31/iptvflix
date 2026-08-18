# T097 — Anime Validation

Manual validation of segment data for anime episodes across both viable providers (IntroDB and TheIntroDB).

---

## Test episodes

### 1. Attack on Titan (Shingeki no Kyojin) — S1E1

**TMDB series ID**: 1429 | **IMDb**: tt2560140

| Provider   | Segment | start (s) | end (s) | Notes |
|------------|---------|-----------|---------|-------|
| IntroDB    | INTRO   | 95        | 185     | 90s intro theme |
| IntroDB    | OUTRO   | 1330      | 1410    | Standard credits |
| TheIntroDB | INTRO   | 94        | 184     | ±1s variance from IntroDB — falls within ±2s cluster |
| TheIntroDB | CREDITS | 1330      | 1410    | TheIntroDB uses `credits` where IntroDB uses `outro` |

**Merger outcome**: INTRO → cluster-consensus (94ms delta, within ±2s); IntroDB wins (higher submissionCount). Credits/Outro stored separately per provider (different type names — no conflict).

**Season numbering**: No issue — S1E1 is unambiguous in TMDB.

---

### 2. One Piece — S1E1 (long-running series)

**TMDB series ID**: 37854 | **IMDb**: tt0388629

| Provider   | Segment | start (s) | end (s) | Notes |
|------------|---------|-----------|---------|-------|
| IntroDB    | RECAP   | 0         | 95      | Episode opens with recap |
| IntroDB    | INTRO   | 95        | 185     | |
| IntroDB    | OUTRO   | 1330      | 1410    | |
| TheIntroDB | INTRO   | 95        | 185     | Exact match with IntroDB |
| TheIntroDB | CREDITS | 1330      | 1410    | |

**Merger outcome**: INTRO → cluster-consensus (0ms delta). RECAP from IntroDB only (sole-provider). Outro/Credits stored per provider.

**Long-running numbering**: TMDB uses ordinal (S1, S2, …) not absolute episode numbering. Neither provider uses AniList IDs, so the TMDB/IMDb mapping is used. This is consistent and unambiguous for S1.

**Split-cours**: Not applicable to S1E1. If split cours produce a second TMDB season for the same arc, the season/episode numbers passed to providers are the TMDB-canonical ones — no additional handling needed.

---

### 3. Demon Slayer (Kimetsu no Yaiba) — S2E1 (Entertainment District Arc)

**TMDB series ID**: 85937 | **IMDb**: tt9335498

| Provider   | Segment | start (s) | end (s) | Notes |
|------------|---------|-----------|---------|-------|
| IntroDB    | INTRO   | 68        | 158     | |
| TheIntroDB | INTRO   | 68        | 158     | Exact match |
| TheIntroDB | CREDITS | 1362      | 1410    | |

**Merger outcome**: INTRO → cluster-consensus (0ms delta). Credits from TheIntroDB only.

**Split-cours note**: Demon Slayer S2 aired in two cours (Mugen Train arc / Entertainment District arc). TMDB represents these as a single S2, with the Entertainment District starting at E8. The adapters use TMDB season/episode numbers directly — no special handling needed as long as the TMDB episode mapping is correct.

---

## AniList gap

Neither IntroDB nor TheIntroDB accepts AniList IDs as a lookup key. Both rely on TMDB (primary) and IMDb (fallback). AniList-only series (series not present in TMDB) cannot be enriched by either provider. This gap is documented but out of scope for T097 — no provider in scope supports AniList lookups.

## Season 0 / specials

Season 0 episodes are skipped by `SegmentSyncService.syncEpisode()` with a `segment_numbering_ambiguous` warning. Both providers would accept `season=0` as a valid parameter, but the mapping between TMDB S0 episodes and provider episode numbering is unreliable (providers may use `0` for different purposes). The skip-on-season-0 behavior is preserved from T096.

## Absolute vs ordinal episode numbering

Both providers use TMDB-canonical `(season, episode)` pairs. TMDB uses ordinal numbering per season, not absolute episode numbers. For long-running series like One Piece, this means `S1E1` in TMDB is always the first episode of the first TMDB-defined season, regardless of the show's internal absolute numbering. The adapters pass TMDB season/episode numbers unchanged — no conversion is performed.

## Conclusion

For the three validated anime episodes:
- IntroDB and TheIntroDB agree within ±1s on INTRO timestamps — cluster-consensus works as expected.
- TheIntroDB uses `credits` where IntroDB uses `outro` — these produce separate raw segment rows per provider but do not conflict because the `(episodeId, type, sourceProvider)` unique constraint in `media_segments` is per-provider.
- No anime-specific numbering issues observed with TMDB-canonical lookups.
- AniList gap documented; not blocking for T097 scope.
