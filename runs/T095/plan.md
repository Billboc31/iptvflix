Now I have everything I need. Let me write the plan.

## Objective

Upgrade every Continue Watching card with three distinct interaction zones (central direct-resume Play, Details ⓘ, overflow ⋮ menu), introduce a persisted profile-level dismissal mechanism ("Supprimer de Reprendre"), enrich episode cards with season/episode identity, and ensure the progress bar is computed from `savedPlaybackSeconds / trueMediaDuration` throughout.

## Included

### Backend — DB & service

**1. New schema file** `apps/api/src/db/schema/continue-watching-dismissals.ts`
Table `continue_watching_dismissals`: `id` (uuid PK), `profileId` (FK→profiles, cascade delete), `mediaType` (reuse `progress_media_type` enum), `mediaId` (uuid), `dismissedAt` (timestamptz default now). Unique constraint on `(profileId, mediaType, mediaId)`.

**2. Drizzle migration** — add `continue_watching_dismissals` table.

**3. Schema export** — register new table in `apps/api/src/db/schema/index.ts`.

**4. Extend `ContinueWatchingItem`** in `packages/api-contracts/src/user-state.ts`:
```ts
seriesId: string | null        // parent series for EPISODE items
seasonNumber: number | null
episodeNumber: number | null
episodeTitle: string | null
```
Movie items carry `null` for all four fields.

**5. `listContinueWatching` in `apps/api/src/services/viewing-progress-service.ts`**
- Episode batch query: extend `SELECT` to fetch `episodes.episodeNumber`, `episodes.title`; add a JOIN to `seasons` to fetch `seasons.seasonNumber`.
- Filter: exclude any `viewingProgress` row that has a matching row in `continue_watching_dismissals` for the same `(profileId, mediaType, mediaId)`. Implement as a `NOT EXISTS` subquery or LEFT JOIN + IS NULL.
- Build and return enriched `ContinueWatchingItem` with the four new fields.

**6. New `dismissContinueWatching(profileId, mediaType, mediaId)` in viewing-progress-service.ts**
INSERT INTO `continue_watching_dismissals` ON CONFLICT DO UPDATE SET `dismissedAt = now()` (idempotent).

**7. `upsertProgress` update** — after a successful upsert, if the resulting `progressSeconds >= durationSeconds * 0.05` (item is now meaningfully in-progress), DELETE any existing row from `continue_watching_dismissals` for `(profileId, mediaType, mediaId)`. This is the re-entry rule.

**8. New API route** in `apps/api/src/routes/viewing-progress.ts`:
`DELETE /continue-watching/:mediaType/:mediaId` → validates mediaType, calls `dismissContinueWatching`, returns 204.

**9. Backend tests** in `apps/api/src/routes/__tests__/viewing-progress.test.ts`:
- `DELETE /continue-watching/MOVIE/:id` persists dismissal; item absent from subsequent `GET /continue-watching`.
- Dismissal cleared when `PUT /progress` saves new progress ≥ 5% threshold; item re-appears in CW.
- Dismissing one episode does not affect other episodes of the same series.
- Episode items in `GET /continue-watching` include `seriesId`, `seasonNumber`, `episodeNumber`, `episodeTitle`.
- Movie items return `null` for all episode fields.

---

### Frontend — components & hook

**10. API client `apps/web/src/lib/api.ts`**
Add `dismissContinueWatching(mediaType: ProgressMediaType, mediaId: string): Promise<void>` → `DELETE /continue-watching/:mediaType/:mediaId`.

**11. Extend `useContinueWatching` hook** (`apps/web/src/hooks/useContinueWatching.ts`)
- Return `dismissItem(mediaType, mediaId)` function: optimistically remove item from `items` state, call `dismissContinueWatching`, restore item on failure and surface error.

**12. New `ContinueWatchingCard` component** `apps/web/src/components/content/ContinueWatchingCard.tsx`

Layout:
```
┌──────────────────────────┐
│  poster (aspect-2/3)     │
│  gradient overlay        │
│       ▶ (large)          │  aria-label="Reprendre"
│                          │
│ S02E05 · Episode Title   │  (episodes only, single line truncated)
├──────────────────────────┤
│ ━━━━━━━━░░░░░░░  ⓘ  ⋮   │
└──────────────────────────┘
```

