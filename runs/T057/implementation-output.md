All changes look correct. Here's the summary:

---

## Fix summary

**Blocking issue resolved (AC #5 — progressMs wiring):**

- `MovieDetailPage.tsx`: Now calls `fetchContinueWatching()` in parallel with `getMovie()` via `Promise.allSettled`. Finds the matching `MOVIE` item, converts `progressSeconds × 1000 → progressMs`, and passes it to `DevicePickerModal`. If continue-watching fails, the toggle is gracefully hidden (progressMs stays 0).

- `SeriesDetailPage.tsx`: Fetches continue-watching on mount, builds a `progressByEpisodeId: Record<string, number>` map from `EPISODE` items, passes it to `SeasonAccordion`.

- `SeasonAccordion.tsx`: New `progressByEpisodeId?` prop, threads `progressByEpisodeId?.[ep.id] ?? 0` to each `EpisodeRow`.

- `EpisodeRow.tsx`: New `progressMs?: number` prop (default 0), forwarded to `DevicePickerModal`.

**Minor fixes:**

- `LeftNav.tsx`: "Appareils TV" icon changed from 📺 to 🖥️ (was duplicate with "Séries").
- `ProfileSettingsPage.tsx`: Added "Appareils TV" card with a "Gérer →" link to `/settings/devices`.
- `ProfileSettingsPage.test.tsx`: Wrapped all renders in `MemoryRouter` (required by the new `Link`).
- `EpisodeRow.test.tsx`: Added 3 new tests — TV button visible with devices, hidden without, hidden for unavailable episodes.

**Result**: 157 tests pass (was 154; +3 new).
