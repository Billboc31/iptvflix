# T034 — Enforce maxVideoQuality as a real playback cap

**Source**: GitHub Issue #62

## Description

## Objective

Make `maxVideoQuality` behave as an actual upper playback limit when resolving the preferred availability.

## Context / Problem

The profile UI presents this field as **Qualité vidéo maximale**, but the current resolver only clamps the quality score. A 4K variant can therefore tie with a 1080p variant when the configured maximum is 1080p and still win on the deterministic id tie-break.

That means the selected variant may exceed the user's configured maximum.

## Included

- Define and enforce clear maximum-quality semantics in the backend availability resolver.
- Keep unknown-quality variants usable as deterministic fallbacks when appropriate instead of silently discarding them without a defined rule.
- Preserve the existing priority order between language, subtitles, source preference and quality unless explicitly required by the cap semantics.
- Ensure the frontend continues to rely on backend resolution rather than duplicating the rule.

## Acceptance Criteria

- [ ] With `maxVideoQuality = 1080p`, a known 4K-only candidate is not selected over an otherwise usable candidate at or below 1080p.
- [ ] 720p/1080p/4K caps behave consistently.
- [ ] `maxVideoQuality = null` keeps the current no-limit behavior.
- [ ] Unknown quality has documented deterministic fallback behavior.
- [ ] Existing language/source priority semantics remain intact.
- [ ] Automated tests cover above-cap, below-cap, no-cap, unknown-quality and tie scenarios.

## Dependencies

Builds on the availability resolver introduced by #35.
