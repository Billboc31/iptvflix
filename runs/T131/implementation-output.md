All 17 tests pass. Two fixes applied:

1. **`channel-normalizer.ts:29`** — `replace(/[._]/g, ' ')` → `replace(/_/g, ' ')`: dots are now preserved, so `M.6` normalizes to `m.6` as expected.
2. **`channel-normalizer.test.ts:54`** — corrected the assertion from `'bfm  tv'` to `'bfm tv'`, matching the actual collapse behavior of `replace(/\s+/g, ' ').trim()`.
