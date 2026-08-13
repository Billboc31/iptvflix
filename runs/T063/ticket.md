# T063 — Restore source management and administration access in the new top-navigation UI

**Source**: GitHub Issue #127

## Description

## Context

T059 redesigned the web application around a streaming-first UI with a top navigation and removed the old desktop `LeftNav`.

The new navigation is much better for content browsing, but it introduced an important UX regression: **Source management is no longer reachable from the visible UI**.

`TopNav` currently exposes the primary consumer destinations (`Accueil`, `Films`, `Séries`, `Ma Liste`, `Nouveautés`) and a settings icon that links directly to `/settings/playback`. The existing `/sources` administration experience should not be placed back into the main streaming navigation, but it must remain clearly accessible.

## Objective

Keep the clean Netflix-style consumer navigation introduced by T059 while restoring a coherent administration/settings entry point for source management and the other technical settings already present in IPTVFlix.

## UX direction

The primary top navigation must remain focused on watching/discovery.

Use the settings/profile area on the right side of the top bar as the entry point for administration. Prefer a small settings/profile menu or a proper settings hub rather than adding `Sources` beside `Films` and `Séries`.

Conceptually:

```text
Top navigation

IPTVFlix | Accueil | Films | Séries | Ma Liste | Nouveautés        Search   ⚙️
                                                                        │
                                                                        ├─ Sources
                                                                        ├─ Lecture
                                                                        ├─ Appareils
                                                                        ├─ Profil / préférences
                                                                        └─ other existing settings when applicable
```

The exact presentation can follow the existing design system and responsive patterns.

## Requirements

### 1. Restore Source management access

- `/sources` must be reachable through the visible UI on desktop.
- It must also remain reachable on mobile / small screens.
- Do not require users to know or manually type `/sources`.
- Preserve the existing Source management functionality (add/edit/remove/sync/status actions as currently implemented).

### 2. Preserve streaming-first primary navigation

Do **not** add technical administration destinations such as `Sources` directly to the primary `Accueil / Films / Séries / ...` navigation unless there is no reasonable alternative.

The main navigation should remain focused on content discovery and playback.

### 3. Introduce coherent Settings navigation

The current ⚙️ link directly to `/settings/playback` should become a discoverable entry point to the application's settings/admin areas.

Reuse existing routes/pages rather than duplicating them.

At minimum expose links for existing relevant destinations such as:

- Sources (`/sources`)
- Playback settings (`/settings/playback`)
- Device settings if an existing route/page is present
- Profile/preferences if an existing route/page is present

The Planner must inspect the current router and existing settings pages to determine the complete valid list. Do not create dead links for features/routes that do not exist.

### 4. Responsive behavior

Desktop and mobile must both provide a clear route to Source management/settings.

The solution may use:

- a dropdown/popover from the settings/profile icon on desktop;
- an equivalent menu/sheet/settings destination on mobile;
- or a dedicated Settings hub shared by both.

Follow existing responsive conventions from T059.

### 5. Navigation state and accessibility

- Menu/button must have an accessible label.
- Keyboard navigation must work for desktop interactive menu elements.
- Menu must close appropriately after navigation / outside interaction if a popover is used.
- Current settings destination should have reasonable active-state feedback where applicable.

### 6. No regression to T059 visual direction

Do not restore `LeftNav`.

Do not turn the top bar into an administration toolbar.

The resulting UI should still look like a polished streaming application, with technical management intentionally secondary but easy to find.

## Acceptance Criteria

- [ ] A desktop user can reach `/sources` from the visible new T059 UI.
- [ ] A mobile user can reach `/sources` from the visible UI.
- [ ] The old `LeftNav` is not restored.
- [ ] `Sources` is not added as a primary content-navigation item beside Films/Séries unless explicitly justified by the implementation constraints.
- [ ] The existing ⚙️ area becomes a coherent settings/admin entry point rather than linking only to playback settings.
- [ ] Existing Playback settings remain reachable.
- [ ] Existing Device/Profile settings are exposed when corresponding routes actually exist.
- [ ] No dead settings links are introduced.
- [ ] Existing Source CRUD/sync functionality is unchanged and remains usable.
- [ ] Navigation works with keyboard and has appropriate accessible labels.
- [ ] Responsive/mobile navigation is covered.
- [ ] Automated tests cover access to Sources and settings navigation on the relevant layouts.

## Regression origin

This is a follow-up to T059 / #125 (`Redesign web browsing with top navigation, immersive hero and shelf-first media pages`). T059 intentionally removed `LeftNav`, but the replacement `TopNav` currently contains no route to `/sources`, making an existing application capability effectively undiscoverable.
