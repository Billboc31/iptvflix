# T097 — Extend MediaSegment ingestion with TheIntroDB and SkipMe multi-provider support

**Source**: GitHub Issue #199

## Description

## Context
#197 establishes the canonical `MediaSegment` model and initial IntroDB ingestion for intro/recap/outro metadata.

Because #197 may already be picked up by the Factory, do NOT rewrite or invalidate it. This follow-up extends the same architecture with additional segment providers so IPTVFlix is not dependent on a single community database.

The goal is to evaluate and, where technically/licensing-wise viable, integrate **TheIntroDB** and **SkipMe** alongside IntroDB, then merge results into the existing canonical `MediaSegment` store.

Do not assume provider capabilities from memory. Verify their current public APIs, identifiers, segment types, authentication, rate limits, licensing/terms and availability before implementation.

## Goal
Build real multi-provider segment enrichment:

```text
Canonical Episode
      ↓
SegmentProvider abstraction
      ├── TheIntroDB
      ├── SkipMe
      └── IntroDB
      ↓
normalize / score / merge
      ↓
MediaSegment
      ↓
Web + Android TV
```

The final user experience should have the best available timestamps for:
- intro;
- recap;
- outro;
- credits;
- preview/post-credit/other useful episodic markers where a provider genuinely exposes them.

Anime must be treated as a first-class use case.

## 1. Verify each provider before coding
For **TheIntroDB** and **SkipMe**, document from current official/public sources:
- public API/base URL or supported integration mechanism;
- read authentication requirements;
- identifiers supported (TMDB / IMDb / TVDB / AniList / season+episode, etc.);
- segment types actually exposed today;
- confidence/vote/submission metadata if available;
- rate limits/fair-use expectations;
- whether bulk export/dump is available;
- license/terms relevant to caching/reusing data in IPTVFlix;
- whether production read usage is permitted.

If one provider does not expose a stable/usable public API or its terms do not permit the intended use, mark it `NOT VIABLE` with evidence rather than scraping the website.

## 2. Reuse #197 architecture
Do not create a second competing segment schema.

Reuse/extend:
- canonical `MediaSegment`;
- `SegmentProvider` abstraction;
- episode external-ID resolution;
- backfill jobs;
- nightly/incremental refresh;
- API exposed to clients;
- diagnostics.

If #197 implementation differs slightly from the proposed shape, adapt to the actual merged code rather than duplicating it.

## 3. Provider adapters
Implement adapters for every provider confirmed viable.

Suggested interface:

```ts
interface SegmentProvider {
  id: string
  fetchEpisodeSegments(context: CanonicalEpisodeContext): Promise<ProviderSegmentResult>
}
```

Normalized provider result should preserve provenance and enough source metadata for scoring/debugging.

## 4. Identifier strategy
Prefer direct stable identifiers over fuzzy title matching.

Support whatever each real provider accepts, using IPTVFlix canonical external IDs. Candidate IDs include:
- TMDB;
- IMDb;
- TVDB;
- AniList for anime if genuinely supported by a provider.

Persist reusable external IDs rather than re-querying metadata services on every segment lookup.

Never silently attach a provider result when identifier/episode-number mapping is ambiguous.

## 5. Anime-specific matching
Validate explicitly with anime, because numbering can be difficult.

Handle/diagnose:
- season vs absolute episode numbering;
- specials / season 0;
- split cours;
- long-running shows;
- alternate cuts;
- AniList ↔ TMDB/TVDB/IMDb mappings where relevant.

Use at least several real anime episodes for manual validation, including one long-running series if provider coverage exists.

## 6. Multi-provider merge and ranking
When multiple providers return the same semantic segment, do not simply let the last write win.

Implement deterministic resolution using available evidence such as:
- manually configured provider priority;
- provider verification/status;
- confidence/votes/submission count;
- near-equal timestamp clustering/tolerance;
- duration sanity checks;
- manual override.

Example:

```text
IntroDB INTRO     82.0s → 142.0s
TheIntroDB INTRO  81.5s → 142.4s
SkipMe INTRO      82.1s → 142.2s
        ↓
cluster = same intro
        ↓
chosen normalized segment + provenance list
```

