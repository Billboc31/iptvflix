# T132 — Build the Live TV dashboard UI with categories, favorites and EPG-ready cards

**Source**: GitHub Issue #279

## Description

## Context

With a standalone Live TV app and canonicalized channels, IPTVFlix needs the production Live TV dashboard itself.

## Visual target

Use this mockup as the primary UI reference:

![IPTVFlix Live TV target](https://raw.githubusercontent.com/Billboc31/iptvflix/main/CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png)

Source: `CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png` at repository root.

The visual direction is deliberate: dark IPTVFlix shell, **orange** accent, sidebar navigation, top VOD/TV switch, strong channel logos, compact EPG information, horizontal featured rails and dense but readable all-channels list.

## Goal

Implement the Live TV consumer dashboard against canonical channel APIs, closely following the visual hierarchy of the reference screen.

## Required sections

### Top shell

- IPTVFLIX branding.
- VOD / TV switch with TV active in orange.
- Search affordance.
- Current profile/user control reuse where appropriate.

### Sidebar

Include navigation foundation for:

- Accueil TV
- Favoris
- Récemment regardées
- Guide TV
- Toutes les chaînes

And channel categories such as:

- Généralistes
- Sport
- Cinéma & Séries
- Infos
- Enfants
- Musique
- Documentaires
- Divertissement
- International

Categories must come from canonical/data-driven channel category information rather than title-specific hardcoding.

### En direct maintenant

Create a prominent horizontal rail of live channels.

Each card should support:

- channel logo;
- `LIVE` badge;
- current program name where EPG exists;
- program start/end time;
- progress indicator based on current time;
- immediate play action.

If EPG is not yet available, the card still renders cleanly with channel identity and live status.

### Recently watched

Provide a compact rail for recent canonical channels, ready to consume actual history state when available.

If no history exists yet, omit the rail rather than fabricate content.

### Channels by category

Show category shortcut cards with channel counts, following the visual reference.

### All channels

Build a dense searchable/filterable canonical channel list/grid with:

- favorite toggle;
- clean canonical logo/name;
- current/next EPG information where available;
- live progress;
- play action;
- useful filters such as favorites, HD/4K where reliable, French/international/category as data allows.

Do not display raw duplicate `ChannelSource` records to the user.

## EPG readiness

This ticket should be **EPG-ready**, even if full XMLTV/EPG ingestion lands separately.

Define UI contracts/components so `now` / `next` program information, start/end times and progress can be supplied without rewriting channel cards later.

No fake schedules should be used in production UI when EPG data is absent.

## Favorites and history readiness

- Favorite action should target canonical `Channel` identity, not a technical stream source.
- Recently watched/history should also reference canonical channels.
- If the underlying persistence already exists, wire it; otherwise establish clean frontend/domain seams rather than inventing temporary local-only behavior that will need replacement.

## Playback

- Clicking play/channel should launch the preferred stream selected by the canonical channel/source-selection layer.
- UI should not expose provider/source choice in the normal happy path.
- Surface graceful playback failure/retry/fallback behavior.

## Responsive behavior

- Desktop/tablet layout should strongly follow the reference.
- Mobile should collapse sidebar/navigation sensibly while keeping search, categories and channel cards usable.
- Design should remain compatible with future TV/remote focus navigation, even though this ticket targets the Live TV web app.

## Acceptance criteria

- Live TV dashboard visually follows the provided orange/black mockup.
- Top VOD/TV switch and Live TV sidebar are implemented.
- Live channels are shown using canonical channel identities/logos.
- Featured live rail, category shortcuts and all-channels area render from real API data.
- No duplicate provider streams appear as separate cards when canonicalization has grouped them.
- EPG-present and EPG-absent states both render cleanly.
- Favorites/history semantics are canonical-channel based.
- Search/filter works on canonical channel metadata.
- Empty/error/loading states are graceful and isolated by section where appropriate.
- Existing VOD UI is not restyled/regressed by Live TV-specific orange theme.
- Add automated/component tests for major dashboard sections, EPG/no-EPG states, canonical channel rendering, filtering and playback action wiring.
- No channel-specific hacks and no fake production EPG data.
