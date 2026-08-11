# IPTVFlix — Product Vision

## Value Proposition

IPTVFlix is a **universal personal media library** — a canonical catalog of films and series that exists independently of where or how the user can currently watch them. Where ordinary media clients are tied to a single provider, IPTVFlix unifies content from IPTV subscriptions, local libraries (Plex, future adapters), and metadata sources into one identity per work, then builds personalised discovery, tracking, and recommendations on top of that foundation.

## Primary Users

Self-hosted personal use: a single person or small household who controls their own media sources and wants a smarter, cleaner interface over the content they already have access to. The user manages their own deployment.

## Core Product Principles

**Discovery first.** The default experience prioritises relevant content over exhaustive lists. Browsing, search, and the home screen are shaped by context and taste.

**Canonical catalog.** A film or series has a single identity in IPTVFlix regardless of how many providers carry it or what names they use. Multiple sources map to one canonical item; the domain is never polluted by provider-specific representations.

**Cinema Radar.** Users can mark films they want to watch. When those films become available through their IPTV sources, IPTVFlix surfaces them automatically. This is a first-class feature, not an afterthought.

**Transparent recommendations.** When IPTVFlix suggests content, the user can understand why — by genre affinity, watched history, or explicit taste signals. No black-box ranking.

**Provider independence.** The product experience is independent of which source the user subscribes to. Adding, swapping, or removing a source (IPTV, Plex, or future adapters) must not change how the UI or canonical domain model works.

## MVP Scope

**Built today:** source management (add/remove IPTV providers), catalog ingestion and sync, content browsing, search, and the Cinema Radar tracking skeleton.

**Planned next:** taste profiling, a recommendation engine driven by viewing history, and Android TV playback.

**Later:** multi-user households, additional source adapters (including Plex), social features.

## What IPTVFlix Is Not

- Not a streaming provider — it only consumes sources the user already has access to.
- Not a universal IPTV client — its purpose is personalised discovery across all configured sources, not raw catalog access.
- Not a Plex or Jellyfin replacement — it does not manage local media files. Plex (and similar) is a future Source adapter that feeds canonical Media, not a competing model.
