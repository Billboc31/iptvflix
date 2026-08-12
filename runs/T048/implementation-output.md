`pnpm validate` exits 0. All three gates are green. Implementation is complete.

---

**Summary of changes**

| File | Change |
|---|---|
| `apps/api/src/services/__tests__/catalog-sync-service.test.ts` | Removed duplicate `name` and `stream_id`/`series_id` property assignments in `makeVodStream`/`makeSeriesEntry` (TS2783 — value was overwritten by the trailing spread anyway) |
| `apps/api/src/routes/__tests__/feedback.test.ts` | Widened `setupUpsert` parameter type to accept `mediaType: 'MOVIE' \| 'SERIES'` instead of only `'MOVIE'` (TS2322 — SERIES rows are a valid fixture) |
| `apps/api/src/__tests__/integration/vertical-slice.test.ts` | Added `FastifyInstance` named import; changed `discoveryApp` declaration from `ReturnType<typeof Fastify>` to `FastifyInstance` so `.inject()` response carries a generic `.json<T>()` signature (TS2347) |
| `package.json` | Added `"validate": "pnpm build && pnpm typecheck && pnpm test"` root script |
| `.github/workflows/ci.yml` | Added `pnpm build` step before typecheck in the `test` job |
| `docs/validation.md` | Created — documents the three gates, environment requirements, and the TEST_COMPLETE rule |
