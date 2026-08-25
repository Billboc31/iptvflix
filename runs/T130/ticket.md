# T130 — Create standalone IPTVFlix Live TV app and independent deployment

**Source**: GitHub Issue #277

## Description

## Context

IPTVFlix VOD is now a mature, personalized experience. Live TV should become a **separate deployable application** within the same monorepo so the TV/web-live surface can evolve and deploy independently from the VOD web app.

The target UX is a dedicated Live TV interface, visually consistent with IPTVFlix but using an orange accent and a TV-first information architecture.

## Visual target

Use this mockup as the primary visual reference for the Live TV app:

![IPTVFlix Live TV target](https://raw.githubusercontent.com/Billboc31/iptvflix/main/CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png)

Source: `CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png` at repository root.

The implementation does not need to pixel-copy every detail, but the overall hierarchy, density, orange/black visual language, sidebar, top VOD/TV switch and channel-card treatment should follow this reference closely.

## Goal

Create a new standalone Live TV application in the monorepo, e.g. `apps/live-tv`, with its own build/deploy target and runtime URL.

## Architecture

- Reuse shared packages, authentication/session/profile contracts and API clients where appropriate.
- Do **not** duplicate core auth/profile/channel-domain logic in the new app.
- Keep the Live TV frontend independently buildable and deployable from the existing VOD web app.
- Add a dedicated Railway deployment/service (or repository config needed for one) for the Live TV app.
- Changes to Live TV should not require redeploying the VOD frontend unless shared code genuinely changed.
- Preserve monorepo conventions and shared tooling.

## Navigation / product shell

- Add a clear **VOD / TV** mode switch matching the visual reference.
- VOD routes/users should be able to navigate into Live TV without a confusing re-login flow where current auth architecture permits it.
- Live TV app should have its own top-level navigation and sidebar foundation ready for:
  - Accueil TV
  - Favoris
  - Récemment regardées
  - Guide TV
  - Toutes les chaînes
  - category navigation
- Orange is the primary accent for Live TV; keep dark IPTVFlix base styling.

## Deployment

- Add/document the independent production build command and root directory/service configuration.
- Ensure the deployment can target Railway independently from the API, VOD web and recommendation engine.
- Environment variables must be scoped/documented; avoid copying secrets into source.
- Add a lightweight health/smoke route/page so deployment success is obvious.

## Acceptance criteria

- A standalone Live TV app exists in the monorepo and builds independently.
- The app has a separate deploy target suitable for a new Railway service.
- VOD/TV switch is present and navigation foundation matches the visual target.
- Shared auth/profile contracts are reused rather than duplicated.
- Live TV visual shell follows the black + orange mockup.
- Existing VOD web, API and recommendation-engine builds/deployments do not regress.
- Add basic automated/smoke coverage for app boot, routing and VOD/TV navigation.
- No manual production DB changes.
