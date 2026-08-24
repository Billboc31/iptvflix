# T125 — Build personalized Home page with production shelf rails

**Source**: GitHub Issue #266

## Description

## Context

The semantic + hybrid personalized shelf pipeline is now good enough to move from diagnostics/benchmarking into the real IPTVFlix product experience.

We want the **Accueil / Home** page to become the main personalized discovery surface, Netflix-style: multiple horizontal rails mixing useful product shelves and recommendation shelves rather than exposing recommendation diagnostics.

This ticket is the first production integration of the shelf/recommendation engine into the Home UI.

## Goal

Build the Home page infrastructure for horizontally scrollable content shelves and populate an initial set of personalized rails using real catalog/user data.

Initial Home order:

1. **Continuer à regarder** — movies/episodes with playback progress, when non-empty.
2. **Pour toi** — strongest general personalized recommendations.
3. **Nouveautés pour toi** — recent/new catalog content reranked for the user.
4. **One dynamic editorial/personalized thematic shelf** — e.g. concepts generated/selected by the existing shelf system such as « Aventures à travers le temps », « Action sans temps mort », « SF qui fait réfléchir ». This must use the generic shelf pipeline, not hardcoded movie lists.
5. **Films pour toi** — personalized movie-only recommendations.
6. **Séries pour toi** — personalized series-only recommendations.

Empty shelves must simply not render.

## UX

- Netflix-like horizontal poster rails suitable for TV and responsive web/mobile.
- Each rail has a clear human-readable title.
- Poster cards reuse existing content/navigation behavior where possible rather than creating a parallel detail flow.
- Horizontal navigation must work correctly with TV remote/focus as well as touch/mouse.
- Keep the Home experience consumer-facing: semantic diagnostics, raw vector scores, reranker tags and internal scoring explanations must not appear in normal Home UI.
- Loading/error states should degrade gracefully and should not block unrelated shelves.

## Recommendation behavior

- Use the existing semantic/hybrid personalization pipeline rather than implementing a second recommendation engine for Home.
- Preserve media-type constraints for movie-only / series-only shelves.
- `Continuer à regarder` is behavioral/product data and should not be reranked as a semantic discovery shelf.
- `Nouveautés pour toi` should combine recency/catalog freshness with personalization rather than simply listing all newest content chronologically.
- The dynamic thematic shelf should be replaceable/rotatable without frontend code changes.

### Cross-shelf diversity

Avoid making Home look like the same 10–20 titles repeated in every rail.

Introduce a generic cross-shelf diversity policy for discovery shelves: titles already shown prominently in an earlier Home shelf should receive an exclusion or strong attenuation in subsequent shelves when enough alternative relevant candidates exist. Do not sacrifice shelf relevance merely to force uniqueness.

`Continuer à regarder` is exempt: a currently watched title may legitimately coexist with discovery/history surfaces where product logic requires it.

## Prepare for upcoming watch/feedback model

Do not require the full watched/like/dislike feature in this ticket, but design the Home shelf/card contracts so they can later consume user-content state without a rewrite:

- unseen
- seen / neutral
- liked
- disliked
- playback progress

Future behavior will generally remove already-seen titles from discovery shelves while allowing liked/seen titles to appear in a dedicated **À revoir** shelf. Do not build `À revoir` yet unless the underlying state already makes it trivial.

## Architecture

- Prefer a reusable shelf/rail component and declarative Home shelf configuration over six bespoke sections.
- Backend/API should expose the data needed by the Home page in a way that does not require the client to understand recommendation internals.
- Avoid N+1 catalog calls and avoid independently recomputing expensive profile/recommendation context for every shelf when context can safely be shared within the request.
- Preserve existing diagnostic/preview tooling for development; this ticket is about consuming the engine in the production UI, not removing the tooling.

## Acceptance criteria

- Home renders the six initial shelf types above when data exists.
- Shelves are horizontal poster rails and usable on Android TV/TV focus navigation and responsive web/mobile.
- `Pour toi`, `Nouveautés pour toi`, the dynamic thematic shelf, `Films pour toi`, and `Séries pour toi` use the current personalization/recommendation architecture.
- Dynamic thematic shelf content is generic/data-driven and not a hardcoded movie list.
- Movie and series constraints are respected.
- Empty/erroring individual shelves do not break the whole Home page.
- Internal recommendation diagnostics are absent from consumer Home.
- Cross-shelf duplication is materially reduced while preserving relevance.
- Existing recommendation diagnostics/preview functionality continues to work.
- Add automated tests for shelf composition/order, media-type constraints, empty/error cases, and cross-shelf diversity.
- No manual production DB changes and no title-specific/shelf-specific recommendation hacks.