- Central Play `<button>`: navigates to PlayerPage with query param `?source=continue_watching` (direct resume, no #194 dialog).
- Progress bar: `width = (progressSeconds / durationSeconds) * 100%` — no buffered/loaded duration.
- `ⓘ` button (aria-label="Voir les détails"): opens Movie detail modal (mediaId) OR Series detail modal (`seriesId`) using existing detail page components.
- `⋮` button (aria-label="Plus d'options"): toggles `ContinueWatchingOverflowMenu`.
- All three interactive zones are keyboard-focusable on desktop; touch targets ≥ 44×44 px.
- Episode subtitle: "S{seasonNumber}E{episodeNumber} · {episodeTitle}" (omit episode title if null).

**13. New `ContinueWatchingOverflowMenu` component** `apps/web/src/components/content/ContinueWatchingOverflowMenu.tsx`

- Desktop: positioned dropdown (role="menu", menuitem roles), closes on Escape / click-outside, focus returns to `⋮` on close.
- Mobile: bottom sheet (fixed overlay, tap-outside or swipe to dismiss), using existing `MediaDetailShell` portal or a minimal equivalent.
- Menu items:
  - "Détails" (mirrors ⓘ action for discoverability).
  - "Supprimer de Reprendre" — calls `dismissItem`, menu closes, card disappears optimistically; toast or inline error on rollback.

**14. `ContinueWatchingRow.tsx`**
Replace the ad-hoc `<PosterCard>` + progress bar JSX with `<ContinueWatchingCard item={item} onDismiss={dismissItem} />` per item. Remove the inline `pct` calculation (moved into card).

**15. PlayerPage** — add a guard: if `?source=continue_watching` is present in the URL, set a local flag that suppresses the #194 resume/restart dialog when it is eventually wired. This is a no-op today (dialog not implemented) but prevents the dialog from blocking CW resumes after #194 lands.

**16. Frontend tests** `apps/web/src/components/content/__tests__/ContinueWatchingCard.test.tsx`:
- Play button navigates with `source=continue_watching`; no resume dialog shown.
- ⓘ opens MovieDetailPage for MOVIE items.
- ⓘ opens SeriesDetailPage for EPISODE items using `seriesId`.
- Episode label renders "S02E05 · Episode Title"; absent for MOVIE.
- ⋮ opens overflow menu; "Supprimer de Reprendre" triggers `dismissItem`.
- Optimistic removal: item disappears immediately; reappears on API failure with error feedback.
- Progress bar width matches `progressSeconds / durationSeconds` (not buffered duration).

---

## Excluded

- Implementing the #194 "Reprendre ou Recommencer" dialog itself (separate ticket; CW guard is a stub only).
- Adding "Ma liste" or rating/feedback actions to the overflow menu (optional per ticket; deferred to keep scope bounded).
- Changing seek-clamping or fallback logic inside PlayerPage (existing resolver behavior already returns `startPositionSeconds`; out-of-range seeks handled by existing player).
- TrailerKey resolution changes.
- Series-level or bulk dismissal (per ticket: removing an episode removes that entry only).
- Playlist / next-episode auto-play logic.
- Any changes to the completion threshold (5% / 90%) — existing service logic already implements completion cleanup.

---

## Acceptance criteria

- Every Continue Watching card renders three distinct action zones (Play, ⓘ, ⋮); no action is hidden behind hover only on desktop.
- Central Play navigates to the player with `source=continue_watching`; the #194 resume dialog is never shown for this path.
- Movie card: player resumes at stored `progressSeconds` of the movie.
- Episode card: player resumes the exact episode at its stored `progressSeconds`.
- Progress bar width = `progressSeconds / durationSeconds`; value is stable on re-open and does not change as the stream buffers.
- ⓘ on a Movie card opens `MovieDetailPage` for that movie.
- ⓘ on an Episode card opens `SeriesDetailPage` using the item's `seriesId`.
- Episode cards display "S{n}E{n} · {title}" label (title optional if null); movie cards display no episode label.
- ⋮ opens an accessible menu (role="menu") with at least "Supprimer de Reprendre".
- `DELETE /continue-watching/:mediaType/:mediaId` returns 204 and the item is absent from subsequent `GET /continue-watching` responses on any device for the same profile.
- Dismissal does not alter `viewing_progress` rows; watch history is preserved.
- After new `PUT /progress` saves ≥ 5% progress for a dismissed item, `GET /continue-watching` includes it again.
- Dismissing episode A does not remove episode B of the same series from Continue Watching.
- All tests listed in §9 and §16 pass.
- Manual validation: one partially watched Movie and one partially watched Episode — both appear with stable progress bars; Play resumes each at the saved position; ⓘ opens the correct detail UI; ⋮ → "Supprimer de Reprendre" removes the item; item stays absent after page reload; starting meaningful playback again makes it eligible to return.
