I now have everything I need for a complete review. Let me write it up.

---

# Review — T058: Mobile Navigation and Shelf Browsing Redesign

## Summary

The implementation covers the plan faithfully across all 10 plan sections in 18 well-scoped files. The core mobile navigation pattern (BottomNav, LeftNav hide, AppShell responsive offsets), Shelf layout, hero responsiveness, and EpisodeRow touch targets are all correct. However, two connected issues on the Movie detail page — one a layout AC violation and one a vacuous test — are blocking.

---

## Blocking Issues

### B1 — MovieDetailPage: Play/Play on TV buttons likely below fold for enriched content (AC #10)

**File**: `apps/web/src/pages/MovieDetailPage.tsx:231-256`

The action buttons appear after: `h-[50vh]` hero (-96px overlap) → title → metadata badges → genres → synopsis (unclamped) → TrailerPlayer (label + button: ~84px) → variant selector → CastRow. For an enriched TMDB-matched movie (trailer + 1+ variant + cast), a rough stack height on a 375×667 Pixel 5 viewport:

| Element | approx. px from top |
|---|---|
| Hero bottom with -mt-24 | 237 |
| Title (text-2xl) + mb-1 | ~269 |
| Metadata badges + mb-4 | ~313 |
| Genres + mb-4 | ~357 |
| Synopsis (3 lines, unclamped) + mb-6 | ~441 |
| TrailerPlayer button area | ~525 |
| Variant selector | ~585 |
| CastRow | ~625 |
| **Action buttons start** | **~625** |

With the fixed BottomNav consuming 48–68 px at the bottom, the effective initial visible area is ~599 px. Action buttons at ~625 px are below the fold for any enriched movie.

The plan §6 explicitly warned: *"if the info block is too tall, move actions above synopsis or add a sticky footer bar for Play + Play on TV on mobile only."* No sticky footer and no reordering was implemented.

**Required fix**: Either (a) move `<div className="flex flex-wrap gap-3">` with Play/Lire sur TV above the synopsis block on mobile, or (b) add a `sticky bottom-[80px] md:static` action bar on mobile only containing at minimum Play and Play on TV. Apply the same fix to SeriesDetailPage, which currently has no Play action at all in its top-level buttons.

The synopsis should also be clamped on detail pages on mobile (e.g. `line-clamp-4 md:line-clamp-none`) to bound the height contribution.

---

### B2 — E2E mobile-detail: Play button visibility assertion is vacuous (AC #10)

**File**: `e2e/tests/mobile-detail.spec.ts:46-52`

```ts
const playButton = page.getByRole('button', { name: /lecture/i }).or(
  page.getByRole('link', { name: /lecture/i })
)
if (await playButton.isVisible()) {          // ← guard makes the whole assertion optional
  const box = await playButton.boundingBox()
  expect(box!.y + box!.height).toBeLessThan(viewportHeight)
}
```

If the Play button is scrolled below the fold, `isVisible()` returns `false`, the block is skipped, and the test **passes**. The test never actually enforces that the button is visible on load. CI cannot catch regressions for AC #10.

**Required fix**:

```ts
const playButton = page.getByRole('button', { name: /lecture/i }).or(
  page.getByRole('link', { name: /lecture/i })
)
await expect(playButton).toBeVisible({ timeout: 5_000 })
const box = await playButton.boundingBox()
expect(box!.y + box!.height).toBeLessThan(viewportHeight)
```

---

## Minor Observations

### M1 — Duplicate responsive width classes on ShelfRow wrapper + PosterCard

**Files**: `apps/web/src/components/content/ShelfRow.tsx:27`, `apps/web/src/components/content/PosterCard.tsx:59`

ShelfRow's card wrapper already carries `w-28 md:w-32 lg:w-36 snap-start` and PosterCard's root div independently declares `w-28 md:w-32 lg:w-36`. Since PosterCard is a child of the wrapper, PosterCard's width is already constrained by the parent; its own width class is redundant. Not a visual bug, but confusing. PosterCard should use `w-full` or drop the width class since width ownership lives in ShelfRow.

### M2 — Swipe simulation in mobile-shelf.spec.ts is not a swipe

**File**: `e2e/tests/mobile-shelf.spec.ts:43-44`

```ts
await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height / 2)
await page.touchscreen.tap(box.x + box.width * 0.3, box.y + box.height / 2)
```

Two taps ≠ a swipe. This exercises the preview guard in a static state, not during an actual scroll motion. The implementation is correct (`isTouch()` prevents `mouseenter`-triggered preview on coarse pointers), but the test doesn't faithfully reproduce a touch-scroll scenario. A proper swipe would use `page.mouse.move()` with `buttons: 1` or a `touchscreen` drag sequence. Not blocking given that the implementation mechanism is independently correct, but the test is a false signal.

### M3 — SeriesDetailPage Back button below 44 px touch target

**File**: `apps/web/src/pages/SeriesDetailPage.tsx:250`

```tsx
<Button variant="ghost" onClick={() => navigate(-1)}>
  ← Retour
</Button>
```

Button's `md` size (`py-2 text-sm`) renders at ~36 px height, below the 44 px minimum. MovieDetailPage correctly adds `className="min-h-[44px]"` to all its buttons. Apply the same to SeriesDetailPage's Retour, WatchlistButton row.

### M4 — E2E test files in `e2e/tests/` match `testDir: './tests'` — consistent, no issue

The plan referenced paths like `e2e/mobile-nav.spec.ts` but the playwright config specifies `testDir: './tests'` so `e2e/tests/mobile-nav.spec.ts` is correct. This is fine.

---

## What is correctly implemented

- `LeftNav`: `hidden md:flex` correctly removes sidebar on mobile — clean, correct.
- `AppShell`: `ml-0 md:ml-60` and `pb-20 md:pb-0` — correctly removes offset and clears BottomNav.
- `BottomNav`: safe-area inset, `min-h-[48px]`, active state, `block md:hidden` — correct per plan.
- `HorizontalRow`: arrows hidden with `hidden md:flex`, `snap-x snap-mandatory`, `px-4 md:px-8` — correct.
- `PosterCard`: `w-28 md:w-32 lg:w-36` + `isTouch()` guard preserved — correct.
- `HeroSection`: responsive title `text-2xl md:text-3xl lg:text-4xl`, `line-clamp-2 md:line-clamp-3`, `flex-wrap gap-2` — correct.
- `EpisodeRow`: `min-h-[44px]` on both Lire and TV buttons — correct.
- `Dialog`: reduced to `max-w-sm` (24rem), fits 375 px with `p-4` wrapper margin — correct.
- `Playwright config`: Pixel 5 + iPhone 12 projects correctly added.
- `BottomNav.test.tsx`: 6 tests covering tabs, active state, safe-area, responsive class — solid.
- `HorizontalRow.test.tsx`: 6 tests covering hidden class, md:flex, snap-x — solid.
- Scope is well bounded: 18 files, no backend changes, no data model changes.

---

## Verdict

Two connected issues: the MovieDetailPage action buttons are structurally below the initial mobile viewport for any enriched movie, and the E2E test designed to catch this is vacuous. Together they mean AC #10 is unmet and CI will not surface regressions. The remaining observations are minor and do not block functional correctness independently.

IMPLEMENTATION_FIX_REQUIRED
