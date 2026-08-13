All 17 playback resolver tests pass. Both fixes are clean:

**Fix 1 — 🔴 HLS cleanup (`PlayerPage.tsx:29-57`):** Added `cancelled` flag and `hlsInstance` reference in the effect scope. The cleanup now calls `hlsInstance?.destroy()` and sets `cancelled = true` before the async import resolves, preventing both the memory leak and the race condition on variant switch.

**Fix 2 — 🟡 PLEX silent fallback (`playback-resolver.ts:131-142`):** Changed the bare `else` to `else if (source.type === 'M3U')` with an explicit `else { throw new ValidationError('Variant not available') }`, so any unsupported source type (e.g. PLEX) gets a clean error instead of silently misusing `providerItemId`.
