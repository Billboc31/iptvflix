# T025 — Reuse canonical Series identity when syncing Plex and other providers

**Source**: GitHub Issue #50

## Description

## Objective

Ensure Series discovered from Plex or future sources are matched/reused as existing canonical Series whenever possible instead of creating duplicate canonical works per provider.

## Context / Problem

The current shared sync path resolves Movies through canonical identity evidence such as TMDB, but the Series path inserts a new canonical `series` row whenever a provider availability does not already exist. This means the same Series can become duplicated when it is already known from Xtream and later appears on Plex.

That violates the core product invariant: one canonical work, many source availabilities.

## Included

- Add a provider-independent canonical Series resolution step before inserting a new Series.
- Reuse reliable external identifiers from provider metadata when available (for example TMDB/other supported IDs).
- Reuse the existing Series matching/enrichment boundary for noisy/localized provider names where appropriate rather than introducing Plex-only matching rules.
- Persist the new provider item as another `series_availability` linked to the existing canonical Series when a confident match exists.
- Preserve ambiguous/low-confidence cases as unmatched/new candidates according to the existing matching policy rather than force-merging unrelated Series.
- Make the same resolution boundary reusable for future provider adapters.
- Ensure repeated sync is idempotent and does not create additional canonical Series rows.

## Acceptance Criteria

- [ ] A Series already known from Xtream can gain a Plex availability without creating a second canonical Series when reliable identity evidence matches.
- [ ] A Plex-only Series can still create/enter the canonical catalog when no existing canonical match is found.
- [ ] Matching does not rely on Plex-specific logic inside the canonical domain.
- [ ] Ambiguous same-title Series are not silently merged without sufficient evidence.
- [ ] Re-running the same Plex sync does not create duplicate canonical Series or duplicate availability mappings.
- [ ] Movie and Series resolution follow consistent provider-independent identity principles.
- [ ] Automated tests cover existing-Series reuse, Plex-only Series, same-title ambiguity and repeat synchronization.

## Excluded / Out of scope

- Full Season/Episode availability ingestion; tracked separately.
- Manual metadata correction UI.
- Recommendation logic.

## Dependencies

Builds on the existing title matching/external metadata pipeline and the Plex provider adapter.