Preserve original provider rows/evidence if needed for future re-ranking; do not lose provenance.

## 7. Segment type normalization
Create/extend a normalized semantic enum capable of representing provider-specific types without corrupting meaning.

At minimum support existing #197 types and add others only if real provider data warrants them:
- `RECAP`
- `INTRO`
- `OUTRO`
- `CREDITS`
- `PREVIEW`
- `POST_CREDITS` if genuinely available/useful
- future extensible types.

Unknown provider segment types should be logged/ignored safely rather than mapped incorrectly.

## 8. Coverage fallback strategy
Define provider fallback/order based on measured coverage and quality, not assumption.

The desired runtime behavior is roughly:

```text
lookup episode
   ↓
query stale/missing providers in background
   ↓
merge all cached provider results
   ↓
return best normalized segments
```

Do not block playback waiting on all third-party providers.

## 9. Bootstrap/backfill
Extend the #197 backfill so existing canonical episodes can be enriched from all viable providers.

Requirements:
- idempotent;
- resumable;
- bounded concurrency per provider;
- independent provider rate limiting;
- provider-specific error counters;
- no-data cached with sensible retry TTL;
- one provider outage does not prevent another provider from enriching the episode.

## 10. Incremental/nightly refresh
Use provider-aware refresh cadence.

Examples:
- new/current-season episodes: retry more frequently;
- old episodes with verified stable segments: refresh less frequently;
- no-data episodes: retry periodically;
- provider failures: exponential backoff.

Avoid hammering community services.

## 11. Diagnostics and coverage comparison
Add admin/dev visibility that can answer:
- how many episodes have segments from each provider;
- overlap between providers;
- disagreement rate;
- anime coverage by provider;
- no-data rate;
- identifier mismatch rate;
- most common segment types;
- provider API failures/rate limiting.

For one episode, diagnostics should show all provider candidates and the final selected normalized segment.

## 12. Client behavior remains provider-agnostic
Web and Android TV should continue receiving normalized IPTVFlix markers only.

Clients must NOT care whether a marker came from IntroDB, TheIntroDB or SkipMe.

Example API output:

```json
{
  "episodeId": "...",
  "segments": [
    { "type": "intro", "startMs": 81000, "endMs": 142000 },
    { "type": "credits", "startMs": 1362000, "endMs": 1410000 }
  ]
}
```

Provider provenance can remain available in admin diagnostics but does not need to clutter normal playback payloads.

## 13. Prepare skip/never-stop behavior
Do not implement the whole player UX here, but ensure the merged data is suitable for:
- `Passer l'intro`;
- `Passer le récap`;
- `Épisode suivant` at credits/outro;
- future auto-skip settings;
- future anime `never stop` mode.

## Tests / real validation
Test at minimum:
- one live-action episode with >1 provider result if possible;
- multiple anime episodes;
- provider disagreement/merge case;
- provider no-data;
- provider unavailable/rate limited;
- identifier mismatch;
- idempotent backfill;
- normalized API result remains stable regardless of provider ordering.

## Acceptance criteria
- [ ] #197 schema/architecture is reused rather than duplicated.
- [ ] Current TheIntroDB capabilities/API/terms are verified and documented.
- [ ] Current SkipMe capabilities/API/terms are verified and documented.
- [ ] Every viable provider has a real adapter.
- [ ] Unsupported/non-viable provider is explicitly documented rather than scraped.
- [ ] Multi-provider results preserve provenance.
- [ ] Conflicting timestamps are deterministically merged/ranked.
- [ ] Anime matching is validated with real data.
- [ ] External IDs are used safely; ambiguous numbering never silently misattaches segments.
- [ ] Backfill and incremental refresh support multiple providers independently.
- [ ] Client API remains provider-agnostic.
- [ ] Diagnostics compare coverage/overlap/disagreement by provider.
- [ ] Existing IntroDB functionality from #197 is not regressed.

## Completion rule
Do not close merely because two adapter classes exist. Demonstrate real segment retrieval from every provider classified as viable, persist them for real canonical episodes, show at least one merged/selected result, and prove the normalized IPTVFlix API returns the correct markers. If a provider cannot legally/technically be integrated, document that evidence and continue with the viable providers instead of fabricating support.
