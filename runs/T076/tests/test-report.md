---

## Test Report — T076

**Verdict: REFUSED** — functional implementation is solid, but T076 introduced 5 test failures across 2 files that must be fixed.

---

### Acceptance Criteria: all 17 PASS

The implementation correctly delivers:
- Full-width cinematic hero (`h-[60vh] / md:h-[85vh]`) replacing the old card
- YouTube preview player (muted, 2s delay, reduced-motion aware, cleanup on unmount)
- Backdrop → poster → gradient fallback chain
- Conditional "Lire" button (only when `AVAILABLE` + movie)
- "Plus d'infos" via shared `useOpenDetail` → `MediaDetailShell` (#150 detail modal)
- Dynamic featured selection (`useFeaturedMedia`: popularity-based, not hardcoded)
- Mobile 60vh hero with poster-oriented crop
- Bottom gradient blending into shelves
- Shelves render independently of hero

---

### Test Failures (must fix before merge)

**`MoviesPage.test.tsx` — 4 failures** (all T076-caused):

1. **`window.matchMedia` crash** (3 tests) — `MoviesPage` passes `trailerKey: 'abc123'` (from `MOCK_MOVIE`) to `HeroSection`, which calls `window.matchMedia(...)` in a `useEffect`. jsdom doesn't implement this. The fix is to add the same `window.matchMedia` mock that `HeroSection.test.tsx` already uses in its `beforeEach`.

2. **Outdated shelf names** (1 test) — Test expects `'Disponibles'` and `'Tous les films'` as default shelves. Current implementation shows `'Populaires'`, `'Les mieux notés'`, etc.; `'Disponibles'` only appears when the "Disponible maintenant" filter is active. Test assertions need updating.

**`SeriesPage.test.tsx` — 1 failure**:
- Same outdated expectation: `'Disponibles'` and `'Toutes les séries'` in default view. Update to assert on `'Populaires'`.

**`SearchPage.test.tsx` — 3 failures** (likely pre-existing, not T076):
- External search section tests fail; appears unrelated to this ticket. Recommend separate investigation.
