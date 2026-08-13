# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T071/reviews/implementation-review.md
- generated at: 2026-08-13T21:35:51Z

---

Now I have the full picture. Let me write the structured review.

---

# PR Review — T071 Immersive responsive Movie & Series detail experience

## Global assessment

The implementation correctly delivers the main architectural decision (route-based full-viewport pages instead of a modal overlay), the shared component library, and all primary acceptance criteria. Tests are comprehensive and well-structured. Two issues require fixes before approval: a real functional bug in `SeasonSelector` state lifecycle and dead-code components not in the plan.

---

## Blocking issues

### B1 — `SeasonSelector` stale episode cache when navigating between series (FUNCTIONAL BUG)

**File**: `apps/web/src/components/detail/SeasonSelector.tsx`

When the user clicks a series card in `SimilarTitlesShelf`, React Router reuses the `SeriesDetailPage` component (route params change, component stays mounted). `SeriesDetailPage` fetches the new series and passes new `seasons` to `SeasonSelector`. However `SeasonSelector`'s local state is not reset:

- `selectedSeason` retains the previously selected season number
- `episodeCache` retains the previous series' episodes

The `useEffect` (line 22–29) guards with `if (episodeCache.has(selectedSeason)) return`. If series-1 had loaded season 1, and the user navigates to series-2 (which also has season 1), the cache hit causes the old series-1 episodes to be displayed for series-2's season 1. This is stale data displayed silently.

**Affected acceptance criterion**: *"Clicking a similar title opens its detail experience correctly."*

**Fix** — add `key={series.id}` to `SeasonSelector` in `SeriesDetailPage.tsx` (line 169):

```tsx
<SeasonSelector
  key={series.id}   // forces remount on series change, clears stale cache
  seriesId={series.id}
  seasons={series.seasons}
  profileId={profileId}
  devices={devices}
  progressByEpisodeId={progressByEpisodeId}
/>
```

---

### B2 — Dead code outside plan scope: `EpisodeRow`, `SeasonAccordion`, `TrailerPlayer`

**Files**:
- `apps/web/src/components/detail/EpisodeRow.tsx` + `EpisodeRow.test.tsx`
- `apps/web/src/components/detail/SeasonAccordion.tsx` + `SeasonAccordion.test.tsx`
- `apps/web/src/components/detail/TrailerPlayer.tsx` + `TrailerPlayer.test.tsx`

None of these are imported by any page or component. Confirmed via grep: they are only imported within their own test files and from each other. `TrailerPlayer` duplicates the inline trailer logic in `MediaHero`; `SeasonAccordion` + `EpisodeRow` are an alternative to the planned `SeasonSelector` + `EpisodeCard` that the plan explicitly chose against.

The plan listed the new components precisely. These additions are scope creep — unused code that increases bundle weight and creates false signal in the test suite (tests pass for code that ships but is never exercised in production).

**Required action**: delete all six files.

---

## Non-blocking observations

### O1 — Episode still images: emoji placeholder instead of actual stills

`EpisodeCard.tsx:33–35` renders `🎬` emoji for all episode stills. The ticket (§10) explicitly lists "still image" as a required field for episode cards. The test at `EpisodeCard.test.tsx:69–73` documents and asserts the emoji placeholder, making this a committed compromise.

If `EpisodeResponse` includes a `stillUrl` or `stillPath` field in the API contract, the implementation should render it with an `<img>` fallback to the emoji. If the field does not yet exist in the contract, this should be noted as a follow-up.

### O2 — Missing ticket metadata fields in `MediaMetadata`

The ticket (§4) lists production country, original language, collection/franchise, and creators as examples of rich metadata. None of these appear in `MediaMetadata.tsx`. The ticket uses the word "examples" and states "Missing metadata should simply disappear gracefully," so this is acceptable if those fields are absent from the current API contract. If the contract exposes them, they should surface here.

### O3 — Images missing `loading="lazy"`

Cast member images in `CastRow.tsx:30` and the poster overlay in both page files do not have `loading="lazy"`. These are below the fold and would benefit from it. The hero backdrop/poster should remain eager (above the fold). Minor performance gap.

### O4 — Duplicate `DetailSkeleton` component

`MovieDetailPage.tsx:19–43` and `SeriesDetailPage.tsx:18–41` define identical inline `DetailSkeleton` functions. This is minor code duplication that could be shared, but since the plan didn't flag it and both are in the same file scope, it's low priority.

### O5 — `CastRow` React key uses array index

`CastRow.tsx:22`: `cast.map((member, i) => <div key={i}>`. If cast order ever changes (re-render with different ordering), React may produce unnecessary DOM mutations. Use `member.name` as the key (stable, unique enough for cast lists).

---

## Positive notes

- The fallback chain in `MediaHero` (backdrop → poster → neutral gradient, error-state driven) is clean and correctly implemented.
- `SimilarTitlesShelf` correctly uses a staleness flag in `useEffect` to prevent race conditions on rapid navigation.
- `AvailabilityPanel` is hidden cleanly when `sources = []` without any empty-container anti-pattern.
- The `MediaActions` behavior for `series` (no `playRoute` passed, no broken play button) is correct.
- Test coverage is high and well-structured, including MSW handler overrides per test case.
- API additions (`getSimilarMovies`, `getSimilarSeries`) and MSW fixtures follow established project patterns exactly.

---

## Required actions summary

| # | Severity | Action |
|---|----------|--------|
| B1 | **Blocking** | Add `key={series.id}` to `<SeasonSelector>` in `SeriesDetailPage.tsx` |
| B2 | **Blocking** | Delete `EpisodeRow.tsx`, `SeasonAccordion.tsx`, `TrailerPlayer.tsx` and their test files (6 files total) |
| O1–O5 | Observation | Address in this ticket or follow-up at team discretion |

IMPLEMENTATION_FIX_REQUIRED
