Implementation complete. Here's a summary:

---

## T005 — Implementation done

### What was built

**`apps/api/src/providers/xtream/`** — a fully isolated provider layer:

| File | Purpose |
|---|---|
| `types.ts` | Provider DTOs: `XtreamUserInfo`, `XtreamCategory`, `XtreamVodStream`, `XtreamSeries`, `XtreamSeriesInfo`, `XtreamCatalogSnapshot` |
| `errors.ts` | `XtreamAuthError`, `XtreamNetworkError`, `XtreamParseError` — distinct, catchable via `instanceof` |
| `client.ts` | `XtreamCodesClient` with `authenticate()`, `getVodCategories()`, `getVodStreams()`, `getSeriesCategories()`, `getSeries()`, `getSeriesInfo()`; `sanitizeUrl()` redacts credentials from all error messages |
| `index.ts` | Barrel re-export |
| `__tests__/client.test.ts` | 22 fixture-based Vitest tests |
| `__tests__/fixtures/` | 7 JSON fixtures including a 5 000-item large catalog (~800 KB) |

### Verification

- **22/22 tests pass** — auth success/failure/HTTP-401, VOD, series, malformed JSON, timeout, unreachable host, empty catalog, large catalog
- **No credential leakage** — `sanitizeUrl()` redacts `username`/`password` params; error messages tested explicitly
- **Type-clean** in the new subtree — one pre-existing `sources.test.ts` TS error inherited from T004 (unrelated)
- **Domain boundary respected** — no Xtream DTO imported outside `providers/xtream/`
