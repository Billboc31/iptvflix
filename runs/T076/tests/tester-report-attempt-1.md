# T076 — Test Report (Attempt 1)

**Date**: 2026-08-14
**Branch**: ticket/T076-replace-home-featured-card-with-a-full-width-cinem

---

## Acceptance Criteria Status

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Home featured content is a large cinematic full-width Hero | ✅ PASS | `HeroSection`: `h-[60vh] md:h-[85vh]`, `overflow-hidden`, full-width |
| 2 | Desktop Hero occupies the visual top of Home beneath/with the existing top nav | ✅ PASS | `HomePage.tsx`: HeroSection rendered before shelves, no top margin pushing it down |
| 3 | Hero uses preview video when supported/available | ✅ PASS | `PreviewPlayer` with YouTube iframe, 2s delay autoplay; `trailerKey` prop wired |
| 4 | TMDB backdrop is primary static fallback; poster is graceful secondary fallback | ✅ PASS | Desktop: `backdropUrl` image; mobile: `posterUrl ?? backdropUrl`; gradient fallback if both null |
| 5 | Preview failure never breaks Home | ✅ PASS | `PreviewPlayer` sets `visibility: hidden` on error; shelves render independently |
| 6 | Autoplay preview is muted by default and respects browser/reduced-motion constraints | ✅ PASS | `mute=1` in iframe src; `PreviewContext` checks `prefers-reduced-motion` and `autoplayPreviews` profile preference |
| 7 | Hero displays canonical media identity, not raw Xtream naming | ✅ PASS | Data comes from `useFeaturedMedia` → TMDB-enriched catalog API (`/api/movies`, `/api/series`) |
| 8 | Zero-source canonical titles featured without fake Play action | ✅ PASS | `onPlay={undefined}` when `availabilityStatus !== 'AVAILABLE'`; HeroSection only renders button if both conditions met |
| 9 | `Lecture` uses existing playback/variant selection when a source exists | ✅ PASS | Navigates to `/player/movie/:id`; conditional on `AVAILABLE` status |
| 10 | `Plus d'infos` opens the shared #150 detail experience | ✅ PASS | `useOpenDetail` navigates with `{ state: { background, scrollY } }`; `MediaDetailShell` handles modal |
| 11 | Hero can feature Movies or Series | ✅ PASS | `useFeaturedMedia` returns `FeaturedMedia` with `mediaType: 'movie' | 'series'` |
| 12 | Featured selection is not hardcoded to one media ID | ✅ PASS | Priority-based selection: movie-with-backdrop > series-with-backdrop > movie > series (by popularity) |
| 13 | Mobile gets an adapted large top Hero, not a small banner | ✅ PASS | `h-[60vh]` on mobile with `posterUrl` preferred, `object-top` crop, touch-friendly buttons |
| 14 | #151 top mobile navigation is preserved | ✅ PASS | HeroSection has no impact on AppShell/navigation structure |
| 15 | Hero blends visually into the first shelves with gradients | ✅ PASS | Bottom gradient: `h-2/3 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/70 to-transparent` |
| 16 | Shelves still load/render if Hero media or preview fails | ✅ PASS | Hero failure is isolated; `{hero && <HeroSection ... />}` — null hero skips hero, shelves always render |
| 17 | Responsive/performance/accessibility behavior has appropriate tests | ⚠️ PARTIAL | `HeroSection.test.tsx` passes (14 tests). `MoviesPage.test.tsx` fails with `window.matchMedia` crash introduced by T076 (see Blocking Issues) |

---

## Test Results

```
Test Files: 3 failed | 30 passed (33 total)
Tests:      8 failed | 237 passed (245 total)
```

### Failing test files

#### 1. `src/pages/MoviesPage.test.tsx` — 4 failures (T076-introduced)

Root causes:

**A. Missing `window.matchMedia` mock (3 tests)**

`MoviesPage` passes `trailerKey` from `MOCK_MOVIE` (`'abc123'`) to `HeroSection`. When HeroSection mounts with a non-null `trailerKey`, line 43 calls `window.matchMedia('(prefers-reduced-motion: reduce)')`, which is undefined in jsdom. This throws an uncaught exception that corrupts subsequent test renders.

```
TypeError: window.matchMedia is not a function
  at HeroSection.tsx:43
```

Affected tests:
- `renders genre chips including Tous and genre names from API`
- `shows Play button when hero movie is AVAILABLE`
- `filters to a genre shelf when a genre chip is selected`

Fix: add `window.matchMedia` mock to `MoviesPage.test.tsx` `beforeEach`, identical to what `HeroSection.test.tsx` already does (lines 20-28).

**B. Outdated test expectation (1 test)**

Test `renders Disponibles and Tous les films shelf rows by default` expects:
- `'Disponibles'` shelf (only rendered when `availabilityMode === 'available'`, not by default)
- `'Tous les films'` heading (does not exist in current implementation)

Current default shelves are: `'Populaires'`, `'Les mieux notés'`, `'Sorties récentes'`, `'À venir'`.

Fix: update test expectations to match current UI. For the default view, assert on `'Populaires'`; to test `'Disponibles'`, click the `'Disponible maintenant'` button first.

---

#### 2. `src/pages/SeriesPage.test.tsx` — 1 failure (T076-introduced)

Test `renders Disponibles and Toutes les séries shelf rows by default` expects `'Disponibles'` and `'Toutes les séries'` in default view. Same issue as MoviesPage: `'Disponibles'` only appears in `available` mode, and `'Toutes les séries'` doesn't exist.

Note: SeriesPage does NOT pass `trailerKey` to HeroSection (intentional — series use episode-level playback), so the `window.matchMedia` crash does not occur.

Fix: update test to assert on `'Populaires'` for default view.

---

#### 3. `src/pages/SearchPage.test.tsx` — 3 failures (likely pre-existing, NOT T076)

Tests look for `'Aussi trouvé en dehors de votre catalogue'` — the external search section text. The text exists in `SearchPage.tsx:198` but the tests time out. This appears to be a pre-existing issue unrelated to T076. Recommend separate investigation.

---

## Regressions

- `MoviesPage.test.tsx` and `SeriesPage.test.tsx` were previously green (before T076 added HeroSection to those pages and refactored shelf names). T076 introduced both the `window.matchMedia` crash and outdated shelf-name expectations.

---

## Blocking Issues

1. **`MoviesPage.test.tsx`**: 4 tests fail due to `window.matchMedia` not mocked + outdated shelf-name assertions — **must be fixed before merge**.
2. **`SeriesPage.test.tsx`**: 1 test fails due to outdated shelf-name assertion — **must be fixed before merge**.

---

## Minor Observations (non-blocking)

- Ticket uses label `"▶ Lecture"` but implementation uses `"Lire"`. Functionally equivalent; acceptable localization choice.
- `window.matchMedia` is checked both in `HeroSection.tsx:43` (component) and inside `PreviewContext` (context). The component check is redundant with the context guard but not harmful.
- Series hero has no `trailerKey` passed (correct by design: no movie-level trailer for a series), so preview video path for series is unreachable from HomePage. This is acceptable for now.

---

## Verdict

**REFUSED** — 5 test failures in 2 files are introduced by T076 and must be fixed before this can pass.

The functional implementation satisfies all 17 acceptance criteria. Only the test files (not the feature code) require correction.
