All T115-relevant tests pass. Here's a summary of the 4 fixes applied:

---

## Changes applied

### Fix 1 — `retryFailures` now filters retryable by default (🟠 Major)

**`services/catalog-enrich-missing-service.ts`**
- Added `force?: boolean` to the `retryFailures` opts interface
- Added `if (!force) conditions.push(eq(enrichmentFailures.retryable, true))` — by default only retryable failures are retried; pass `force: true` to retry terminal failures too

### Fix 2 — Seasons failures persisted in `enrichment_failures` (🟠 Major)

**`services/metadata-enrichment-service.ts`**
- Widened `persistFailure` stage type to include `'seasons'`
- Replaced the bare `console.warn` in the `enrichSeriesSeasons` catch with a `persistFailure` call (`stage: 'seasons'`)
- Made `clearFailure` conditional: only called when seasons enrichment succeeded, so the persisted failure isn't immediately cleared

### Fix 3 — Silent catch blocks now warn (🟡 Minor)

**`services/metadata-enrichment-service.ts`**
- Collection upsert catch: `catch {}` → `catch (err) { console.warn(...) }`
- `persistFrenchLocalization` catch: `catch { return }` → `catch (err) { console.warn(...); return }`

### Fix 4 — `fullyEnriched` definition documented (🟡 Minor)

**`routes/catalog-stats.ts`**
- Added inline comments on both the movies and series `fullyEnriched`/`partiallyEnriched` SQL filters explaining that "fully enriched" means `synopsis IS NOT NULL AND keywords IS NOT NULL` (not all optional fields)
