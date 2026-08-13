# T067 — Attach Xtream availability to canonical catalog entities

**Source**: GitHub Issue #134

## Description

Parent: #131

Refactor Xtream ingestion so provider records no longer define Movie/Show identity. Each provider movie or episode should resolve to a canonical catalog entity and create/update a playable provider variant.

Resolution order: use trustworthy provider TMDB IDs when present; otherwise normalized title/year/type matching; if the canonical entity is not local, resolve against TMDB and import the matched entity before attaching availability.

Keep provider-specific metadata separate: source account, provider IDs, playback reference, language, quality/resolution, container/codec when known, raw provider title for diagnostics, and availability/last-seen timestamps.

Multiple provider entries for one work must become variants under one canonical card. Dirty provider titles must never overwrite canonical display metadata.

Unresolved or ambiguous entries need an explicit observable/retryable state rather than silently creating duplicate canonical media.

Apply the same model to TV episodes by resolving canonical show/season/episode first.

Acceptance criteria:
- Valid TMDB IDs attach to canonical entities.
- Missing local canonical entities are imported before linking.
- Missing provider IDs use normalized matching and remote resolution.
- Languages/qualities become variants on one card.
- Canonical titles remain clean.
- Ambiguous records are observable/retryable.
- Movie and TV ingestion use the same separation.
- Re-sync is idempotent and tracks stale availability.
