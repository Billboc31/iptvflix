All fixes are in place and 170 tests pass. Here's a summary of all changes made:

---

## Fix summary

**Blocking issues (B1, B2):**

- **`MovieDetailPage.tsx`**: Moved the entire action buttons div (Retour, ▶ Lecture, 📺 Lire sur TV, Watchlist, Feedback) to appear **before** the synopsis block. Added `line-clamp-4 md:line-clamp-none` to the synopsis so it doesn't push actions below fold on mobile.
- **`SeriesDetailPage.tsx`**: Same repositioning for Back/Watchlist/Feedback actions. Added `min-h-[44px]` to the Back button (also fixes M3). Added `line-clamp-4 md:line-clamp-none` to synopsis. Removed the now-duplicate action div that was at the bottom.
- **`e2e/tests/mobile-detail.spec.ts`**: Replaced the vacuous `if (await playButton.isVisible())` guard with `await expect(playButton).toBeVisible({ timeout: 5_000 })` — the assertion is now mandatory, not optional.

**Minor issues (M1, M2):**

- **`PosterCard.tsx`**: Root div width changed from `w-28 md:w-32 lg:w-36` → `w-full`. Width ownership belongs to ShelfRow's wrapper div, not PosterCard itself.
- **`PosterCard.test.tsx`**: Updated the 2 width-class tests to assert `w-full` instead of the removed responsive width classes.
- **`e2e/tests/mobile-shelf.spec.ts`**: Replaced the two-tap simulation with a proper mouse drag (mousedown → move → mouseup) to faithfully simulate a horizontal swipe gesture.
