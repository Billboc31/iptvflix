# IPTVFlix — Product Vision

## Value Proposition

IPTVFlix is a **personalised discovery layer** over the user's own IPTV subscriptions. Where ordinary IPTV clients expose a raw provider catalog, IPTVFlix enriches, deduplicates, and ranks that content around the user's tastes — surfacing what they actually want to watch, not just what their provider happens to list.

## Primary Users

Self-hosted personal use: a single person or small household who controls their IPTV provider credentials and wants a smarter, cleaner interface over the content they already pay for. The user manages their own deployment.

## Core Product Principles

**Discovery first.** The default experience prioritises relevant content over exhaustive lists. Browsing, search, and the home screen are shaped by context and taste.

**Canonical catalog.** A film or series has a single identity in IPTVFlix regardless of how many providers carry it or what names they use. Multiple sources map to one canonical item; the domain is never polluted by provider-specific representations.

**Cinema Radar.** Users can mark films they want to watch. When those films become available through their IPTV sources, IPTVFlix surfaces them automatically. This is a first-class feature, not an afterthought.

**Transparent recommendations.** When IPTVFlix suggests content, the user can understand why — by genre affinity, watched history, or explicit taste signals. No black-box ranking.

**Provider independence.** The product experience is independent of which IPTV provider the user subscribes to. Swapping or adding providers should not change how the UI or domain model works.

## MVP Scope

**Built today:** source management (add/remove IPTV providers), catalog ingestion and sync, content browsing, search, and the Cinema Radar tracking skeleton.

**Planned next:** taste profiling, a recommendation engine driven by viewing history, and Android TV playback.

**Later:** multi-user households, additional provider adapters, social features.

## What IPTVFlix Is Not

- Not a streaming provider — it only consumes IPTV sources the user already has.
- Not a universal IPTV client — its purpose is personalised discovery, not raw catalog access.
- Not a Plex or Jellyfin replacement — it does not manage local media libraries.
