# T066 — Add scheduled refreshes for the canonical catalog

**Source**: GitHub Issue #133

## Description

Parent: #131

Keep the local canonical catalog fresh automatically without rebuilding everything each night.

Add scheduled incremental refresh jobs. Refresh upcoming/current releases, airing shows and volatile discovery metadata more frequently; refresh stable older content less often. Discover new titles that satisfy catalog inclusion rules.

Track per-entity sync timestamps and job checkpoints. Processing must be idempotent, resumable and observable. Failures should retry safely and must not prevent the API from serving existing catalog data.

Use a nightly scheduler as a sensible default while allowing different freshness windows by media state/type.

Acceptance criteria:
- Catalog refreshes automatically.
- Upcoming/recent/airing content stays fresh.
- Stable content is not unnecessarily refreshed every night.
- Newly relevant titles can be imported.
- Job status/counts/errors/last-run are observable.
- Interrupted jobs resume without duplicates.
- Scheduling can be configured or disabled.
