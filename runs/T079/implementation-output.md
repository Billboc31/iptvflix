All 38 T079 tests pass (22 compat + 7 probe-cache + 9 stream-compat). Pre-existing failures are unchanged.

**Changes made:**

**`apps/api/src/services/playback-compat.ts`** — line 35:  
Added `isMp4Container` guard to the HEVC+AAC+Safari branch. MKV/TS HEVC+AAC now routes to `REMUX` instead of wrongly returning `DIRECT`.

**`apps/api/src/__tests__/playback-compat.test.ts`** — replaced one bad test with two correct ones:
- `MP4 + HEVC + AAC, Safari iOS → DIRECT` (was already in MP4)
- `MKV + HEVC + AAC, Safari iOS → REMUX` (needs remux to fMP4)

The fix is minimal — one line added in the service, one test split into two. No other behavior changed.
