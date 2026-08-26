# T133 — Move Live TV primary navigation from left sidebar to bottom bar

**Source**: GitHub Issue #284

## Description

## Context

The standalone IPTVFlix Live TV UI is now taking shape, but the current **left-side primary navigation** feels inconsistent with the existing VOD experience.

We want the Live TV app to share the same overall navigation philosophy as VOD: **persistent primary navigation at the bottom**, with content categories living inside the page rather than inside a permanent left rail.

This is a focused UX correction. Do not redesign the whole Live TV dashboard or alter the orange/black visual language.

## Goal

Replace the current left sidebar used for primary Live TV navigation with a **persistent bottom navigation bar** aligned with the VOD app interaction model.

## Target structure

### Top area

Keep:
- IPTVFlix branding;
- VOD / TV switch;
- profile/user affordance;
- search where appropriate.

### Main content

The main Live TV content should use the full horizontal width previously occupied by the sidebar.

Channel categories such as:
- Généralistes
- Sport
- Cinéma & Séries
- Infos
- Enfants
- Musique
- Documentaires
- International

should appear as **content sections/chips/cards/rails**, not as permanent primary navigation items.

### Bottom navigation

Add a persistent bottom navigation bar inspired by the existing VOD navigation, with an initial Live TV information architecture such as:

- Accueil TV
- Favoris
- Guide TV
- Chaînes
- Recherche

Exact icons/labels can follow existing VOD conventions where reusable.

The currently selected section must have a clear orange active state consistent with the Live TV theme.

## UX requirements

- Navigation should feel like the same IPTVFlix product when switching between VOD and TV.
- Bottom nav must not obscure page content; reserve/pad content appropriately.
- Mobile/tablet behavior should be first-class.
- Desktop should still look intentional and not like a stretched mobile layout.
- Keep the layout compatible with future Android TV / remote-focus navigation.
- Preserve current dashboard sections, channel cards, filters, favorites, EPG-ready states and playback behavior.

## Visual reference

The previous mockup remains useful for the black/orange Live TV visual direction, but **the left sidebar in that mockup is no longer the desired navigation model**.

Reference image:

![IPTVFlix Live TV visual direction](https://raw.githubusercontent.com/Billboc31/iptvflix/main/CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png)

Use it for color/density/card treatment only; replace its sidebar with the bottom navigation described above.

## Acceptance criteria

- [ ] Primary Live TV navigation is no longer rendered as a persistent left sidebar.
- [ ] A persistent bottom nav is implemented with Accueil TV / Favoris / Guide TV / Chaînes / Recherche (or equivalent existing-route labels).
- [ ] Active route is clearly highlighted in orange.
- [ ] Main content expands to use the freed horizontal space.
- [ ] Channel categories remain discoverable inside content, not lost with sidebar removal.
- [ ] VOD/TV switch remains functional and visually consistent.
- [ ] Existing Live TV functionality does not regress.
- [ ] Responsive/mobile layout is tested.
- [ ] Add/update component/routing tests for bottom-nav behavior and active states.
- [ ] No manual production DB changes.
