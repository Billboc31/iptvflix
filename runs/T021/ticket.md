# T021 — Introduce reusable manual and dynamic Shelves as the primary discovery composition model

**Source**: GitHub Issue #38

## Description

## Objective

Introduce `Shelf` as a reusable ordered grouping of canonical Media so Home and future discovery experiences can be composed consistently from system, manual and rule-driven shelves.

## Context / Problem

IPTVFlix needs a flexible presentation model for rows such as `Continue Watching`, `My List`, `New on IPTV`, `Available in French`, custom collections and future personalized recommendations. These should not each become unrelated bespoke frontend/backend implementations. A Shelf groups canonical Media; it never owns provider items directly.

## Included

- Define a Shelf model/contract with stable identity, title, type/origin, ordering and presentation hints where useful without coupling domain logic to one web layout.
- Support at least:
  - system shelves backed by existing product queries/state;
  - manual shelves whose Media membership/order is user-managed;
  - dynamic rule-based shelves using a constrained/validated filter definition over canonical catalog attributes and availability state.
- Ensure Shelf members reference canonical Media identities only.
- Provide profile-scoped CRUD for user-created shelves and membership where applicable.
- Allow useful dynamic filters supported by current data, such as media type, genre, release period, available-to-me, language/quality when variant data exists, and watch state where appropriate.
- Compose the web Home from the common Shelf rendering model while preserving existing functionality such as Continue Watching/My List.
- Keep shelf evaluation deterministic and backend-controlled; do not accept arbitrary SQL/query expressions from clients.
- Design the model so future recommendation/AI-generated shelves can supply/rank Media without changing the Shelf contract.

## Acceptance Criteria

- [ ] Home can render multiple rows through one reusable Shelf contract/component model.
- [ ] Existing `Continue Watching` and `My List` can be represented through the Shelf composition layer without losing behavior.
- [ ] A user can create a manual Shelf, add/remove canonical Media and control its order.
- [ ] A dynamic Shelf can be defined using validated supported rules and refreshes when matching catalog/availability data changes.
- [ ] Shelf membership never stores Xtream/Plex/provider item IDs as canonical members.
- [ ] Invalid/unsafe dynamic rules are rejected server-side.
- [ ] Shelf presentation hints do not embed provider-specific assumptions.
- [ ] The contract can later support AI/recommendation-generated shelves without schema replacement.
- [ ] Automated tests cover manual ordering, dynamic evaluation, profile isolation and invalid rules.

## Excluded / Out of scope

- LLM natural-language Shelf creation.
- Recommendation/taste scoring.
- Sharing shelves between users.
- Complex visual shelf editor.

## Dependencies

Follows #32. Dynamic availability/language filters can consume #33/#34 when available, but the core Shelf model and manual/system shelves can be developed independently against the existing canonical catalog.
