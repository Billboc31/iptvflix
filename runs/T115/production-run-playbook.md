# T115 — Production Run Playbook

**Status**: Code complete, pending human-executed production run  
**Created**: 2026-08-19  
**Branch**: `ticket/T115-complete-catalog-enrichment-and-make-refresh-failu`

---

## Why this document exists

The ticket completion rule requires:

> "Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."

The coder AI cannot access the production environment. This playbook gives the human operator exact steps to execute and capture the required artifact.

---

## Pre-flight checklist

- [ ] Branch deployed to production (or production DB restored locally with correct `DATABASE_URL`)
- [ ] Migrations applied: `node scripts/migrate-safe.mjs` — should apply 0044, 0045, 0046, 0047
- [ ] API server running and reachable (confirm `GET /health` returns 200)
- [ ] TMDB API key configured and valid
- [ ] Admin credentials available

---

## Step 1 — Verify migrations ran

```bash
# Expected: 4 new entries at idx 44-47
psql $DATABASE_URL -c "SELECT tag FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 10;"
```

Expected output includes:
- `0044_t107_shelf_served_at`
- `0045_t114_profile_taste_disliked_not_interested`
- `0046_t115_catalog_refresh_runs_type`
- `0047_t115_enrichment_failures`

Verify the `enrichment_failures` table exists:
```bash
psql $DATABASE_URL -c "\d enrichment_failures"
```

---

## Step 2 — Capture before state

```bash
curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-stats | jq .
```

Save the response as the **BEFORE** snapshot. Key fields to note:
- `movies.total`, `movies.neverEnriched`, `movies.partiallyEnriched`, `movies.failedLastEnrichment`
- `series.total`, `series.neverEnriched`, `series.partiallyEnriched`, `series.failedLastEnrichment`

---

## Step 3 — Start the enrich-missing run

```bash
curl -s -X POST \
  -u admin:$ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "concurrency": 3, "throttleMs": 500}' \
  https://api.iptvflix.com/admin/catalog-enrich-missing | jq .
```

Note the `runId` from the response.

For the known 126 production failures, also retry them explicitly after the main run:
```bash
curl -s -X POST \
  -u admin:$ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{}' \
  https://api.iptvflix.com/admin/catalog-enrich-missing/retry-failures | jq .
```

---

## Step 4 — Monitor progress

Poll until `status: "COMPLETED"`:
```bash
watch -n 30 'curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-enrich-missing/status | jq .'
```

Expected fields to monitor:
- `stats.processed` / `stats.totalEligible`
- `stats.failedTerminal`
- `stats.ratePerMinute`
- `stats.etaSeconds`

---

## Step 5 — Capture after state

```bash
curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-stats | jq .
```

Save as the **AFTER** snapshot.

---

## Step 6 — Capture terminal failures

```bash
curl -s -u admin:$ADMIN_PASSWORD \
  "https://api.iptvflix.com/admin/catalog-enrich-missing/failures?limit=200" | jq .
```

Each row must contain:
- `mediaType`, `mediaId`, `tmdbId`, `title`
- `stage` (fetch / map / db_update)
- `errorClass`, `errorCode`, `errorMessage` — the real DB/driver error
- `retryCount`, `occurredAt`, `retryable`

The 126 known production failures should appear here if they are terminal. For `Les Chevaliers du Fiel : L'assassin est dans la salle` specifically, note the `errorClass` and `errorMessage` to understand the root cause.

---

## Step 7 — Write the production run artifact

Create `runs/T115/production-run-YYYYMMDD.md` with:

```markdown
# Production Run — T115 Enrich-Missing — YYYY-MM-DD

## Before stats
[paste JSON output from Step 2]

## Run
[paste runId and POST response]

## After stats
[paste JSON output from Step 5]

## Terminal failures
[paste JSON output from Step 6]

## Analysis
[note: how many of the 126 original failures were resolved vs. remain terminal]
[note: root cause for Les Chevaliers du Fiel if still failing]
```

---

## Known failure classes to watch for

Based on the ticket context and the normalization code:

| TMDB value | Normalized to | DB constraint risk |
|---|---|---|
| `runtime: 0` | `runtimeMinutes: null` | Resolved — code normalizes to null |
| `imdb_id: ""` | `imdbId: null` | Resolved — code normalizes to null |
| `overview: "  "` | `synopsis: null` | Resolved — code normalizes to null |
| `null` metadata (404) | terminal failure | Expected — logged in enrichment_failures |

If new failure classes appear in the terminal failures list, note the `errorClass` and `errorMessage` to understand if additional normalization is needed.

---

## Escalation path

If terminal failures include a `stage: "db_update"` error with `errorClass: "PostgresError"`, inspect the `errorMessage` for the actual constraint name — this is the root cause the ticket was asking to expose (previously only the failed SQL string was logged, not the real error).

If any titles remain permanently unresolvable (e.g., TMDB has no entry for a French IPTV-only title), document them with their `mediaId` and `title` — they can be excluded from the embedding corpus via the `failedLastEnrichment` filter.
