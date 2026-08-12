# T048 — Restore full green validation across build, typecheck and tests

**Source**: GitHub Issue #97

## Description

## Objective

Restore a trustworthy green validation baseline after the rapid multi-batch evolution of IPTVFlix, without masking genuine regressions or coupling production builds to test compilation.

## Context / Problem

Recent deployment work exposed stale TypeScript test helpers and test fixtures that no longer reflect the current provider/domain model (for example sources that now include XTREAM, M3U and PLEX). Some test artifacts have reported failures while AI Dev Factory still reached TEST_COMPLETE for ticket-scoped work.

Production build should compile production code only, while the repository's explicit typecheck/test gates must independently validate all maintained tests.

## Included

- Run the complete root/API/Web validation commands on current `main` and inventory every failure.
- For each failing test/type error, determine whether it represents a product regression or a stale expectation/type fixture.
- Update stale tests/helpers to reflect the current canonical/provider-independent model rather than weakening assertions indiscriminately.
- Fix genuine implementation regressions discovered by the full suite when they are small and directly related to the failing behavior.
- Ensure API production build excludes test-only source files through a dedicated build configuration, while test/typecheck commands still validate tests intentionally.
- Remove or replace brittle generated-cache-based signals as a source of truth.
- Document/standardize the commands that AI Dev Factory and CI should use for full validation.

## Acceptance Criteria

- [ ] Root production build is green on a clean checkout.
- [ ] API and Web typecheck commands are green with maintained test sources included where intended.
- [ ] Full automated test suite is green on current `main` or any intentionally environment-dependent tests are explicitly isolated with documented requirements.
- [ ] PLEX/M3U/XTREAM test fixtures use correct shared source typing rather than XTREAM-only helper inference.
- [ ] Existing title-matching/catalog-sync failures are either fixed as regressions or updated with justified current expectations.
- [ ] No test is deleted or skipped merely to make CI green without documented justification.
- [ ] AI Dev Factory/CI has a clear full-validation command whose non-zero exit code cannot be mistaken for TEST_COMPLETE.

## Excluded / Out of scope

- New product features.
- Large refactors unrelated to failing validation.
- Replacing the entire test framework.

## Dependencies

None. Can run in parallel with product work, but should finish before treating the next hosted release as stable.
